"""Database initialization and seeding."""
import asyncio
from datetime import datetime
from pathlib import Path

from sqlalchemy import select, text, inspect

from app.db.base import Base
from app.db.session import engine, AsyncSessionLocal
from app.models.company import Company
from app.models.scrape_event import CompanyScrapeEvent
from app.models.scrape_run import ScrapeRun
from app.models.job_application import JobApplication  # noqa: F401 — ensures table is registered
from app.models.bay_area_company import BayAreaCompany  # noqa: F401 — ensures table is registered
from app.models.tag import Tag  # noqa: F401 — ensures table is registered


async def create_tables():
    """Create all database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def migrate_company_scrape_columns():
    """Add career_page_source and job_count_extraction_method if missing."""
    async with engine.begin() as conn:
        for col_name in ("career_page_source", "job_count_extraction_method"):
            try:
                await conn.execute(text(f"ALTER TABLE companies ADD COLUMN {col_name} TEXT"))
            except Exception:
                pass


async def migrate_hq_city_state_columns():
    """Add hq_city and hq_state to companies."""
    async with engine.begin() as conn:
        for col_name in ("hq_city", "hq_state"):
            try:
                await conn.execute(text(f"ALTER TABLE companies ADD COLUMN {col_name} TEXT"))
            except Exception:
                pass


async def migrate_not_interested_column():
    """Add not_interested column to companies if missing."""
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE companies ADD COLUMN not_interested INTEGER NOT NULL DEFAULT 0"))
        except Exception:
            pass


async def migrate_company_enrichment_columns():
    """Add enrichment + company_tags columns to companies if missing."""
    cols = [
        "description TEXT",
        "website TEXT",
        "domain TEXT",
        "founded_year INTEGER",
        "company_size TEXT",
        "company_tags TEXT",
    ]
    async with engine.begin() as conn:
        for col_def in cols:
            try:
                await conn.execute(text(f"ALTER TABLE companies ADD COLUMN {col_def}"))
            except Exception:
                pass
        # Index for company_tags
        try:
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_company_tags ON companies(company_tags)"))
        except Exception:
            pass


async def seed_tags():
    """Ensure default tags exist in the tags table."""
    from app.models.tag import Tag
    default_tags = ["bay_area"]
    now = datetime.utcnow().isoformat()
    async with AsyncSessionLocal() as session:
        for name in default_tags:
            existing = await session.execute(
                select(Tag).where(Tag.name == name)
            )
            if existing.scalar_one_or_none() is None:
                session.add(Tag(name=name, created_at=now))
        await session.commit()


async def migrate_scrape_run_columns():
    """Add run_id to company_scrape_events and last_run_id to companies."""
    async with engine.begin() as conn:
        # company_scrape_events.run_id
        try:
            await conn.execute(text("ALTER TABLE company_scrape_events ADD COLUMN run_id INTEGER"))
        except Exception:
            pass
        try:
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_scrape_event_run ON company_scrape_events(run_id)"))
        except Exception:
            pass
        # companies.last_run_id
        try:
            await conn.execute(text("ALTER TABLE companies ADD COLUMN last_run_id INTEGER"))
        except Exception:
            pass


async def migrate_add_universe_column():
    """Add universe column if it doesn't exist (lightweight migration)."""
    async with engine.begin() as conn:
        # Check if universe column exists
        try:
            inspector = await conn.run_sync(lambda sync_conn: inspect(sync_conn))
            columns = [col['name'] for col in inspector.get_columns('companies')]
        except Exception:
            # Table might not exist yet, skip migration (will be created with column)
            return
        
        if 'universe' not in columns:
            # SQLite: Add column as nullable first, then update, then we can't make it NOT NULL easily
            # So we'll add it as nullable and handle defaults in application code
            await conn.execute(text("ALTER TABLE companies ADD COLUMN universe TEXT"))
            # Update existing rows to have universe='sample'
            await conn.execute(text("UPDATE companies SET universe = 'sample' WHERE universe IS NULL"))
            # Create index
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_company_universe ON companies(universe)"))


async def seed_companies():
    """Seed companies table with tiny sample data if empty (only if no internet/real seed available)."""
    async with AsyncSessionLocal() as session:
        # Check if companies table exists and has data
        result = await session.execute(select(Company).limit(1))
        if result.scalar_one_or_none() is not None:
            # Table already has data, skip seeding
            return
        
        # Tiny sample (5 companies only) for offline testing
        now = datetime.utcnow().isoformat()
        companies_data = [
            {
                "name": "Apple Inc.",
                "ticker": "AAPL",
                "sector": "Technology",
                "industry": "Consumer Electronics",
                "hq_location": "Cupertino, CA",
                "country": "USA",
                "universe": "sample",
                "created_at": now,
                "updated_at": now,
            },
            {
                "name": "Microsoft Corporation",
                "ticker": "MSFT",
                "sector": "Technology",
                "industry": "Software",
                "hq_location": "Redmond, WA",
                "country": "USA",
                "universe": "sample",
                "created_at": now,
                "updated_at": now,
            },
            {
                "name": "Amazon.com Inc.",
                "ticker": "AMZN",
                "sector": "Consumer Cyclical",
                "industry": "E-commerce",
                "hq_location": "Seattle, WA",
                "country": "USA",
                "universe": "sample",
                "created_at": now,
                "updated_at": now,
            },
            {
                "name": "Alphabet Inc.",
                "ticker": "GOOGL",
                "sector": "Technology",
                "industry": "Internet Content & Information",
                "hq_location": "Mountain View, CA",
                "country": "USA",
                "universe": "sample",
                "created_at": now,
                "updated_at": now,
            },
            {
                "name": "Meta Platforms Inc.",
                "ticker": "META",
                "sector": "Technology",
                "industry": "Social Media",
                "hq_location": "Menlo Park, CA",
                "country": "USA",
                "universe": "sample",
                "created_at": now,
                "updated_at": now,
            },
        ]
        
        # Insert companies
        for company_data in companies_data:
            company = Company(**company_data)
            session.add(company)
        
        await session.commit()


async def init_db():
    """Initialize database: create tables, migrate, and seed if needed."""
    # Ensure data directory exists
    db_path = Path(__file__).parent.parent.parent / "data"
    db_path.mkdir(exist_ok=True)
    
    # Create tables (includes company_scrape_events via Base.metadata)
    await create_tables()
    
    # Run migrations
    await migrate_add_universe_column()
    await migrate_company_scrape_columns()
    await migrate_hq_city_state_columns()
    await migrate_scrape_run_columns()
    await migrate_not_interested_column()
    await migrate_company_enrichment_columns()

    # Seed reference data
    await seed_tags()

    # Seed tiny sample if table is empty (only for offline testing)
    await seed_companies()

