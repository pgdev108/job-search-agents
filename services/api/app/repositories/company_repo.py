"""Company repository for database operations."""
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_

from app.models.company import Company
from app.models.job_application import JobApplication


def _scrape_eligible():
    """Filter condition: company is not marked not_interested and has no career page URL."""
    return and_(
        Company.not_interested == False,  # noqa: E712
        Company.career_page_url.is_(None),
    )


def _universe_contains_like(universe: str):
    """Match if company's universe (comma-separated) contains value as a whole token."""
    raw = (universe or "").strip()
    if not raw:
        return Company.universe.isnot(None)
    safe = raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    like_esc = "\\"
    return or_(
        Company.universe == raw,
        Company.universe.like(safe + ",%", escape=like_esc),
        Company.universe.like("%," + safe + ",%", escape=like_esc),
        Company.universe.like("%," + safe, escape=like_esc),
    )


def _tag_contains_like(tag: str):
    """Match if company's company_tags (comma-separated) contains tag as a whole token."""
    raw = (tag or "").strip()
    if not raw:
        return Company.company_tags.isnot(None)
    safe = raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    like_esc = "\\"
    return or_(
        Company.company_tags == raw,
        Company.company_tags.like(safe + ",%", escape=like_esc),
        Company.company_tags.like("%," + safe + ",%", escape=like_esc),
        Company.company_tags.like("%," + safe, escape=like_esc),
    )


async def list_companies(
    session: AsyncSession,
    search: str | None = None,
    sector: str | None = None,
    universe: str | None = None,
    last_scrape_status: str | None = None,
    state: str | None = None,
    city: str | None = None,
    tag: str | None = None,
    interested_only: bool = True,
    unreviewed_only: bool = False,
    has_applications: str | None = None,
    sort: str = "name_asc",
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[tuple[Company, int]], int]:
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

    if tag:
        conditions.append(_tag_contains_like(tag))
    
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

    if interested_only:
        conditions.append(Company.not_interested == False)  # noqa: E712

    if unreviewed_only:
        conditions.append(Company.career_reviewed == False)  # noqa: E712

    # Application count subquery
    app_count_subq = (
        select(func.count(JobApplication.id))
        .where(JobApplication.company_id == Company.id)
        .correlate(Company)
        .scalar_subquery()
    )

    if has_applications == "yes":
        conditions.append(app_count_subq > 0)
    elif has_applications == "no":
        conditions.append(app_count_subq == 0)

    query = select(Company, app_count_subq.label("applications_count"))

    if conditions:
        query = query.where(and_(*conditions))

    # Apply sorting
    if sort == "job_count_desc":
        query = query.order_by(Company.job_count.desc().nulls_last(), Company.name.asc())
    elif sort == "last_scraped_at_desc":
        query = query.order_by(Company.last_scraped_at.desc().nulls_last(), Company.name.asc())
    else:
        query = query.order_by(Company.name.asc())

    # Total count
    count_query = select(func.count()).select_from(Company)
    if conditions:
        count_query = count_query.where(and_(*conditions))

    total = (await session.execute(count_query)).scalar_one()

    # Pagination
    query = query.limit(page_size).offset((page - 1) * page_size)

    result = await session.execute(query)
    return [(row.Company, row.applications_count) for row in result.all()], total


async def get_company_ids_by_tag(
    session: AsyncSession,
    tag: str,
    limit: int = 6000,
) -> list[int]:
    """
    Get IDs of companies with the given tag that are eligible for career page scraping:
    not marked not_interested, no career_page_url set yet.
    """
    query = (
        select(Company.id)
        .where(
            _tag_contains_like(tag),
            Company.not_interested == False,  # noqa: E712
            Company.career_page_url.is_(None),
        )
        .order_by(Company.id)
        .limit(limit)
    )
    result = await session.execute(query)
    return [row[0] for row in result.all()]


async def get_tickers_for_bulk(
    session: AsyncSession,
    universe: str | None = None,
    tickers: list[str] | None = None,
    limit: int = 6000,
) -> list[str]:
    """
    Get list of tickers for bulk scrape. Excludes ignored companies and manually-set career URLs.
    If tickers provided, return those (up to limit). Else if universe, return all in universe. Else all.
    """
    if tickers:
        seen = set()
        out = []
        for t in tickers:
            t = t.strip().upper()
            if t and t not in seen and len(out) < limit:
                seen.add(t)
                out.append(t)
        return out
    query = select(Company.ticker).where(_scrape_eligible()).order_by(Company.ticker)
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
    Excludes ignored companies and manually-set career URLs.
    """
    not_success = or_(
        Company.last_scrape_status.is_(None),
        func.lower(Company.last_scrape_status) != "success",
    )
    query = (
        select(Company.ticker)
        .where(not_success, _scrape_eligible())
        .order_by(Company.ticker)
        .limit(limit)
    )
    if universe:
        query = query.where(_universe_contains_like(universe))
    result = await session.execute(query)
    return [row[0] for row in result.all()]


_UNSET = object()


async def update_company(
    session: AsyncSession,
    ticker: str,
    career_page_url: object = _UNSET,  # pass _UNSET to leave unchanged
    not_interested: bool | None = None,
    company_tags: object = _UNSET,  # pass _UNSET to leave unchanged; "" clears
) -> Company | None:
    """
    Partial update for not_interested flag, career_page_url, and/or company_tags.
    Passing career_page_url="" clears it. Passing None leaves it unchanged.
    When career_page_url is set to a non-empty value, career_page_source is set to 'manual'.
    When cleared, career_page_source is also cleared.
    """
    company = await get_company_by_ticker(session, ticker)
    if not company:
        return None
    if not_interested is not None:
        company.not_interested = not_interested
    if career_page_url is not _UNSET:
        if career_page_url:
            company.career_page_url = career_page_url.strip()
            company.career_page_source = "manual"
        else:
            company.career_page_url = None
            company.career_page_source = None
    if company_tags is not _UNSET:
        company.company_tags = (company_tags.strip() or None) if company_tags else None
    company.updated_at = datetime.now(timezone.utc).isoformat()
    await session.commit()
    await session.refresh(company)
    return company


async def create_company(
    session: AsyncSession,
    name: str,
    universe: str,
    ticker: str | None = None,
    hq_state: str | None = None,
    hq_city: str | None = None,
    website: str | None = None,
    career_page_url: str | None = None,
) -> Company:
    """Create a new company record."""
    now = datetime.now(timezone.utc).isoformat()
    domain = _extract_domain(website) if website else None
    career_page_source = "manual" if career_page_url else None
    company = Company(
        name=name.strip(),
        universe=universe.strip(),
        ticker=ticker.strip() if ticker else None,
        hq_state=hq_state.strip() if hq_state else None,
        hq_city=hq_city.strip() if hq_city else None,
        website=website.strip() if website else None,
        domain=domain,
        career_page_url=career_page_url.strip() if career_page_url else None,
        career_page_source=career_page_source,
        created_at=now,
        updated_at=now,
    )
    session.add(company)
    await session.commit()
    await session.refresh(company)
    return company


async def get_company_by_ticker(session: AsyncSession, ticker: str) -> Company | None:
    """Get a single company by ticker (case-insensitive)."""
    query = select(Company).where(func.lower(Company.ticker) == ticker.strip().lower())
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def get_company_by_id(session: AsyncSession, company_id: int) -> Company | None:
    """Get a single company by its primary key ID."""
    result = await session.execute(select(Company).where(Company.id == company_id))
    return result.scalar_one_or_none()


def _extract_domain(website: str) -> str | None:
    """Strip scheme, www, and path to get bare domain."""
    if not website:
        return None
    w = website.strip().lower()
    w = w.replace("https://", "").replace("http://", "")
    w = w.lstrip("www.")
    return w.split("/")[0] or None


async def update_company_by_id(
    session: AsyncSession,
    company_id: int,
    career_page_url: object = _UNSET,
    not_interested: bool | None = None,
    career_reviewed: bool | None = None,
    company_tags: object = _UNSET,
    website: object = _UNSET,
    hq_city: object = _UNSET,
    hq_state: object = _UNSET,
    sector: object = _UNSET,
    industry: object = _UNSET,
    description: object = _UNSET,
    founded_year: object = _UNSET,
    company_size: object = _UNSET,
) -> Company | None:
    """Partial update for a company by numeric ID. Pass _UNSET to leave a field unchanged."""
    company = await get_company_by_id(session, company_id)
    if not company:
        return None
    if not_interested is not None:
        company.not_interested = not_interested
    if career_reviewed is not None:
        company.career_reviewed = career_reviewed
    if career_page_url is not _UNSET:
        if career_page_url:
            company.career_page_url = career_page_url.strip()
            company.career_page_source = "manual"
        else:
            company.career_page_url = None
            company.career_page_source = None
    if company_tags is not _UNSET:
        company.company_tags = (company_tags.strip() or None) if company_tags else None
    if website is not _UNSET:
        if website:
            w = website.strip()
            company.website = w if w.startswith("http") else f"https://{w}"
            company.domain = _extract_domain(w)
        else:
            company.website = None
            company.domain = None
    if hq_city is not _UNSET:
        company.hq_city = hq_city.strip() or None if hq_city else None
    if hq_state is not _UNSET:
        company.hq_state = hq_state.strip().upper() or None if hq_state else None
    if sector is not _UNSET:
        company.sector = sector.strip() or None if sector else None
    if industry is not _UNSET:
        company.industry = industry.strip() or None if industry else None
    if description is not _UNSET:
        company.description = description.strip() or None if description else None
    if founded_year is not _UNSET:
        company.founded_year = founded_year
    if company_size is not _UNSET:
        company.company_size = company_size.strip() or None if company_size else None
    company.updated_at = datetime.now(timezone.utc).isoformat()
    await session.commit()
    await session.refresh(company)
    return company


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


async def get_scrape_status_counts(session: AsyncSession) -> dict[str, int]:
    """Return count of companies per last_scrape_status, including 'never' for NULL."""
    cnt = func.count(Company.id).label("cnt")
    query = (
        select(Company.last_scrape_status, cnt)
        .group_by(Company.last_scrape_status)
    )
    result = await session.execute(query)
    counts: dict[str, int] = {}
    for row in result.all():
        key = row[0] if row[0] is not None else "never"
        counts[key] = row[1]
    return counts


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



async def get_all_tags(session: AsyncSession) -> list[str]:
    """Get all tag names from the tags table, sorted alphabetically."""
    from app.models.tag import Tag
    result = await session.execute(select(Tag.name).order_by(Tag.name))
    return [r[0] for r in result.all()]


async def create_tag(session: AsyncSession, name: str) -> bool:
    """Create a new tag. Returns True if created, False if already exists."""
    from app.models.tag import Tag
    from datetime import datetime, timezone
    existing = await session.execute(select(Tag).where(Tag.name == name.strip().lower()))
    if existing.scalar_one_or_none():
        return False
    session.add(Tag(name=name.strip().lower(), created_at=datetime.now(timezone.utc).isoformat()))
    await session.commit()
    return True


async def delete_tag(session: AsyncSession, name: str) -> bool:
    """
    Delete a tag by name. Also removes the tag token from all companies' company_tags.
    Returns True if the tag existed and was deleted, False if not found.
    """
    from app.models.tag import Tag
    name = name.strip().lower()
    tag_row = (await session.execute(select(Tag).where(Tag.name == name))).scalar_one_or_none()
    if not tag_row:
        return False
    await session.delete(tag_row)

    # Strip the tag token from all companies that have it
    result = await session.execute(
        select(Company).where(_tag_contains_like(name))
    )
    companies = result.scalars().all()
    for company in companies:
        if not company.company_tags:
            continue
        tokens = [t.strip() for t in company.company_tags.split(",") if t.strip() and t.strip() != name]
        company.company_tags = ",".join(tokens) if tokens else None
        company.updated_at = datetime.now(timezone.utc).isoformat()

    await session.commit()
    return True
