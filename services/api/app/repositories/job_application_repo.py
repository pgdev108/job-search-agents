from datetime import datetime, timezone
from math import ceil

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
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


async def list_all_applications(
    session: AsyncSession,
    statuses: list[str] | None = None,
    search: str | None = None,
    sort: str = "applied_date_desc",
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[tuple[JobApplication, str, str | None, str | None]], int]:
    """
    List all applications joined with company name and HQ.
    Returns ([(application, company_name, hq_city, hq_state), ...], total_count).
    """
    base = (
        select(
            JobApplication,
            Company.name.label("company_name"),
            Company.hq_city.label("hq_city"),
            Company.hq_state.label("hq_state"),
        )
        .join(Company, JobApplication.company_id == Company.id)
    )

    if statuses:
        base = base.where(JobApplication.status.in_(statuses))

    if search:
        pattern = f"%{search.strip()}%"
        base = base.where(
            or_(
                JobApplication.job_title.ilike(pattern),
                Company.name.ilike(pattern),
            )
        )

    count_query = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_query)).scalar_one()

    if sort == "applied_date_asc":
        base = base.order_by(JobApplication.applied_date.asc(), JobApplication.id.asc())
    elif sort == "company_asc":
        base = base.order_by(Company.name.asc(), JobApplication.applied_date.desc())
    else:  # applied_date_desc
        base = base.order_by(JobApplication.applied_date.desc(), JobApplication.id.desc())

    base = base.offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(base)
    rows = [(row[0], row[1], row[2], row[3]) for row in result.all()]
    return rows, total


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
