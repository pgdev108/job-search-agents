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
    JobCountResult,
    CompanyScrapeResponse,
)
from app.agents.career_discovery_agent import discover_career_page
from app.scrapers.job_count_extractor import extract_job_count


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


@retry(
    stop=stop_after_attempt(MAX_SCRAPE_ATTEMPTS),
    retry=retry_if_exception_type((OSError, TimeoutError)),
    reraise=True,
)
async def _run_job_count(url: str, company: Company) -> JobCountResult:
    return await extract_job_count(
        url,
        company_name=company.name,
        ticker=company.ticker,
        headless=settings.playwright_headless,
        nav_timeout_ms=settings.playwright_nav_timeout_ms,
        domain_delay_ms=settings.scrape_domain_delay_ms,
    )


async def scrape_company_by_ticker(
    ticker: str,
    db: AsyncSession,
    run_id: int | None = None,
) -> CompanyScrapeResponse | None:
    """
    Run career discovery + job count for one company by ticker.
    Returns None if company not found (caller should 404).
    If run_id is set, events are linked and company.last_run_id is updated.
    """
    company = await company_repo.get_company_by_ticker(db, ticker)
    if not company:
        return None

    if run_id is not None:
        company.last_run_id = run_id

    discovery: CareerDiscoveryResult | None = None
    job_count_result: JobCountResult | None = None
    career_url: str | None = None

    def payload_with_ticker(p: dict) -> dict:
        d = dict(p)
        d.setdefault("ticker", company.ticker)
        return d

    # --- Career discovery ---
    try:
        discovery = await _run_discovery(company)
        career_url = str(discovery.career_page_url)
        await _log_event(
            db,
            company.id,
            "discover_career_page",
            payload_with_ticker({
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
            payload_with_ticker({"stage": "discover_career_page", "error": str(e), "step": "discover"}),
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

    # Persist discovery (career URL + HQ from agent)
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
        return CompanyScrapeResponse(
            company=CompanyOut.model_validate(company),
            discovery=discovery,
            job_count=None,
        )

    if not career_url:
        company.last_scrape_status = "failed"
        company.last_scrape_error = "No career URL returned"
        company.last_scraped_at = _now_iso()
        await db.commit()
        return CompanyScrapeResponse(
            company=CompanyOut.model_validate(company),
            discovery=discovery,
            job_count=None,
        )

    # --- Job count ---
    try:
        job_count_result = await _run_job_count(career_url, company)
    except Exception as e:
        job_count_result = JobCountResult(
            job_count=None,
            method="error",
            evidence="",
            status="failed",
            error=str(e)[:500],
        )

    await _log_event(
        db,
        company.id,
        "count_jobs",
        payload_with_ticker({
            "job_count": job_count_result.job_count,
            "method": job_count_result.method,
            "status": job_count_result.status,
            "error": job_count_result.error,
            "evidence": (job_count_result.evidence[:200] if job_count_result.evidence else ""),
            "step": "count_jobs",
        }),
        run_id=run_id,
    )

    company.job_count = job_count_result.job_count
    company.job_count_extraction_method = job_count_result.method
    company.last_scraped_at = _now_iso()
    company.last_scrape_status = job_count_result.status
    company.last_scrape_error = job_count_result.error or None
    await db.commit()
    await db.refresh(company)

    return CompanyScrapeResponse(
        company=CompanyOut.model_validate(company),
        discovery=discovery,
        job_count=job_count_result,
    )
