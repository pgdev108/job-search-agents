"""Scrape run model for bulk refresh orchestration."""
from sqlalchemy import Integer, String, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ScrapeRun(Base):
    """A single bulk scrape run (e.g. all sp500)."""
    
    __tablename__ = "scrape_runs"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    started_at: Mapped[str] = mapped_column(String, nullable=False)  # ISO datetime
    finished_at: Mapped[str | None] = mapped_column(String, nullable=True)  # ISO datetime
    status: Mapped[str] = mapped_column(String, nullable=False)  # running | success | failed | cancelled
    universe: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. sp500
    total_companies: Mapped[int] = mapped_column(Integer, nullable=False)
    success_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    blocked_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    not_found_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[str | None] = mapped_column(String, nullable=True)
    
    __table_args__ = (Index("idx_scrape_run_status", "status"), Index("idx_scrape_run_started", "started_at"))
