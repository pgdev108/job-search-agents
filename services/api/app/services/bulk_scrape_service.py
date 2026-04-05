"""Bulk scrape orchestration: run many companies with concurrency limit."""
import asyncio
import random
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.scrape_run import ScrapeRun
from app.repositories import company_repo
from app.schemas.scrape import ScrapeRunOut
from app.services.scrape_service import scrape_company_by_ticker, scrape_company_by_id

# SQLite allows only one writer at a time. Serialize all DB writes during bulk run to avoid "database is locked".
_db_write_lock = asyncio.Lock()

# Per-run cancel events. Set the event to request cancellation of that run.
_cancel_events: dict[int, asyncio.Event] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _has_running_run(session: AsyncSession) -> bool:
    """True if any scrape_run has status='running'."""
    r = await session.execute(select(ScrapeRun.id).where(ScrapeRun.status == "running").limit(1))
    return r.scalar_one_or_none() is not None


async def _update_run_counts(
    session: AsyncSession,
    run_id: int,
    status: str,
    last_error: str | None = None,
) -> None:
    """Increment the appropriate counter for the run and optionally set last_error."""
    values = {}
    if status == "success":
        values["success_count"] = ScrapeRun.success_count + 1
    elif status == "failed":
        values["failed_count"] = ScrapeRun.failed_count + 1
    elif status == "blocked":
        values["blocked_count"] = ScrapeRun.blocked_count + 1
    elif status == "not_found":
        values["not_found_count"] = ScrapeRun.not_found_count + 1
    else:
        values["failed_count"] = ScrapeRun.failed_count + 1
    if last_error:
        values["last_error"] = last_error[:1000]
    stmt = update(ScrapeRun).where(ScrapeRun.id == run_id).values(**values)
    await session.execute(stmt)
    await session.commit()


async def _finish_run(session: AsyncSession, run_id: int, cancelled: bool = False) -> None:
    """Set finished_at and status."""
    r = await session.get(ScrapeRun, run_id)
    if not r:
        return
    r.finished_at = _now_iso()
    if cancelled:
        r.status = "cancelled"
    else:
        r.status = "success" if (r.failed_count == 0 and r.blocked_count == 0 and r.not_found_count == 0) else "failed"
    await session.commit()


def cancel_run(run_id: int) -> bool:
    """Signal a running bulk scrape to stop. Returns True if the run was found, False if not active."""
    event = _cancel_events.get(run_id)
    if event is None:
        return False
    event.set()
    return True


async def _process_one_ticker(
    ticker: str,
    run_id: int,
    semaphore: asyncio.Semaphore,
    cancel_event: asyncio.Event,
) -> None:
    """Process a single company; update run counters. Uses its own DB session.
    All DB access is serialized with _db_write_lock to avoid SQLite 'database is locked'.
    """
    if cancel_event.is_set():
        return
    async with semaphore:
        await asyncio.sleep(random.uniform(0, 0.2))
        async with _db_write_lock:
            async with AsyncSessionLocal() as session:
                try:
                    result = await scrape_company_by_ticker(ticker, session, run_id=run_id)
                    if result is None:
                        await _update_run_counts(session, run_id, "failed", "Company not found")
                        return
                    status = (
                        result.job_count.status
                        if result.job_count
                        else (result.company.last_scrape_status or "failed")
                    )
                    err = result.company.last_scrape_error
                    await _update_run_counts(session, run_id, status, err)
                except Exception as e:
                    await session.rollback()
                    async with AsyncSessionLocal() as sess2:
                        await _update_run_counts(sess2, run_id, "failed", str(e)[:1000])


async def _process_one_id(
    company_id: int,
    run_id: int,
    semaphore: asyncio.Semaphore,
    cancel_event: asyncio.Event,
) -> None:
    """Process a single company by ID; update run counters."""
    if cancel_event.is_set():
        return
    async with semaphore:
        await asyncio.sleep(random.uniform(0, 0.2))
        async with _db_write_lock:
            async with AsyncSessionLocal() as session:
                try:
                    result = await scrape_company_by_id(company_id, session, run_id=run_id)
                    if result is None:
                        await _update_run_counts(session, run_id, "failed", "Company not found")
                        return
                    status = result.company.last_scrape_status or "failed"
                    err = result.company.last_scrape_error
                    await _update_run_counts(session, run_id, status, err)
                except Exception as e:
                    await session.rollback()
                    async with AsyncSessionLocal() as sess2:
                        await _update_run_counts(sess2, run_id, "failed", str(e)[:1000])


async def _run_bulk_background(run_id: int, tickers: list[str]) -> None:
    """Background task: process all tickers with concurrency limit."""
    cancel_event = asyncio.Event()
    _cancel_events[run_id] = cancel_event
    concurrency = max(1, min(settings.bulk_scrape_concurrency, 32))
    semaphore = asyncio.Semaphore(concurrency)
    try:
        await asyncio.gather(*[_process_one_ticker(t, run_id, semaphore, cancel_event) for t in tickers])
    finally:
        cancelled = cancel_event.is_set()
        _cancel_events.pop(run_id, None)
        async with AsyncSessionLocal() as session:
            await _finish_run(session, run_id, cancelled=cancelled)


async def _run_bulk_background_by_ids(run_id: int, company_ids: list[int]) -> None:
    """Background task: process all company IDs with concurrency limit."""
    cancel_event = asyncio.Event()
    _cancel_events[run_id] = cancel_event
    concurrency = max(1, min(settings.bulk_scrape_concurrency, 32))
    semaphore = asyncio.Semaphore(concurrency)
    try:
        await asyncio.gather(*[_process_one_id(cid, run_id, semaphore, cancel_event) for cid in company_ids])
    finally:
        cancelled = cancel_event.is_set()
        _cancel_events.pop(run_id, None)
        async with AsyncSessionLocal() as session:
            await _finish_run(session, run_id, cancelled=cancelled)


async def start_bulk_scrape(
    db: AsyncSession,
    universe: str | None = None,
    tickers: list[str] | None = None,
    failed_only: bool = False,
    tag: str | None = None,
) -> ScrapeRunOut:
    """
    Create a scrape_run, select target tickers, kick off background task, return run summary.
    If failed_only=True, only companies with last_scrape_status != 'success' (or null) are included.
    Raises ValueError if a bulk run is already in progress (caller should return 409).
    """
    if await _has_running_run(db):
        raise ValueError("Bulk scrape already running")

    # Tag-based scrape: fetch company IDs (works for private companies too)
    if tag:
        company_ids = await company_repo.get_company_ids_by_tag(
            session=db, tag=tag, limit=settings.bulk_scrape_max_companies
        )
        if not company_ids:
            raise ValueError(f"No eligible companies found for tag '{tag}' (all may already have career URLs)")
        run = ScrapeRun(
            started_at=_now_iso(),
            finished_at=None,
            status="running",
            universe=f"tag:{tag}",
            total_companies=len(company_ids),
            success_count=0,
            failed_count=0,
            blocked_count=0,
            not_found_count=0,
            last_error=None,
        )
        db.add(run)
        await db.commit()
        await db.refresh(run)
        asyncio.create_task(_run_bulk_background_by_ids(run.id, company_ids))
        return ScrapeRunOut.model_validate(run)

    universe = universe or None
    if failed_only:
        ticker_list = await company_repo.get_tickers_failed(
            session=db,
            universe=universe,
            limit=settings.bulk_scrape_max_companies,
        )
        if not ticker_list:
            raise ValueError(
                "No failed (non-success) companies to scrape for the given universe. "
                "Try 'Refresh All' first or select a different universe."
            )
    else:
        ticker_list = await company_repo.get_tickers_for_bulk(
            session=db,
            universe=universe,
            tickers=tickers,
            limit=settings.bulk_scrape_max_companies,
        )
        if not ticker_list:
            raise ValueError("No companies to scrape for the given universe/tickers")

    run = ScrapeRun(
        started_at=_now_iso(),
        finished_at=None,
        status="running",
        universe=universe,
        total_companies=len(ticker_list),
        success_count=0,
        failed_count=0,
        blocked_count=0,
        not_found_count=0,
        last_error=None,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    asyncio.create_task(_run_bulk_background(run.id, ticker_list))
    return ScrapeRunOut.model_validate(run)
