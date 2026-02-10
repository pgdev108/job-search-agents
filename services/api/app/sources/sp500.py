"""S&P 500 company data source."""
import csv
import io
import requests

from app.sources.base import CompanySeedRecord, CompanySource


class Sp500Source:
    """Source for fetching S&P 500 company data."""
    
    def fetch(self) -> list[CompanySeedRecord]:
        """
        Fetch S&P 500 companies from a reliable public source.
        
        Returns:
            List of CompanySeedRecord objects
        """
        # Try multiple reliable sources in order
        sources = [
            self._fetch_from_github_dataset,  # Try GitHub first (more reliable)
            self._fetch_from_wikipedia_csv,
        ]
        
        last_error = None
        for source_func in sources:
            try:
                companies = source_func()
                if companies and len(companies) > 0:
                    return companies
            except Exception as e:
                last_error = e
                continue
        
        error_msg = "Failed to fetch S&P 500 data from all available sources"
        if last_error:
            error_msg += f": {str(last_error)}"
        raise Exception(error_msg)
        
        raise Exception("Failed to fetch S&P 500 data from all available sources")
    
    def _fetch_from_wikipedia_csv(self) -> list[CompanySeedRecord]:
        """
        Fetch from Wikipedia using a more reliable method.
        Use Wikipedia's API to get structured data.
        """
        # Use Wikipedia's API to get the page source, then parse the first table
        import re
        import html
        
        # Get the Wikipedia page
        url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, timeout=20, headers=headers)
        response.raise_for_status()
        
        html_content = response.text
        
        # Find the first table (the main S&P 500 table)
        # Wikipedia tables are wrapped in <table class="wikitable">
        table_match = re.search(r'<table[^>]*class="wikitable"[^>]*>(.*?)</table>', html_content, re.DOTALL)
        if not table_match:
            raise Exception("Could not find S&P 500 table in Wikipedia page")
        
        table_html = table_match.group(1)
        
        # Extract rows
        row_pattern = r'<tr[^>]*>(.*?)</tr>'
        rows = re.findall(row_pattern, table_html, re.DOTALL)
        
        companies = []
        for row in rows[1:]:  # Skip header row
            # Extract cells - handle both <td> and <th>
            cell_pattern = r'<t[dh][^>]*>(.*?)</t[dh]>'
            cells = re.findall(cell_pattern, row, re.DOTALL)
            
            if len(cells) < 2:
                continue
            
            def clean_html(text: str) -> str:
                # Remove HTML tags
                text = re.sub(r'<[^>]+>', '', text)
                # Remove reference links like [1]
                text = re.sub(r'\[\d+\]', '', text)
                # Decode HTML entities
                text = html.unescape(text)
                # Clean up whitespace
                text = ' '.join(text.split())
                return text.strip()
            
            symbol = self._normalize_ticker(clean_html(cells[0]))
            name = clean_html(cells[1]) if len(cells) > 1 else ''
            sector = clean_html(cells[2]) if len(cells) > 2 else None
            industry = clean_html(cells[3]) if len(cells) > 3 else None
            hq = clean_html(cells[4]) if len(cells) > 4 else None
            
            # Skip if symbol or name is empty
            if not symbol or not name:
                continue
            
            # Skip header-like rows
            if symbol.upper() in ['SYMBOL', 'TICKER'] or name.upper() in ['SECURITY', 'COMPANY']:
                continue
            
            companies.append(CompanySeedRecord(
                name=name,
                ticker=symbol,
                sector=sector if sector and sector.lower() != 'n/a' else None,
                industry=industry if industry and industry.lower() != 'n/a' else None,
                country="USA",
                hq_location=hq if hq and hq.lower() != 'n/a' else None,
                universe="sp500",
            ))
        
        if len(companies) < 400:  # S&P 500 should have ~500 companies
            raise Exception(f"Only found {len(companies)} companies, expected ~500")
        
        return companies
    
    def _fetch_from_github_dataset(self) -> list[CompanySeedRecord]:
        """
        Fetch from a well-maintained GitHub dataset.
        Try multiple GitHub sources.
        """
        # Try multiple GitHub sources
        github_sources = [
            "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv",
            "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv",
        ]
        
        for csv_url in github_sources:
            try:
                response = requests.get(csv_url, timeout=15)
                response.raise_for_status()
                
                # Parse CSV
                csv_content = response.text
                reader = csv.DictReader(io.StringIO(csv_content))
                
                companies = []
                for row in reader:
                    # Handle different column name variations
                    ticker = self._normalize_ticker(
                        row.get('Symbol', row.get('symbol', row.get('Ticker', ''))).strip()
                    )
                    name = row.get('Name', row.get('name', row.get('Security', ''))).strip()
                    
                    if not ticker or not name:
                        continue
                    
                    # Try to get sector if available
                    sector = row.get('Sector', row.get('sector', row.get('GICS Sector', None)))
                    if sector:
                        sector = sector.strip()
                        if not sector or sector.lower() in ['n/a', '']:
                            sector = None
                    
                    companies.append(CompanySeedRecord(
                        name=name,
                        ticker=ticker,
                        sector=sector,
                        industry=None,
                        country="USA",
                        hq_location=None,
                        universe="sp500",
                    ))
                
                if len(companies) > 0:
                    return companies
            except Exception:
                continue
        
        raise Exception("GitHub dataset sources not accessible")

    def _normalize_ticker(self, ticker: str) -> str:
        """
        Normalize ticker symbol.
        - Strip whitespace
        - Uppercase
        - Handle special cases (dots, dashes)
        """
        if not ticker:
            return ""
        
        # Strip whitespace and uppercase
        ticker = ticker.strip().upper()
        
        # Handle dots (e.g., BRK.B -> BRK.B, keep as-is)
        # Handle dashes if any
        # For now, just return as-is after normalization
        return ticker

