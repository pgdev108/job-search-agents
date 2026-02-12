"""OpenAI Agents SDK-based career page discovery for a company."""
import os

from agents import Agent, Runner
from pydantic import BaseModel, Field, ValidationError

from app.schemas.scrape import CareerDiscoveryResult


# Schema for agent output_type: use str for URLs so OpenAI's API accepts the schema
class _CareerDiscoveryAgentOutput(BaseModel):
    career_page_url: str = Field(description="Main career page URL")
    confidence: float = Field(ge=0, le=1, description="Confidence 0-1")
    alternate_urls: list[str] = Field(default_factory=list, description="Other candidate URLs")
    notes: str = ""
    hq_city: str | None = Field(default=None, description="Company headquarters city (e.g. Northbrook, San Francisco)")
    hq_state: str | None = Field(default=None, description="Company headquarters state or province code (e.g. IL, CA, NY)")


CAREER_DISCOVERY_INSTRUCTIONS = """You are a research assistant that finds the official career/jobs page and headquarters location for a given company.

Rules:
- Use the company name and ticker provided to identify the company.
- Find the official career or jobs page where the company lists open positions.
- Prefer the company's own domain (e.g. careers.company.com, jobs.company.com) or the official ATS domain they use (Greenhouse, Lever, Workday, iCIMS, etc.).
- Avoid LinkedIn jobs pages, Indeed, Glassdoor, or other generic job boards unless it is clearly the company's own ATS listing.
- Choose the single URL that best lists open positions for that company.
- Also identify the company's current headquarters: city and state/province. For US companies use the two-letter state code (e.g. IL, CA). If not in the US use the region or leave state blank.
- Return your answer as JSON with exactly these fields:
  - career_page_url: the main career page URL (string)
  - confidence: number between 0 and 1 (how confident you are this is the right page)
  - alternate_urls: optional list of other candidate URLs (can be empty list)
  - notes: brief optional note (e.g. "Company uses Greenhouse")
  - hq_city: headquarters city name (string or null if unknown)
  - hq_state: headquarters state/province code (e.g. IL, CA) or null if unknown

Example format (you must return valid JSON only):
{"career_page_url": "https://careers.company.com", "confidence": 0.9, "alternate_urls": [], "notes": "Official careers site", "hq_city": "Northbrook", "hq_state": "IL"}
"""


def _agent_output_to_result(out: _CareerDiscoveryAgentOutput) -> CareerDiscoveryResult:
    """Convert agent output (str URLs) to CareerDiscoveryResult (HttpUrl)."""
    return CareerDiscoveryResult.model_validate({
        "career_page_url": out.career_page_url,
        "confidence": out.confidence,
        "alternate_urls": out.alternate_urls,
        "notes": out.notes,
        "hq_city": out.hq_city or None,
        "hq_state": out.hq_state or None,
    })


def _build_agent(model: str) -> Agent:
    """Build the career discovery agent with structured output (str URLs for API compatibility)."""
    return Agent(
        name="Career Page Discovery",
        instructions=CAREER_DISCOVERY_INSTRUCTIONS,
        model=model,
        output_type=_CareerDiscoveryAgentOutput,
    )


async def discover_career_page(
    company_name: str,
    ticker: str,
    *,
    model: str | None = None,
    api_key: str | None = None,
) -> CareerDiscoveryResult:
    """
    Use OpenAI Agents SDK to discover the best official career page URL for the company.
    Returns CareerDiscoveryResult. Validates with Pydantic; retries once on validation failure.
    """
    if api_key:
        os.environ["OPENAI_API_KEY"] = api_key
    agent = _build_agent(model or "gpt-4o")
    user_input = f"Company: {company_name} (ticker: {ticker}). Return the official career/jobs page URL as JSON."
    
    result = await Runner.run(agent, user_input)
    raw = result.final_output
    try:
        if isinstance(raw, _CareerDiscoveryAgentOutput):
            return _agent_output_to_result(raw)
        if isinstance(raw, dict):
            out = _CareerDiscoveryAgentOutput.model_validate(raw)
            return _agent_output_to_result(out)
        out = result.final_output_as(_CareerDiscoveryAgentOutput)
        return _agent_output_to_result(out)
    except (ValidationError, TypeError, ValueError) as e:
        # Retry once with correction prompt
        retry_input = (
            f"Company: {company_name} (ticker: {ticker}). "
            "Your previous response was invalid. Return ONLY valid JSON with keys: career_page_url, confidence, alternate_urls, notes, hq_city (string or null), hq_state (string or null). "
            f"Error was: {e!s}"
        )
        result2 = await Runner.run(agent, retry_input)
        raw2 = result2.final_output
        if isinstance(raw2, _CareerDiscoveryAgentOutput):
            return _agent_output_to_result(raw2)
        if isinstance(raw2, dict):
            out2 = _CareerDiscoveryAgentOutput.model_validate(raw2)
            return _agent_output_to_result(out2)
        out2 = result2.final_output_as(_CareerDiscoveryAgentOutput)
        return _agent_output_to_result(out2)
