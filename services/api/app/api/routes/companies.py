"""Companies API routes."""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from math import ceil

from app.db.session import get_db
from app.repositories import company_repo
from app.schemas.company import CompanyListOut, CompanyOut

router = APIRouter()


@router.get("/companies", response_model=CompanyListOut)
async def list_companies(
    search: str | None = Query(None, description="Search by name or ticker (case-insensitive)"),
    sector: str | None = Query(None, description="Filter by sector (exact match)"),
    universe: str | None = Query(None, description="Filter by universe (exact match)"),
    sort: str = Query("name_asc", description="Sort order: name_asc, job_count_desc, last_scraped_at_desc"),
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
    companies, total = await company_repo.list_companies(
        session=db,
        search=search,
        sector=sector,
        universe=universe,
        sort=sort,
        page=page,
        page_size=page_size,
    )
    
    # Calculate total pages
    total_pages = ceil(total / page_size) if total > 0 else 0
    
    # Convert to Pydantic models
    items = [CompanyOut.model_validate(company) for company in companies]
    
    return CompanyListOut(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


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

