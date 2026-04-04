from typing import Optional
from pydantic import BaseModel

APPLICATION_STATUSES = ["Applied", "Phone Screen", "Interview", "Offer", "Rejected", "Withdrawn"]


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


class JobApplicationCreateRequest(BaseModel):
    job_url: str
    job_title: Optional[str] = None
    applied_date: str  # YYYY-MM-DD
    status: str = "Applied"
    notes: Optional[str] = None


class JobApplicationUpdateRequest(BaseModel):
    job_url: Optional[str] = None
    job_title: Optional[str] = None
    applied_date: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
