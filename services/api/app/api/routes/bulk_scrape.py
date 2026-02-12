"""Bulk scrape API: start run, list runs, run detail, run companies."""
from fastapi import APIRouter, Depends, Query, HTTPException, Body

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.scrape import (
    ScrapeRunOut,
    ScrapeRunDetailOut,
    ScrapeAllRequest,
)
from app.schemas.company import CompanyOut
from app.services.bulk_scrape_service import start_bulk_scrape
from app.repositories import scrape_run_repo
from app.core.config import settings

router = APIRouter(prefix="/scrape", tags=["scrape"])


@router.post("/all", response_model=ScrapeRunOut)
async def scrape_all(
    body: ScrapeAllRequest = Body(default=ScrapeAllRequest()),
    db: AsyncSession = Depends(get_db),
) -> ScrapeRunOut:
    """
    Start a bulk scrape run. Returns immediately with run_id.
    Use universe (e.g. sp500) and/or tickers. If neither, uses default universe.
    Returns 409 if a bulk run is already in progress.
    """
    try:
        settings.require_openai_key()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    # When tickers provided, use only those (universe for display can be null). Else use universe filter.
    if body.tickers:
        universe = body.universe or None
        tickers = body.tickers
    else:
        universe = body.universe or settings.bulk_scrape_universe_default
        tickers = None
    try:
        return await start_bulk_scrape(db, universe=universe, tickers=tickers)
    except ValueError as e:
        if "already running" in str(e).lower():
            raise HTTPException(status_code=409, detail="Bulk scrape already running")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/runs", response_model=list[ScrapeRunOut])
async def list_scrape_runs(
    status: str | None = Query(None, description="Filter by status"),
    universe: str | None = Query(None, description="Filter by universe"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> list[ScrapeRunOut]:
    """List recent scrape runs, newest first."""
    runs, _ = await scrape_run_repo.list_runs(db, status=status, universe=universe, page=page, page_size=page_size)
    return [ScrapeRunOut.model_validate(r) for r in runs]


@router.get("/runs/{run_id}", response_model=ScrapeRunDetailOut)
async def get_scrape_run(
    run_id: int,
    db: AsyncSession = Depends(get_db),
) -> ScrapeRunDetailOut:
    """Get run detail with progress (processed, remaining, percent_complete)."""
    run = await scrape_run_repo.get_run_by_id(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Scrape run not found")
    out = ScrapeRunDetailOut.model_validate(run)
    out.processed = (
        run.success_count + run.failed_count + run.blocked_count + run.not_found_count
    )
    out.remaining = max(0, run.total_companies - out.processed)
    out.percent_complete = (
        (out.processed / run.total_companies * 100.0) if run.total_companies else 100.0
    )
    return out


@router.get("/runs/{run_id}/companies", response_model=list[CompanyOut])
async def get_scrape_run_companies(
    run_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[CompanyOut]:
    """Get companies touched by this run (from events), with latest scrape fields."""
    run = await scrape_run_repo.get_run_by_id(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Scrape run not found")
    company_ids = await scrape_run_repo.get_company_ids_for_run(db, run_id)
    companies = await scrape_run_repo.get_companies_by_ids(db, company_ids)
    return [CompanyOut.model_validate(c) for c in companies]
