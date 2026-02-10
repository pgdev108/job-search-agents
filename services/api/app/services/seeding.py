"""Service for seeding companies from sources."""
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.company import Company
from app.sources.base import CompanySource, CompanySeedRecord


class SeedResult:
    """Result of a seeding operation."""
    
    def __init__(self, source: str, inserted: int, updated: int, total: int):
        self.source = source
        self.inserted = inserted
        self.updated = updated
        self.total = total


async def seed_companies(
    session: AsyncSession,
    source: CompanySource,
    source_name: str = "unknown",
) -> SeedResult:
    """
    Seed companies from a source using upsert logic.
    
    Args:
        session: Database session
        source: CompanySource instance
        source_name: Name of the source (for result)
    
    Returns:
        SeedResult with counts
    """
    # Fetch records from source
    records = source.fetch()
    
    inserted = 0
    updated = 0
    now = datetime.utcnow().isoformat()
    
    for record in records:
        # Check if company exists by ticker
        result = await session.execute(
            select(Company).where(Company.ticker == record.ticker)
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            # Update existing company
            # Do NOT overwrite: career_page_url, job_count, last_scraped_at, last_scrape_status, last_scrape_error
            existing.name = record.name
            existing.sector = record.sector
            existing.industry = record.industry
            existing.universe = record.universe
            existing.hq_location = record.hq_location
            existing.country = record.country
            existing.updated_at = now
            updated += 1
        else:
            # Insert new company
            company = Company(
                name=record.name,
                ticker=record.ticker,
                sector=record.sector,
                industry=record.industry,
                hq_location=record.hq_location,
                country=record.country,
                universe=record.universe,
                created_at=now,
                updated_at=now,
            )
            session.add(company)
            inserted += 1
    
    await session.commit()
    
    return SeedResult(
        source=source_name,
        inserted=inserted,
        updated=updated,
        total=len(records),
    )

