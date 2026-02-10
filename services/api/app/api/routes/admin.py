"""Admin API routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.seeding import seed_companies
from app.sources.sp500 import Sp500Source

router = APIRouter()


@router.post("/admin/seed/sp500")
async def seed_sp500(
    db: AsyncSession = Depends(get_db),
):
    """
    Seed S&P 500 companies into the database.
    
    This endpoint fetches S&P 500 company data and upserts it into the companies table.
    """
    try:
        source = Sp500Source()
        result = await seed_companies(db, source, source_name="sp500")
        
        return {
            "source": result.source,
            "inserted": result.inserted,
            "updated": result.updated,
            "total": result.total,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to seed S&P 500 companies: {str(e)}"
        )

