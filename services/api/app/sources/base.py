"""Base classes for company data sources."""
from typing import Protocol
from pydantic import BaseModel


class CompanySeedRecord(BaseModel):
    """Record for seeding a company into the database."""
    
    name: str
    ticker: str
    sector: str | None = None
    industry: str | None = None
    country: str = "USA"
    hq_location: str | None = None
    universe: str


class CompanySource(Protocol):
    """Protocol for company data sources."""
    
    def fetch(self) -> list[CompanySeedRecord]:
        """
        Fetch company records from the source.
        
        Returns:
            List of CompanySeedRecord objects
        """
        ...

