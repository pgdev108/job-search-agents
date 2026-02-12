"""Scrape pipeline API: single-company refresh (career discovery + job count)."""
from fastapi import APIRouter, Depends, HTTPException

from app.db.session import get_db
from app.repositories import company_repo
from app.schemas.company import CompanyOut
from app.schemas.scrape import CompanyScrapeResponse
from app.services.scrape_service import scrape_company_by_ticker
from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/scrape", tags=["scrape"])


@router.post("/company/{ticker}", response_model=CompanyScrapeResponse)
async def scrape_company(
    ticker: str,
    db: AsyncSession = Depends(get_db),
) -> CompanyScrapeResponse:
    """
    Run career page discovery (OpenAI Agent) + job count extraction (Playwright) for one company.
    Requires OPENAI_API_KEY. Returns updated company and discovery/job_count results.
    """
    try:
        settings.require_openai_key()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    result = await scrape_company_by_ticker(ticker, db)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Company with ticker '{ticker}' not found")
    return result
