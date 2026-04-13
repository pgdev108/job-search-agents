from typing import Optional
from pydantic import BaseModel, Field

APPLICATION_STATUSES = ["To Be Applied", "Applied", "Phone Screen", "Interview", "Offer", "Rejected", "Withdrawn"]


class JobApplicationOut(BaseModel):
    id: int
    company_id: int
    job_url: str
    job_title: Optional[str] = None
    applied_date: str
    status: str
    notes: Optional[str] = None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class JobApplicationWithCompanyOut(JobApplicationOut):
    company_name: str
    company_id: int
    hq_city: Optional[str] = None
    hq_state: Optional[str] = None


class JobApplicationListOut(BaseModel):
    items: list[JobApplicationWithCompanyOut]
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=500)
    total: int = Field(ge=0)
    total_pages: int = Field(ge=0)


class JobApplicationCreateRequest(BaseModel):
    job_url: str
    job_title: Optional[str] = None
    applied_date: str  # YYYY-MM-DD
    status: str = "To Be Applied"
    notes: Optional[str] = None


class JobApplicationUpdateRequest(BaseModel):
    job_url: Optional[str] = None
    job_title: Optional[str] = None
    applied_date: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
