"""Repository for bay_area_companies table."""
import csv
import io
from datetime import datetime, timezone
from math import ceil

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_

from app.models.bay_area_company import BayAreaCompany


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _extract_domain(website: str) -> str | None:
    """Extract bare domain from a website URL or domain string."""
    if not website:
        return None
    w = website.strip().lower()
    # Remove scheme
    for prefix in ("https://", "http://"):
        if w.startswith(prefix):
            w = w[len(prefix):]
    # Remove www.
    if w.startswith("www."):
        w = w[4:]
    # Remove path
    w = w.split("/")[0].split("?")[0].strip()
    return w or None


def _parse_hq(address: str) -> tuple[str | None, str | None]:
    """Best-effort parse of 'City, ST ZIP' from an address string."""
    if not address:
        return None, None
    parts = [p.strip() for p in address.split(",")]
    if len(parts) >= 2:
        city = parts[-2].strip()
        # Last part is "ST ZIP" or just "ST"
        state_zip = parts[-1].strip().split()
        state = state_zip[0] if state_zip else None
        return city or None, state or None
    return None, None


def _parse_float(val: str) -> float | None:
    try:
        return float(val) if val and val.strip() else None
    except ValueError:
        return None


def _parse_int(val: str) -> int | None:
    try:
        return int(val) if val and val.strip() else None
    except ValueError:
        return None


async def upsert_from_csv(session: AsyncSession, csv_text: str) -> dict:
    """
    Parse CSV content and upsert into bay_area_companies.
    Matches on domain (unique key). Falls back to name if domain is None.
    Returns {"inserted": N, "updated": N, "total": N}.
    """
    reader = csv.DictReader(io.StringIO(csv_text))
    inserted = 0
    updated = 0

    for row in reader:
        name = (row.get("Company Name") or "").strip()
        if not name:
            continue

        website = (row.get("Website") or "").strip()
        domain = _extract_domain(website)
        tags = (row.get("Tags") or "").strip() or None
        location = (row.get("Location") or "").strip() or None
        investors = (row.get("Investors") or "").strip() or None
        description = (row.get("Description") or "").strip() or None
        founded_year = _parse_int(row.get("Founded Year", ""))
        address = (row.get("Address") or "").strip() or None
        lat = _parse_float(row.get("Lat", ""))
        long_ = _parse_float(row.get("Long", ""))
        company_size = (row.get("Company Size") or "").strip() or None
        tech_stack = (row.get("Tech stack") or "").strip() or None
        marketing_stack = (row.get("Marketing Stack") or "").strip() or None

        hq_city, hq_state = _parse_hq(address or "")

        # Try to find existing record by domain first, then by name
        existing: BayAreaCompany | None = None
        if domain:
            result = await session.execute(
                select(BayAreaCompany).where(BayAreaCompany.domain == domain)
            )
            existing = result.scalar_one_or_none()

        if existing is None:
            result = await session.execute(
                select(BayAreaCompany).where(
                    func.lower(BayAreaCompany.name) == name.lower()
                )
            )
            existing = result.scalar_one_or_none()

        now = _now_iso()
        if existing:
            existing.name = name
            existing.tags = tags
            existing.location = location
            existing.investors = investors
            existing.description = description
            existing.website = website or None
            existing.domain = domain
            existing.founded_year = founded_year
            existing.address = address
            existing.hq_city = hq_city
            existing.hq_state = hq_state
            existing.lat = lat
            existing.long = long_
            existing.company_size = company_size
            existing.tech_stack = tech_stack
            existing.marketing_stack = marketing_stack
            existing.updated_at = now
            updated += 1
        else:
            company = BayAreaCompany(
                name=name,
                tags=tags,
                location=location,
                investors=investors,
                description=description,
                website=website or None,
                domain=domain,
                founded_year=founded_year,
                address=address,
                hq_city=hq_city,
                hq_state=hq_state,
                lat=lat,
                long=long_,
                company_size=company_size,
                tech_stack=tech_stack,
                marketing_stack=marketing_stack,
                created_at=now,
                updated_at=now,
            )
            session.add(company)
            await session.flush()
            inserted += 1

    await session.commit()
    return {"inserted": inserted, "updated": updated, "total": inserted + updated}


async def list_companies(
    session: AsyncSession,
    search: str | None = None,
    location: str | None = None,
    tag: str | None = None,
    company_size: str | None = None,
    sort: str = "name_asc",
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[BayAreaCompany], int]:
    """
    List bay area companies with filtering, sorting, and pagination.
    Returns (companies, total_count).
    """
    conditions = []

    if search:
        term = f"%{search.lower()}%"
        conditions.append(
            or_(
                func.lower(BayAreaCompany.name).like(term),
                func.lower(BayAreaCompany.description).like(term),
            )
        )

    if location:
        conditions.append(
            func.lower(BayAreaCompany.location) == location.strip().lower()
        )

    if tag:
        raw = tag.strip()
        safe = raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        esc = "\\"
        conditions.append(
            or_(
                BayAreaCompany.tags == raw,
                BayAreaCompany.tags.like(safe + ",%", escape=esc),
                BayAreaCompany.tags.like("%," + safe + ",%", escape=esc),
                BayAreaCompany.tags.like("%," + safe, escape=esc),
            )
        )

    if company_size:
        conditions.append(BayAreaCompany.company_size == company_size.strip())

    query = select(BayAreaCompany)
    count_query = select(func.count()).select_from(BayAreaCompany)

    if conditions:
        query = query.where(and_(*conditions))
        count_query = count_query.where(and_(*conditions))

    if sort == "name_asc":
        query = query.order_by(BayAreaCompany.name.asc())
    elif sort == "founded_desc":
        query = query.order_by(BayAreaCompany.founded_year.desc().nulls_last(), BayAreaCompany.name.asc())
    elif sort == "founded_asc":
        query = query.order_by(BayAreaCompany.founded_year.asc().nulls_last(), BayAreaCompany.name.asc())
    else:
        query = query.order_by(BayAreaCompany.name.asc())

    total = (await session.execute(count_query)).scalar_one()
    query = query.limit(page_size).offset((page - 1) * page_size)
    result = await session.execute(query)
    return list(result.scalars().all()), total


async def get_locations(session: AsyncSession) -> list[str]:
    """Distinct location values."""
    result = await session.execute(
        select(BayAreaCompany.location)
        .where(BayAreaCompany.location.isnot(None))
        .distinct()
        .order_by(BayAreaCompany.location)
    )
    return [r[0] for r in result.all() if r[0]]


async def get_tags(session: AsyncSession) -> list[str]:
    """Distinct tag tokens (unpacked from comma-separated)."""
    result = await session.execute(
        select(BayAreaCompany.tags).where(BayAreaCompany.tags.isnot(None))
    )
    tokens: set[str] = set()
    for (tags,) in result.all():
        if tags:
            for t in tags.split(","):
                t = t.strip()
                if t:
                    tokens.add(t)
    return sorted(tokens)


async def get_company_sizes(session: AsyncSession) -> list[str]:
    """Distinct company_size values, ordered sensibly."""
    result = await session.execute(
        select(BayAreaCompany.company_size)
        .where(BayAreaCompany.company_size.isnot(None))
        .where(BayAreaCompany.company_size != "")
        .distinct()
    )
    sizes = [r[0] for r in result.all() if r[0]]
    # Sort by the lower bound of the range
    def _sort_key(s: str) -> int:
        try:
            return int(s.split("-")[0].replace("+", ""))
        except Exception:
            return 9999
    return sorted(sizes, key=_sort_key)
