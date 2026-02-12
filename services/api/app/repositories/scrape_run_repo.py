"""Scrape run repository."""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scrape_run import ScrapeRun
from app.models.scrape_event import CompanyScrapeEvent
from app.models.company import Company


async def list_runs(
    session: AsyncSession,
    status: str | None = None,
    universe: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[ScrapeRun], int]:
    """List scrape runs, newest first. Returns (runs, total)."""
    query = select(ScrapeRun).order_by(ScrapeRun.started_at.desc())
    count_query = select(func.count()).select_from(ScrapeRun)
    if status:
        query = query.where(ScrapeRun.status == status)
        count_query = count_query.where(ScrapeRun.status == status)
    if universe:
        query = query.where(ScrapeRun.universe == universe)
        count_query = count_query.where(ScrapeRun.universe == universe)
    total = (await session.execute(count_query)).scalar_one()
    query = query.limit(page_size).offset((page - 1) * page_size)
    result = await session.execute(query)
    runs = list(result.scalars().all())
    return runs, total


async def get_run_by_id(session: AsyncSession, run_id: int) -> ScrapeRun | None:
    """Get a single run by id."""
    return await session.get(ScrapeRun, run_id)


async def get_company_ids_for_run(session: AsyncSession, run_id: int) -> list[int]:
    """Get distinct company_ids that have events for this run."""
    q = select(CompanyScrapeEvent.company_id).where(
        CompanyScrapeEvent.run_id == run_id
    ).distinct()
    result = await session.execute(q)
    return list({row[0] for row in result.all()})


async def get_companies_by_ids(session: AsyncSession, company_ids: list[int]) -> list[Company]:
    """Get companies by ids, order by id."""
    if not company_ids:
        return []
    result = await session.execute(
        select(Company).where(Company.id.in_(company_ids)).order_by(Company.ticker)
    )
    return list(result.scalars().all())
