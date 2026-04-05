"""Orchestrates career page discovery + job count extraction for a single company."""
import json
from datetime import datetime, timezone
from tenacity import retry, stop_after_attempt, retry_if_exception_type

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.company import Company
from app.models.scrape_event import CompanyScrapeEvent
from app.repositories import company_repo
from app.schemas.company import CompanyOut
from app.schemas.scrape import (
    CareerDiscoveryResult,
    CompanyScrapeResponse,
)
from app.agents.career_discovery_agent import discover_career_page


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


MAX_SCRAPE_ATTEMPTS = 1 + max(0, getattr(settings, "scrape_max_retries", 2))


async def _log_event(
    session: AsyncSession,
    company_id: int,
    event_type: str,
    payload: dict,
    run_id: int | None = None,
) -> None:
    event = CompanyScrapeEvent(
        company_id=company_id,
        run_id=run_id,
        event_time=_now_iso(),
        event_type=event_type,
        payload_json=json.dumps(payload) if payload else None,
    )
    session.add(event)
    await session.flush()


@retry(
    stop=stop_after_attempt(MAX_SCRAPE_ATTEMPTS),
    retry=retry_if_exception_type((ConnectionError, OSError)),
    reraise=True,
)
async def _run_discovery(company: Company) -> CareerDiscoveryResult:
    settings.require_openai_key()
    return await discover_career_page(
        company.name,
        company.ticker,
        model=settings.openai_model,
        api_key=settings.openai_api_key,
    )



async def _scrape_company(
    company: Company,
    db: AsyncSession,
    run_id: int | None = None,
) -> CompanyScrapeResponse:
    """Core career discovery logic, shared by ticker-based and ID-based entry points."""
    if run_id is not None:
        company.last_run_id = run_id

    def payload_base(p: dict) -> dict:
        d = dict(p)
        d.setdefault("company_id", company.id)
        if company.ticker:
            d.setdefault("ticker", company.ticker)
        return d

    discovery: CareerDiscoveryResult | None = None
    career_url: str | None = None

    try:
        discovery = await _run_discovery(company)
        career_url = str(discovery.career_page_url)
        await _log_event(
            db,
            company.id,
            "discover_career_page",
            payload_base({
                "career_page_url": career_url,
                "confidence": discovery.confidence,
                "alternate_urls": [str(u) for u in discovery.alternate_urls],
                "notes": discovery.notes,
                "hq_city": discovery.hq_city,
                "hq_state": discovery.hq_state,
                "step": "discover",
            }),
            run_id=run_id,
        )
    except Exception as e:
        await _log_event(
            db, company.id, "error",
            payload_base({"stage": "discover_career_page", "error": str(e), "step": "discover"}),
            run_id=run_id,
        )
        company.last_scrape_status = "failed"
        company.last_scrape_error = str(e)[:1000]
        company.last_scraped_at = _now_iso()
        await db.commit()
        return CompanyScrapeResponse(
            company=CompanyOut.model_validate(company),
            discovery=None,
            job_count=None,
        )

    company.career_page_url = career_url
    company.career_page_source = "openai_agent"
    if discovery.hq_city or discovery.hq_state:
        company.hq_city = (discovery.hq_city or "").strip() or None
        company.hq_state = (discovery.hq_state or "").strip() or None
        parts = [p for p in (company.hq_city, company.hq_state) if p]
        company.hq_location = ", ".join(parts) if parts else None

    if discovery.confidence < 0.5 and not career_url:
        company.last_scrape_status = "failed"
        company.last_scrape_error = "Low confidence and no URL"
        company.last_scraped_at = _now_iso()
        await db.commit()
        return CompanyScrapeResponse(company=CompanyOut.model_validate(company), discovery=discovery, job_count=None)

    if not career_url:
        company.last_scrape_status = "failed"
        company.last_scrape_error = "No career URL returned"
        company.last_scraped_at = _now_iso()
        await db.commit()
        return CompanyScrapeResponse(company=CompanyOut.model_validate(company), discovery=discovery, job_count=None)

    company.last_scraped_at = _now_iso()
    company.last_scrape_status = "success"
    company.last_scrape_error = None
    await db.commit()
    await db.refresh(company)
    return CompanyScrapeResponse(company=CompanyOut.model_validate(company), discovery=discovery, job_count=None)


async def scrape_company_by_id(
    company_id: int,
    db: AsyncSession,
    run_id: int | None = None,
) -> CompanyScrapeResponse | None:
    """Run career discovery for one company by its numeric ID (supports private companies)."""
    from app.repositories.company_repo import get_company_by_id
    company = await get_company_by_id(db, company_id)
    if not company:
        return None
    return await _scrape_company(company, db, run_id=run_id)


async def scrape_company_by_ticker(
    ticker: str,
    db: AsyncSession,
    run_id: int | None = None,
) -> CompanyScrapeResponse | None:
    """Run career discovery for one company by ticker. Returns None if not found."""
    company = await company_repo.get_company_by_ticker(db, ticker)
    if not company:
        return None
    return await _scrape_company(company, db, run_id=run_id)
