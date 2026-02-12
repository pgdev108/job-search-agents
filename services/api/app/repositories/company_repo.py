"""Company repository for database operations."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_

from app.models.company import Company


async def list_companies(
    session: AsyncSession,
    search: str | None = None,
    sector: str | None = None,
    universe: str | None = None,
    sort: str = "name_asc",
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[Company], int]:
    """
    List companies with filtering, sorting, and pagination.
    
    Returns:
        Tuple of (companies list, total count)
    """
    # Build base query
    query = select(Company)
    
    # Apply filters
    conditions = []
    
    if search:
        search_term = f"%{search.lower()}%"
        conditions.append(
            or_(
                func.lower(Company.name).like(search_term),
                func.lower(Company.ticker).like(search_term),
            )
        )
    
    if sector:
        conditions.append(Company.sector == sector)
    
    if universe:
        conditions.append(Company.universe == universe)
    
    if conditions:
        query = query.where(and_(*conditions))
    
    # Apply sorting
    if sort == "job_count_desc":
        query = query.order_by(Company.job_count.desc().nulls_last(), Company.name.asc())
    elif sort == "last_scraped_at_desc":
        query = query.order_by(Company.last_scraped_at.desc().nulls_last(), Company.name.asc())
    else:  # name_asc (default)
        query = query.order_by(Company.name.asc())
    
    # Get total count
    count_query = select(func.count()).select_from(Company)
    if conditions:
        count_query = count_query.where(and_(*conditions))
    
    total_result = await session.execute(count_query)
    total = total_result.scalar_one()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.limit(page_size).offset(offset)
    
    # Execute query
    result = await session.execute(query)
    companies = result.scalars().all()
    
    return list(companies), total


async def get_tickers_for_bulk(
    session: AsyncSession,
    universe: str | None = None,
    tickers: list[str] | None = None,
    limit: int = 6000,
) -> list[str]:
    """
    Get list of tickers for bulk scrape.
    If tickers provided, return those (up to limit). Else if universe, return all in universe. Else all.
    """
    if tickers:
        # Dedupe and limit
        seen = set()
        out = []
        for t in tickers:
            t = t.strip().upper()
            if t and t not in seen and len(out) < limit:
                seen.add(t)
                out.append(t)
        return out
    query = select(Company.ticker).order_by(Company.ticker)
    if universe:
        query = query.where(Company.universe == universe)
    query = query.limit(limit)
    result = await session.execute(query)
    return [row[0] for row in result.all()]


async def get_company_by_ticker(session: AsyncSession, ticker: str) -> Company | None:
    """Get a single company by ticker (case-insensitive)."""
    query = select(Company).where(func.lower(Company.ticker) == ticker.strip().lower())
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def get_sectors(session: AsyncSession) -> list[str]:
    """Get distinct sectors from companies."""
    query = select(Company.sector).distinct().where(Company.sector.isnot(None)).order_by(Company.sector)
    result = await session.execute(query)
    sectors = result.scalars().all()
    return [s for s in sectors if s]  # Filter out None values


async def get_universes(session: AsyncSession) -> list[str]:
    """Get distinct universes from companies."""
    query = select(Company.universe).distinct().where(Company.universe.isnot(None)).order_by(Company.universe)
    result = await session.execute(query)
    universes = result.scalars().all()
    return [u for u in universes if u]  # Filter out None values

