"""Admin API routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.seeding import seed_companies
from app.sources.sp500 import Sp500Source
from app.sources.dow_jones import DowJonesSource
from app.sources.nasdaq100 import Nasdaq100Source
from app.sources.russell2000 import Russell2000Source

router = APIRouter()


def _seed_response(result):
    return {
        "source": result.source,
        "inserted": result.inserted,
        "updated": result.updated,
        "total": result.total,
    }


@router.post("/admin/seed/sp500")
async def seed_sp500(db: AsyncSession = Depends(get_db)):
    """Seed S&P 500 companies. Existing companies get universe merged (e.g. sp500,dow_jones)."""
    try:
        source = Sp500Source()
        result = await seed_companies(db, source, source_name="sp500")
        return _seed_response(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to seed S&P 500: {str(e)}")


@router.post("/admin/seed/dow_jones")
async def seed_dow_jones(db: AsyncSession = Depends(get_db)):
    """Seed Dow Jones Industrial Average (30) companies. Merges universe for existing tickers."""
    try:
        source = DowJonesSource()
        result = await seed_companies(db, source, source_name="dow_jones")
        return _seed_response(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to seed Dow Jones: {str(e)}")


@router.post("/admin/seed/nasdaq100")
async def seed_nasdaq100(db: AsyncSession = Depends(get_db)):
    """Seed Nasdaq-100 companies. Merges universe for existing tickers (e.g. sp500,nasdaq100)."""
    try:
        source = Nasdaq100Source()
        result = await seed_companies(db, source, source_name="nasdaq100")
        return _seed_response(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to seed Nasdaq-100: {str(e)}")


@router.post("/admin/seed/russell2000")
async def seed_russell2000(db: AsyncSession = Depends(get_db)):
    """Seed Russell 2000 Index companies (~2000 small-cap). Merges universe for existing tickers."""
    try:
        source = Russell2000Source()
        result = await seed_companies(db, source, source_name="russell2000")
        return _seed_response(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to seed Russell 2000: {str(e)}")

