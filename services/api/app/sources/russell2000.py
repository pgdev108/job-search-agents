"""Russell 2000 Index components data source (~2000 small-cap companies)."""
import csv
import io

import requests

from app.sources.base import CompanySeedRecord, CompanySource

# Public CSV of Russell 2000 constituents (may be periodically updated by maintainers)
CSV_URL = "https://raw.githubusercontent.com/ikoniaris/Russell2000/master/russell_2000_components.csv"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
UNIVERSE = "russell2000"


def _normalize_ticker(ticker: str) -> str:
    return (ticker or "").strip().upper()


def _clean_name(name: str) -> str:
    return " ".join((name or "").split()).strip() or ""


class Russell2000Source:
    """Source for Russell 2000 Index components (~2000 companies). Fetches from a public CSV."""

    def fetch(self) -> list[CompanySeedRecord]:
        """Fetch Russell 2000 constituents from CSV."""
        try:
            return self._fetch_from_csv()
        except Exception as e:
            raise Exception(f"Failed to fetch Russell 2000 data: {e}") from e

    def _fetch_from_csv(self) -> list[CompanySeedRecord]:
        headers = {"User-Agent": USER_AGENT}
        response = requests.get(CSV_URL, timeout=30, headers=headers)
        response.raise_for_status()
        text = response.text

        reader = csv.DictReader(io.StringIO(text), skipinitialspace=True)
        fieldnames = {f.strip().lower(): f for f in (reader.fieldnames or [])}
        ticker_key = fieldnames.get("ticker", "Ticker")
        name_key = fieldnames.get("name", "Name")
        companies = []
        for row in reader:
            ticker = _normalize_ticker(row.get(ticker_key, ""))
            name = _clean_name(row.get(name_key, ""))
            if not ticker or not name:
                continue
            if ticker in ("TICKER", "SYMBOL") or name.upper() in ("NAME", "COMPANY"):
                continue
            companies.append(
                CompanySeedRecord(
                    name=name,
                    ticker=ticker,
                    sector=None,
                    industry=None,
                    country="USA",
                    hq_location=None,
                    universe=UNIVERSE,
                )
            )

        if len(companies) < 1500:
            raise Exception(
                f"Expected ~2000 Russell 2000 components, got {len(companies)}. "
                "Source CSV may be incomplete or format changed."
            )
        return companies[:2500]
