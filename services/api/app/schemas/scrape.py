"""Pydantic schemas for scrape pipeline (career discovery, job count, API response)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl

from app.schemas.company import CompanyOut


class CareerDiscoveryResult(BaseModel):
    """Output from career page discovery agent."""
    career_page_url: HttpUrl
    confidence: float = Field(ge=0, le=1, description="Confidence 0-1")
    alternate_urls: list[HttpUrl] = Field(default_factory=list)
    notes: str = ""
    hq_city: str | None = None
    hq_state: str | None = None  # state/province code e.g. IL, CA


class JobCountResult(BaseModel):
    """Result from job count extraction (Playwright)."""
    job_count: int | None = None
    method: str  # greenhouse_dom | lever_dom | workday_heuristic | generic_dom | regex_text
    evidence: str = ""
    status: Literal["success", "failed", "blocked", "not_found"]
    error: str = ""


class CompanyScrapeResponse(BaseModel):
    """API response for POST /scrape/company/{ticker}."""
    company: CompanyOut
    discovery: CareerDiscoveryResult | None = None
    job_count: JobCountResult | None = None


class ScrapeRunOut(BaseModel):
    """Scrape run summary (for POST /scrape/all and list)."""
    id: int
    started_at: str
    finished_at: str | None = None
    status: str  # running | success | failed | cancelled
    universe: str | None = None
    total_companies: int
    success_count: int = 0
    failed_count: int = 0
    blocked_count: int = 0
    not_found_count: int = 0
    last_error: str | None = None

    model_config = {"from_attributes": True}


class ScrapeRunDetailOut(ScrapeRunOut):
    """Run detail with derived progress fields."""
    processed: int = 0  # success + failed + blocked + not_found
    remaining: int = 0
    percent_complete: float = 0.0


class ScrapeAllRequest(BaseModel):
    """Request body for POST /scrape/all."""
    universe: str | None = None
    tickers: list[str] | None = None
    failed_only: bool = False  # if True, only scrape companies where last_scrape_status != 'success'
    page_size: int | None = None  # ignored, for UI
