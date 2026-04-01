from pydantic import BaseModel, Field
from typing import Optional


class CompanyOut(BaseModel):
    """Company output schema."""
    
    id: int
    name: str
    ticker: str
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
    universe: str
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


class CityCountOut(BaseModel):
    """City name and company count for filter dropdown."""
    city: str
    count: int

