from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.repositories import company_repo, job_application_repo
from app.schemas.job_application import (
    JobApplicationOut,
    JobApplicationWithCompanyOut,
    JobApplicationListOut,
    JobApplicationCreateRequest,
    JobApplicationUpdateRequest,
    APPLICATION_STATUSES,
)

router = APIRouter()


@router.get("/applications/statuses", response_model=list[str])
async def get_application_statuses():
    """Return valid application status values."""
    return APPLICATION_STATUSES


@router.get("/applications", response_model=JobApplicationListOut)
async def list_all_applications(
    status: list[str] | None = Query(None, description="Filter by status (repeatable)"),
    search: str | None = Query(None, description="Search job title or company name"),
    sort: str = Query("applied_date_desc", description="Sort: applied_date_desc, applied_date_asc, company_asc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List all job applications across all companies, with filtering and pagination."""
    valid_sorts = {"applied_date_desc", "applied_date_asc", "company_asc"}
    if sort not in valid_sorts:
        sort = "applied_date_desc"

    rows, total = await job_application_repo.list_all_applications(
        session=db,
        statuses=status or None,
        search=search,
        sort=sort,
        page=page,
        page_size=page_size,
    )
    total_pages = ceil(total / page_size) if total > 0 else 0
    items = []
    for app, company_name, hq_city, hq_state in rows:
        data = {c.key: getattr(app, c.key) for c in app.__table__.columns}
        data["company_name"] = company_name
        data["hq_city"] = hq_city
        data["hq_state"] = hq_state
        out = JobApplicationWithCompanyOut.model_validate(data)
        items.append(out)
    return JobApplicationListOut(items=items, page=page, page_size=page_size, total=total, total_pages=total_pages)


@router.post("/companies/by-id/{company_id}/applications", response_model=JobApplicationOut)
async def add_application(
    company_id: int,
    body: JobApplicationCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Add a job application for a company by ID."""
    company = await company_repo.get_company_by_id(db, company_id)
    if not company:
        raise HTTPException(status_code=404, detail=f"Company with id '{company_id}' not found")
    if body.status not in APPLICATION_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {APPLICATION_STATUSES}")
    app = await job_application_repo.create_application(
        session=db,
        company_id=company.id,
        job_url=body.job_url,
        job_title=body.job_title,
        applied_date=body.applied_date,
        status=body.status,
        notes=body.notes,
    )
    return JobApplicationOut.model_validate(app)


@router.get("/companies/by-id/{company_id}/applications", response_model=list[JobApplicationOut])
async def list_applications(
    company_id: int,
    db: AsyncSession = Depends(get_db),
):
    """List all job applications for a company by ID, newest first."""
    company = await company_repo.get_company_by_id(db, company_id)
    if not company:
        raise HTTPException(status_code=404, detail=f"Company with id '{company_id}' not found")
    apps = await job_application_repo.list_applications_for_company(db, company.id)
    return [JobApplicationOut.model_validate(a) for a in apps]


@router.delete("/applications/{application_id}", status_code=204)
async def delete_application(
    application_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a job application by ID."""
    app = await job_application_repo.get_application(db, application_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    await db.delete(app)
    await db.commit()


@router.patch("/applications/{application_id}", response_model=JobApplicationOut)
async def update_application(
    application_id: int,
    body: JobApplicationUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing job application."""
    if body.status is not None and body.status not in APPLICATION_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {APPLICATION_STATUSES}")
    app = await job_application_repo.update_application(
        session=db,
        application_id=application_id,
        job_url=body.job_url,
        job_title=body.job_title,
        applied_date=body.applied_date,
        status=body.status,
        notes=body.notes,
    )
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return JobApplicationOut.model_validate(app)
