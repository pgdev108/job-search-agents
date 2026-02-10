"""Database initialization and seeding."""
import asyncio
from datetime import datetime
from pathlib import Path

from sqlalchemy import select, text, inspect

from app.db.base import Base
from app.db.session import engine, AsyncSessionLocal
from app.models.company import Company


async def create_tables():
    """Create all database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


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
    
    # Create tables
    await create_tables()
    
    # Run migrations
    await migrate_add_universe_column()
    
    # Seed tiny sample if table is empty (only for offline testing)
    await seed_companies()

