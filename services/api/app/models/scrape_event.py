"""Company scrape event model for logging scrape pipeline events."""
from sqlalchemy import Column, Integer, String, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CompanyScrapeEvent(Base):
    """Log events from the scrape pipeline (discover_career_page, count_jobs, error)."""
    
    __tablename__ = "company_scrape_events"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    run_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)  # scrape_runs.id
    event_time: Mapped[str] = mapped_column(String, nullable=False)  # ISO datetime
    event_type: Mapped[str] = mapped_column(String, nullable=False)  # discover_career_page | count_jobs | error
    payload_json: Mapped[str | None] = mapped_column(String, nullable=True)
    
    __table_args__ = (
        Index("idx_scrape_event_company_time", "company_id", "event_time"),
        Index("idx_scrape_event_run", "run_id"),
    )
