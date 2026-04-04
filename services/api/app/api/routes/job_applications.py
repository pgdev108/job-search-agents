from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.repositories import company_repo, job_application_repo
from app.schemas.job_application import (
    JobApplicationOut,
    JobApplicationCreateRequest,
    JobApplicationUpdateRequest,
    APPLICATION_STATUSES,
)

router = APIRouter()


@router.get("/applications/statuses", response_model=list[str])
async def get_application_statuses():
    """Return valid application status values."""
    return APPLICATION_STATUSES


@router.post("/companies/{ticker}/applications", response_model=JobApplicationOut)
async def add_application(
    ticker: str,
    body: JobApplicationCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Add a job application for a company."""
    company = await company_repo.get_company_by_ticker(db, ticker)
    if not company:
        raise HTTPException(status_code=404, detail=f"Company '{ticker}' not found")
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


@router.get("/companies/{ticker}/applications", response_model=list[JobApplicationOut])
async def list_applications(
    ticker: str,
    db: AsyncSession = Depends(get_db),
):
    """List all job applications for a company, newest first."""
    company = await company_repo.get_company_by_ticker(db, ticker)
    if not company:
        raise HTTPException(status_code=404, detail=f"Company '{ticker}' not found")
    apps = await job_application_repo.list_applications_for_company(db, company.id)
    return [JobApplicationOut.model_validate(a) for a in apps]


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
