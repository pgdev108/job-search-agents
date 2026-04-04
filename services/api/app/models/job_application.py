from sqlalchemy import Column, Integer, String, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class JobApplication(Base):
    """Tracks job applications submitted by the user."""

    __tablename__ = "job_applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), nullable=False)
    job_url: Mapped[str] = mapped_column(String, nullable=False)
    job_title: Mapped[str | None] = mapped_column(String, nullable=True)
    applied_date: Mapped[str] = mapped_column(String, nullable=False)  # ISO date string YYYY-MM-DD
    status: Mapped[str] = mapped_column(String, nullable=False, default="Applied")
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)

    __table_args__ = (
        Index("idx_job_application_company", "company_id"),
        Index("idx_job_application_status", "status"),
    )
