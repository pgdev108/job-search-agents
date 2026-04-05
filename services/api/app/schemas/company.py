from pydantic import BaseModel, Field
from typing import Optional


class CompanyOut(BaseModel):
    """Company output schema."""

    id: int
    name: str
    ticker: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    hq_location: Optional[str] = None
    hq_city: Optional[str] = None
    hq_state: Optional[str] = None
    country: Optional[str] = None
    career_page_url: Optional[str] = None
    career_page_source: Optional[str] = None
    job_count: Optional[int] = None
    job_count_extraction_method: Optional[str] = None
    last_scraped_at: Optional[str] = None
    last_scrape_status: Optional[str] = None
    last_scrape_error: Optional[str] = None
    not_interested: bool = False
    applications_count: int = 0
    universe: str
    description: Optional[str] = None
    website: Optional[str] = None
    domain: Optional[str] = None
    founded_year: Optional[int] = None
    company_size: Optional[str] = None
    company_tags: Optional[str] = None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class CompanyListOut(BaseModel):
    """Paginated company list output schema."""
    
    items: list[CompanyOut]
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=500)
    total: int = Field(ge=0)
    total_pages: int = Field(ge=0)


class CompanyUpdateRequest(BaseModel):
    """Request body for PATCH /companies/{id}."""
    career_page_url: Optional[str] = None  # set to "" to clear
    not_interested: Optional[bool] = None
    company_tags: Optional[str] = None     # comma-separated tag names, set to "" to clear
    website: Optional[str] = None          # set to "" to clear
    hq_city: Optional[str] = None
    hq_state: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    founded_year: Optional[int] = None
    company_size: Optional[str] = None


class CityCountOut(BaseModel):
    """City name and company count for filter dropdown."""
    city: str
    count: int

