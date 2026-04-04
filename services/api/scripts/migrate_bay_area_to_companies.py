"""
One-time migration: merge bay_area_companies into companies table.

- 20 name-matched public companies: enrich with description/website/domain/
  founded_year/company_size, set company_tags='bay_area', leave universe unchanged.
- 734 unmatched private companies: insert with universe='private',
  company_tags='bay_area', ticker=NULL.
  First tag -> sector, second tag -> industry.
"""
import asyncio
import sys
from pathlib import Path

# Make sure app is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import datetime, timezone
from sqlalchemy import select, func

from app.db.session import AsyncSessionLocal
from app.db.init_db import init_db
from app.models.company import Company
from app.models.bay_area_company import BayAreaCompany


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _first_tag(tags: str | None) -> str | None:
    if not tags:
        return None
    parts = [t.strip() for t in tags.split(",") if t.strip()]
    return parts[0] if parts else None


def _second_tag(tags: str | None) -> str | None:
    if not tags:
        return None
    parts = [t.strip() for t in tags.split(",") if t.strip()]
    return parts[1] if len(parts) > 1 else None


async def run():
    await init_db()

    async with AsyncSessionLocal() as session:
        # Load all bay_area companies
        result = await session.execute(select(BayAreaCompany))
        bay_companies = result.scalars().all()

        enriched = 0
        inserted = 0

        for bay in bay_companies:
            # Try to find a match in companies by name (case-insensitive)
            match_result = await session.execute(
                select(Company).where(
                    func.lower(Company.name) == bay.name.strip().lower()
                )
            )
            existing: Company | None = match_result.scalar_one_or_none()

            if existing:
                # Enrich public company, tag as bay_area, keep universe
                if not existing.description and bay.description:
                    existing.description = bay.description
                if not existing.website and bay.website:
                    existing.website = bay.website
                if not existing.domain and bay.domain:
                    existing.domain = bay.domain
                if not existing.founded_year and bay.founded_year:
                    existing.founded_year = bay.founded_year
                if not existing.company_size and bay.company_size:
                    existing.company_size = bay.company_size
                if not existing.hq_city and bay.hq_city:
                    existing.hq_city = bay.hq_city
                if not existing.hq_state and bay.hq_state:
                    existing.hq_state = bay.hq_state
                # Set/merge company_tags
                existing_tags = set(t.strip() for t in (existing.company_tags or "").split(",") if t.strip())
                existing_tags.add("bay_area")
                existing.company_tags = ",".join(sorted(existing_tags))
                existing.updated_at = _now_iso()
                enriched += 1
            else:
                # Insert as private company
                now = _now_iso()
                company = Company(
                    name=bay.name.strip(),
                    ticker=None,
                    sector=_first_tag(bay.tags),
                    industry=_second_tag(bay.tags),
                    hq_city=bay.hq_city,
                    hq_state=bay.hq_state,
                    hq_location=", ".join(p for p in [bay.hq_city, bay.hq_state] if p) or None,
                    country="USA",
                    universe="private",
                    company_tags="bay_area",
                    description=bay.description,
                    website=bay.website,
                    domain=bay.domain,
                    founded_year=bay.founded_year,
                    company_size=bay.company_size,
                    not_interested=False,
                    created_at=now,
                    updated_at=now,
                )
                session.add(company)
                inserted += 1

        await session.commit()
        print(f"Done — enriched: {enriched}, inserted: {inserted}, total processed: {enriched + inserted}")


if __name__ == "__main__":
    asyncio.run(run())
