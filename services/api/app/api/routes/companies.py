"""Companies API routes."""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from math import ceil

from app.db.session import get_db
from app.repositories import company_repo
from app.repositories.company_repo import _UNSET
from app.schemas.company import CompanyListOut, CompanyOut, CityCountOut, CompanyUpdateRequest

router = APIRouter()


@router.get("/companies", response_model=CompanyListOut)
async def list_companies(
    search: str | None = Query(None, description="Search by name or ticker (case-insensitive)"),
    sector: str | None = Query(None, description="Filter by sector (exact match)"),
    universe: str | None = Query(None, description="Filter by universe (exact match)"),
    last_scrape_status: str | None = Query(None, description="Filter by last scrape status: success, failed, blocked, not_found, or never (never scraped)"),
    state: str | None = Query(None, description="Filter by HQ state (e.g. IL, CA)"),
    city: str | None = Query(None, description="Filter by HQ city (use with state)"),
    sort: str = Query("name_asc", description="Sort order: name_asc, job_count_desc, last_scraped_at_desc"),
    interested_only: bool = Query(True, description="If true, exclude companies marked as not interested"),
    has_applications: str | None = Query(None, description="Filter by applications: 'yes' (>=1), 'no' (0), or omit for all"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=500, description="Items per page (max 500)"),
    db: AsyncSession = Depends(get_db),
):
    """List companies with filtering, sorting, and pagination."""
    # Validate sort parameter
    valid_sorts = ["name_asc", "job_count_desc", "last_scraped_at_desc"]
    if sort not in valid_sorts:
        sort = "name_asc"
    
    # Get companies from repository
    rows, total = await company_repo.list_companies(
        session=db,
        search=search,
        sector=sector,
        universe=universe,
        last_scrape_status=last_scrape_status,
        state=state,
        city=city,
        interested_only=interested_only,
        has_applications=has_applications,
        sort=sort,
        page=page,
        page_size=page_size,
    )

    total_pages = ceil(total / page_size) if total > 0 else 0

    items = []
    for company, applications_count in rows:
        out = CompanyOut.model_validate(company)
        out.applications_count = applications_count
        items.append(out)
    
    return CompanyListOut(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


@router.get("/companies/filters/scrape-status-counts", response_model=dict[str, int])
async def get_scrape_status_counts(
    db: AsyncSession = Depends(get_db),
):
    """Get count of companies per last_scrape_status. 'never' means never scraped (NULL)."""
    return await company_repo.get_scrape_status_counts(db)


@router.get("/companies/filters/last-scrape-statuses", response_model=list[str])
async def get_last_scrape_statuses(
    db: AsyncSession = Depends(get_db),
):
    """Get distinct last_scrape_status values (for filter dropdown). Use 'never' in filter for never scraped."""
    return await company_repo.get_last_scrape_statuses(db)


@router.get("/companies/filters/states", response_model=list[str])
async def get_states(
    db: AsyncSession = Depends(get_db),
):
    """Get distinct hq_state values (for filter dropdown)."""
    return await company_repo.get_states(db)


@router.get("/companies/filters/cities", response_model=list[CityCountOut])
async def get_cities_by_state(
    state: str = Query(..., description="State code (e.g. IL, CA) to get cities for"),
    db: AsyncSession = Depends(get_db),
):
    """Get cities in the given state with company count. Only shown when state filter is selected."""
    rows = await company_repo.get_cities_by_state(db, state)
    return [CityCountOut(city=city, count=count) for city, count in rows]


@router.patch("/companies/{ticker}", response_model=CompanyOut)
async def update_company(
    ticker: str,
    body: CompanyUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update ignore flag and/or career_page_url for a company. Set career_page_url to '' to clear it."""
    career_page_url = _UNSET if body.career_page_url is None else body.career_page_url
    company = await company_repo.update_company(
        session=db,
        ticker=ticker,
        career_page_url=career_page_url,
        not_interested=body.not_interested,
    )
    if not company:
        raise HTTPException(status_code=404, detail=f"Company '{ticker}' not found")
    return CompanyOut.model_validate(company)


@router.get("/companies/{ticker}", response_model=CompanyOut)
async def get_company_by_ticker(
    ticker: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single company by ticker (for detail page)."""
    company = await company_repo.get_company_by_ticker(db, ticker)
    if not company:
        raise HTTPException(status_code=404, detail=f"Company with ticker '{ticker}' not found")
    return CompanyOut.model_validate(company)


@router.get("/sectors", response_model=list[str])
async def get_sectors(
    db: AsyncSession = Depends(get_db),
):
    """Get list of distinct sectors."""
    sectors = await company_repo.get_sectors(db)
    return sectors


@router.get("/universes", response_model=list[str])
async def get_universes(
    db: AsyncSession = Depends(get_db),
):
    """Get list of distinct universes."""
    universes = await company_repo.get_universes(db)
    return universes

