from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from pathlib import Path

from app.core.config import settings

# SQLite database path
DB_PATH = Path(__file__).parent.parent.parent / "data" / "app.db"
DB_URL = f"sqlite+aiosqlite:///{DB_PATH}"

# Create async engine
engine = create_async_engine(
    DB_URL,
    echo=False,  # Set to True for SQL query logging
    future=True,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncSession:
    """Dependency for getting database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

