"""Companies API routes."""
from fastapi import APIRouter, Depends, Query, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from math import ceil

from app.db.session import get_db
from app.repositories import company_repo, job_application_repo
from app.repositories.company_repo import _UNSET
from app.schemas.company import CompanyListOut, CompanyOut, CityCountOut, CompanyUpdateRequest, CompanyCreateRequest

router = APIRouter()


@router.get("/companies", response_model=CompanyListOut)
async def list_companies(
    search: str | None = Query(None, description="Search by name or ticker (case-insensitive)"),
    sector: str | None = Query(None, description="Filter by sector (exact match)"),
    universe: str | None = Query(None, description="Filter by universe (exact match)"),
    last_scrape_status: str | None = Query(None, description="Filter by last scrape status: success, failed, blocked, not_found, or never (never scraped)"),
    state: str | None = Query(None, description="Filter by HQ state (e.g. IL, CA)"),
    city: str | None = Query(None, description="Filter by HQ city (use with state)"),
    tag: str | None = Query(None, description="Filter by company tag (e.g. bay_area)"),
    sort: str = Query("name_asc", description="Sort order: name_asc, job_count_desc, last_scraped_at_desc"),
    interested_only: bool = Query(True, description="If true, exclude companies marked as not interested"),
    unreviewed_only: bool = Query(False, description="If true, only show companies not yet marked as career reviewed"),
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
        tag=tag,
        interested_only=interested_only,
        unreviewed_only=unreviewed_only,
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


@router.post("/companies", response_model=CompanyOut, status_code=201)
async def create_company(
    body: CompanyCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create a new company."""
    company = await company_repo.create_company(
        session=db,
        name=body.name,
        universe=body.universe,
        ticker=body.ticker or None,
        hq_state=body.hq_state or None,
        hq_city=body.hq_city or None,
        website=body.website or None,
        career_page_url=body.career_page_url or None,
    )
    return CompanyOut.model_validate(company)


@router.get("/companies/{company_id}", response_model=CompanyOut)
async def get_company_by_id(
    company_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a single company by its numeric ID."""
    company = await company_repo.get_company_by_id(db, company_id)
    if not company:
        raise HTTPException(status_code=404, detail=f"Company with id '{company_id}' not found")
    return CompanyOut.model_validate(company)


@router.delete("/companies/{company_id}", status_code=204)
async def delete_company(
    company_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a company by ID. Fails with 409 if the company has job applications."""
    company = await company_repo.get_company_by_id(db, company_id)
    if not company:
        raise HTTPException(status_code=404, detail=f"Company with id '{company_id}' not found")
    apps = await job_application_repo.list_applications_for_company(db, company_id)
    if apps:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete company — it has {len(apps)} job application(s). Delete them first.",
        )
    await db.delete(company)
    await db.commit()


@router.patch("/companies/by-id/{company_id}", response_model=CompanyOut)
async def update_company_by_id(
    company_id: int,
    body: CompanyUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update a private company (no ticker) by its numeric ID."""
    company = await company_repo.update_company_by_id(
        session=db,
        company_id=company_id,
        career_page_url=_UNSET if body.career_page_url is None else body.career_page_url,
        not_interested=body.not_interested,
        career_reviewed=body.career_reviewed,
        company_tags=_UNSET if body.company_tags is None else body.company_tags,
        website=_UNSET if body.website is None else body.website,
        hq_city=_UNSET if body.hq_city is None else body.hq_city,
        hq_state=_UNSET if body.hq_state is None else body.hq_state,
        sector=_UNSET if body.sector is None else body.sector,
        industry=_UNSET if body.industry is None else body.industry,
        description=_UNSET if body.description is None else body.description,
        founded_year=_UNSET if body.founded_year is None else body.founded_year,
        company_size=_UNSET if body.company_size is None else body.company_size,
        universe=_UNSET if body.universe is None else body.universe,
    )
    if not company:
        raise HTTPException(status_code=404, detail=f"Company with id '{company_id}' not found")
    return CompanyOut.model_validate(company)


@router.patch("/companies/{ticker}", response_model=CompanyOut)
async def update_company(
    ticker: str,
    body: CompanyUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update ignore flag and/or career_page_url for a company. Set career_page_url to '' to clear it."""
    career_page_url = _UNSET if body.career_page_url is None else body.career_page_url
    company_tags = _UNSET if body.company_tags is None else body.company_tags
    company = await company_repo.update_company(
        session=db,
        ticker=ticker,
        career_page_url=career_page_url,
        not_interested=body.not_interested,
        company_tags=company_tags,
    )
    if not company:
        raise HTTPException(status_code=404, detail=f"Company '{ticker}' not found")
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



@router.get("/tags", response_model=list[str])
async def get_tags(db: AsyncSession = Depends(get_db)):
    """Get all available tag names."""
    return await company_repo.get_all_tags(db)


@router.post("/tags", response_model=list[str], status_code=201)
async def create_tag(
    name: str = Body(..., embed=True, description="Tag name to create"),
    db: AsyncSession = Depends(get_db),
):
    """Create a new tag. Returns updated list of all tags."""
    name = name.strip().lower()
    if not name:
        raise HTTPException(status_code=422, detail="Tag name cannot be empty")
    await company_repo.create_tag(db, name)
    return await company_repo.get_all_tags(db)


@router.delete("/tags/{name}", status_code=204)
async def delete_tag(
    name: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a tag by name and remove it from all companies that have it."""
    deleted = await company_repo.delete_tag(db, name)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Tag '{name}' not found")
