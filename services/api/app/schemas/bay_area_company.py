from pydantic import BaseModel, Field
from typing import Optional


class BayAreaCompanyOut(BaseModel):
    id: int
    name: str
    tags: Optional[str] = None
    location: Optional[str] = None
    investors: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None
    domain: Optional[str] = None
    founded_year: Optional[int] = None
    address: Optional[str] = None
    hq_city: Optional[str] = None
    hq_state: Optional[str] = None
    lat: Optional[float] = None
    long: Optional[float] = None
    company_size: Optional[str] = None
    tech_stack: Optional[str] = None
    marketing_stack: Optional[str] = None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class BayAreaCompanyListOut(BaseModel):
    items: list[BayAreaCompanyOut]
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=500)
    total: int = Field(ge=0)
    total_pages: int = Field(ge=0)


class BayAreaSeedResult(BaseModel):
    inserted: int
    updated: int
    total: int
