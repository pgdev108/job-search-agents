from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job_application import JobApplication


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def create_application(
    session: AsyncSession,
    company_id: int,
    job_url: str,
    job_title: str | None,
    applied_date: str,
    status: str,
    notes: str | None,
) -> JobApplication:
    now = _now_iso()
    app = JobApplication(
        company_id=company_id,
        job_url=job_url,
        job_title=job_title,
        applied_date=applied_date,
        status=status,
        notes=notes,
        created_at=now,
        updated_at=now,
    )
    session.add(app)
    await session.commit()
    await session.refresh(app)
    return app


async def list_applications_for_company(
    session: AsyncSession,
    company_id: int,
) -> list[JobApplication]:
    result = await session.execute(
        select(JobApplication)
        .where(JobApplication.company_id == company_id)
        .order_by(JobApplication.applied_date.desc(), JobApplication.id.desc())
    )
    return list(result.scalars().all())


async def get_application(session: AsyncSession, application_id: int) -> JobApplication | None:
    return await session.get(JobApplication, application_id)


async def update_application(
    session: AsyncSession,
    application_id: int,
    job_url: str | None,
    job_title: str | None,
    applied_date: str | None,
    status: str | None,
    notes: str | None,
) -> JobApplication | None:
    app = await get_application(session, application_id)
    if not app:
        return None
    if job_url is not None:
        app.job_url = job_url
    if job_title is not None:
        app.job_title = job_title
    if applied_date is not None:
        app.applied_date = applied_date
    if status is not None:
        app.status = status
    if notes is not None:
        app.notes = notes
    app.updated_at = _now_iso()
    await session.commit()
    await session.refresh(app)
    return app
