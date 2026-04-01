"""Company repository for database operations."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_

from app.models.company import Company


def _universe_contains_like(universe: str):
    """Match if company's universe (comma-separated) contains value as a whole token."""
    raw = (universe or "").strip()
    if not raw:
        return Company.universe.isnot(None)
    # Escape LIKE wildcards so "dow_jones" matches literally (not _ as any char)
    safe = raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    like_esc = "\\"
    return or_(
        Company.universe == raw,
        Company.universe.like(safe + ",%", escape=like_esc),
        Company.universe.like("%," + safe + ",%", escape=like_esc),
        Company.universe.like("%," + safe, escape=like_esc),
    )


async def list_companies(
    session: AsyncSession,
    search: str | None = None,
    sector: str | None = None,
    universe: str | None = None,
    last_scrape_status: str | None = None,
    state: str | None = None,
    city: str | None = None,
    sort: str = "name_asc",
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[Company], int]:
    """
    List companies with filtering, sorting, and pagination.
    
    last_scrape_status: "never" => status IS NULL; otherwise exact match (case-insensitive).
    
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
        conditions.append(_universe_contains_like(universe))
    
    if last_scrape_status:
        if last_scrape_status.strip().lower() == "never":
            conditions.append(Company.last_scrape_status.is_(None))
        else:
            conditions.append(func.lower(Company.last_scrape_status) == last_scrape_status.strip().lower())
    
    if state:
        conditions.append(func.upper(Company.hq_state) == state.strip().upper())
    
    if city:
        conditions.append(func.upper(Company.hq_city) == city.strip().upper())
    
    if conditions:
        query = query.where(and_(*conditions))
    
    # Apply sorting
    if sort == "job_count_desc":
        query = query.order_by(Company.job_count.desc().nulls_last(), Company.name.asc())
    elif sort == "last_scraped_at_desc":
        query = query.order_by(Company.last_scraped_at.desc().nulls_last(), Company.name.asc())
    else:  # name_asc (default)
        query = query.order_by(Company.name.asc())
    
    # Get total count (same filters)
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
        query = query.where(_universe_contains_like(universe))
    query = query.limit(limit)
    result = await session.execute(query)
    return [row[0] for row in result.all()]


async def get_tickers_failed(
    session: AsyncSession,
    universe: str | None = None,
    limit: int = 6000,
) -> list[str]:
    """
    Get tickers of companies whose last scrape was not success.
    (last_scrape_status IS NULL OR LOWER(last_scrape_status) != 'success').
    Optionally filter by universe.
    """
    not_success = or_(
        Company.last_scrape_status.is_(None),
        func.lower(Company.last_scrape_status) != "success",
    )
    query = (
        select(Company.ticker)
        .where(not_success)
        .order_by(Company.ticker)
        .limit(limit)
    )
    if universe:
        query = query.where(_universe_contains_like(universe))
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
    """Get distinct index tokens from companies (universe is comma-separated, e.g. sp500,dow_jones)."""
    query = select(Company.universe).where(Company.universe.isnot(None))
    result = await session.execute(query)
    rows = result.all()
    tokens = set()
    for (u,) in rows:
        if u:
            for part in u.split(","):
                t = part.strip()
                if t:
                    tokens.add(t)
    return sorted(tokens)


async def get_last_scrape_statuses(session: AsyncSession) -> list[str]:
    """Get distinct last_scrape_status values from companies (non-null). For 'Never' use filter value 'never'."""
    query = (
        select(Company.last_scrape_status)
        .where(Company.last_scrape_status.isnot(None))
        .distinct()
        .order_by(Company.last_scrape_status)
    )
    result = await session.execute(query)
    return [row[0] for row in result.all() if row[0]]


async def get_states(session: AsyncSession) -> list[str]:
    """Get distinct hq_state values from companies (non-null)."""
    query = (
        select(Company.hq_state)
        .where(Company.hq_state.isnot(None))
        .distinct()
        .order_by(Company.hq_state)
    )
    result = await session.execute(query)
    return [row[0] for row in result.all() if row[0]]


async def get_cities_by_state(session: AsyncSession, state: str) -> list[tuple[str, int]]:
    """Get (hq_city, company_count) for companies in the given state. Sorted by count descending (most companies first)."""
    if not (state or state.strip()):
        return []
    state_upper = state.strip().upper()
    cnt = func.count(Company.id).label("cnt")
    query = (
        select(Company.hq_city, cnt)
        .where(
            func.upper(Company.hq_state) == state_upper,
            Company.hq_city.isnot(None),
            Company.hq_city != "",
        )
        .group_by(Company.hq_city)
        .order_by(cnt.desc(), Company.hq_city.asc())
    )
    result = await session.execute(query)
    return [(row[0], row[1]) for row in result.all() if row[0]]

