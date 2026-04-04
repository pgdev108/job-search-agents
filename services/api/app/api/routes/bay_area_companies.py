"""Bay Area companies API routes."""
from math import ceil
from pathlib import Path

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.repositories import bay_area_company_repo
from app.schemas.bay_area_company import BayAreaCompanyListOut, BayAreaCompanyOut, BayAreaSeedResult

router = APIRouter()

# Path to the bundled CSV (lives next to the api service)
_CSV_PATH = Path(__file__).parent.parent.parent.parent / "data" / "Bay-Area-Companies-List.csv"


@router.post("/admin/seed/bay-area", response_model=BayAreaSeedResult, tags=["admin"])
async def seed_bay_area(db: AsyncSession = Depends(get_db)):
    """
    Seed bay_area_companies table from the bundled CSV file.
    Safe to call multiple times — upserts on domain/name.
    """
    if not _CSV_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail=f"CSV file not found at {_CSV_PATH}. Upload Bay-Area-Companies-List.csv to services/api/data/.",
        )
    csv_text = _CSV_PATH.read_text(encoding="utf-8-sig")
    result = await bay_area_company_repo.upsert_from_csv(db, csv_text)
    return BayAreaSeedResult(**result)


@router.get("/bay-area/companies/filters/locations", response_model=list[str], tags=["bay-area"])
async def get_locations(db: AsyncSession = Depends(get_db)):
    """Distinct location area values for filter dropdown."""
    return await bay_area_company_repo.get_locations(db)


@router.get("/bay-area/companies/filters/tags", response_model=list[str], tags=["bay-area"])
async def get_tags(db: AsyncSession = Depends(get_db)):
    """Distinct tag tokens for filter dropdown."""
    return await bay_area_company_repo.get_tags(db)


@router.get("/bay-area/companies/filters/sizes", response_model=list[str], tags=["bay-area"])
async def get_company_sizes(db: AsyncSession = Depends(get_db)):
    """Distinct company size buckets for filter dropdown."""
    return await bay_area_company_repo.get_company_sizes(db)


@router.get("/bay-area/companies", response_model=BayAreaCompanyListOut, tags=["bay-area"])
async def list_bay_area_companies(
    search: str | None = Query(None, description="Search by name or description"),
    location: str | None = Query(None, description="Filter by area (e.g. San Francisco, East Bay)"),
    tag: str | None = Query(None, description="Filter by tag token (e.g. AI, Healthcare)"),
    company_size: str | None = Query(None, description="Filter by company size bucket (e.g. 61-150)"),
    sort: str = Query("name_asc", description="Sort: name_asc | founded_desc | founded_asc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List Bay Area companies with filtering, sorting, and pagination."""
    valid_sorts = {"name_asc", "founded_desc", "founded_asc"}
    if sort not in valid_sorts:
        sort = "name_asc"

    companies, total = await bay_area_company_repo.list_companies(
        session=db,
        search=search,
        location=location,
        tag=tag,
        company_size=company_size,
        sort=sort,
        page=page,
        page_size=page_size,
    )

    total_pages = ceil(total / page_size) if total > 0 else 0
    items = [BayAreaCompanyOut.model_validate(c) for c in companies]

    return BayAreaCompanyListOut(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )
