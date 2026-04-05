/**
 * API client for backend communication.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export interface CompanyUpdateParams {
  career_page_url?: string;  // set to "" to clear
  not_interested?: boolean;
  company_tags?: string;     // comma-separated tag names, set to "" to clear
}

export interface Company {
  id: number;
  name: string;
  ticker: string | null;
  sector: string | null;
  industry: string | null;
  hq_location: string | null;
  hq_city?: string | null;
  hq_state?: string | null;
  country: string | null;
  career_page_url: string | null;
  career_page_source?: string | null;
  job_count: number | null;
  job_count_extraction_method?: string | null;
  last_scraped_at: string | null;
  last_scrape_status: string | null;
  last_scrape_error: string | null;
  not_interested: boolean;
  applications_count: number;
  universe: string;
  description: string | null;
  website: string | null;
  domain: string | null;
  founded_year: number | null;
  company_size: string | null;
  company_tags: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyScrapeResponse {
  company: Company;
  discovery?: { career_page_url: string; confidence: number; alternate_urls: string[]; notes: string } | null;
  job_count?: { job_count: number | null; method: string; evidence: string; status: string; error: string } | null;
}

export interface CompanyListParams {
  search?: string;
  sector?: string;
  universe?: string;
  last_scrape_status?: string;
  state?: string;
  city?: string;
  tag?: string;
  interested_only?: boolean;
  has_applications?: 'yes' | 'no';
  sort?: 'name_asc' | 'job_count_desc' | 'last_scraped_at_desc';
  page?: number;
  page_size?: number;
}

export interface CityCount {
  city: string;
  count: number;
}

export interface SeedResult {
  source: string;
  inserted: number;
  updated: number;
  total: number;
}

export interface CompanyListResponse {
  items: Company[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface JobApplication {
  id: number;
  company_id: number;
  job_url: string;
  job_title: string | null;
  applied_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobApplicationCreateParams {
  job_url: string;
  job_title?: string;
  applied_date: string;
  status?: string;
  notes?: string;
}

export interface JobApplicationUpdateParams {
  job_url?: string;
  job_title?: string;
  applied_date?: string;
  status?: string;
  notes?: string;
}

export async function getApplicationStatuses(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/applications/statuses`);
  if (!response.ok) throw new Error('Failed to fetch statuses');
  return response.json();
}

export async function getApplications(ticker: string): Promise<JobApplication[]> {
  const response = await fetch(`${API_BASE_URL}/companies/${encodeURIComponent(ticker)}/applications`);
  if (!response.ok) throw new Error('Failed to fetch applications');
  return response.json();
}

export async function createApplication(ticker: string, params: JobApplicationCreateParams): Promise<JobApplication> {
  const response = await fetch(`${API_BASE_URL}/companies/${encodeURIComponent(ticker)}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const text = await response.text();
    let message = response.statusText;
    try { const b = JSON.parse(text); if (b.detail) message = b.detail; } catch { /* ignore */ }
    throw new Error(message);
  }
  return response.json();
}

export async function updateApplication(applicationId: number, params: JobApplicationUpdateParams): Promise<JobApplication> {
  const response = await fetch(`${API_BASE_URL}/applications/${applicationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const text = await response.text();
    let message = response.statusText;
    try { const b = JSON.parse(text); if (b.detail) message = b.detail; } catch { /* ignore */ }
    throw new Error(message);
  }
  return response.json();
}

/**
 * Get companies with filtering, sorting, and pagination.
 */
export async function getCompanies(params: CompanyListParams = {}): Promise<CompanyListResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.search) {
    searchParams.append('search', params.search);
  }
  if (params.sector) {
    searchParams.append('sector', params.sector);
  }
  if (params.universe) {
    searchParams.append('universe', params.universe);
  }
  if (params.last_scrape_status) {
    searchParams.append('last_scrape_status', params.last_scrape_status);
  }
  if (params.interested_only !== undefined) {
    searchParams.append('interested_only', params.interested_only.toString());
  }
  if (params.has_applications) {
    searchParams.append('has_applications', params.has_applications);
  }
  if (params.state) {
    searchParams.append('state', params.state);
  }
  if (params.city) {
    searchParams.append('city', params.city);
  }
  if (params.tag) {
    searchParams.append('tag', params.tag);
  }
  if (params.sort) {
    searchParams.append('sort', params.sort);
  }
  if (params.page) {
    searchParams.append('page', params.page.toString());
  }
  if (params.page_size) {
    searchParams.append('page_size', params.page_size.toString());
  }

  const url = `${API_BASE_URL}/companies?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch companies: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get list of distinct sectors.
 */
export async function getSectors(): Promise<string[]> {
  const url = `${API_BASE_URL}/sectors`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch sectors: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get list of distinct universes.
 */
export async function getUniverses(): Promise<string[]> {
  const url = `${API_BASE_URL}/universes`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch universes: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get all available tag names from the tags table.
 */
export async function getTags(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/tags`);
  if (!response.ok) throw new Error(`Failed to fetch tags: ${response.statusText}`);
  return response.json();
}

/**
 * Create a new tag. Returns updated list of all tags.
 */
export async function deleteTag(name: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/tags/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const text = await response.text();
    let message = response.statusText;
    try { const b = JSON.parse(text); if (b.detail) message = b.detail; } catch { /* ignore */ }
    throw new Error(message);
  }
}

export async function createTag(name: string): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const text = await response.text();
    let message = response.statusText;
    try { const b = JSON.parse(text); if (b.detail) message = b.detail; } catch { /* ignore */ }
    throw new Error(message);
  }
  return response.json();
}

/**
 * Get count of companies per last_scrape_status. 'never' = never scraped (NULL).
 */
export async function getScrapeStatusCounts(): Promise<Record<string, number>> {
  const url = `${API_BASE_URL}/companies/filters/scrape-status-counts`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch scrape status counts: ${response.statusText}`);
  return response.json();
}

/**
 * Get distinct last scrape status values for filter dropdown. Use "never" for never scraped.
 */
export async function getLastScrapeStatuses(): Promise<string[]> {
  const url = `${API_BASE_URL}/companies/filters/last-scrape-statuses`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch last scrape statuses: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get distinct HQ state values for filter dropdown.
 */
export async function getStates(): Promise<string[]> {
  const url = `${API_BASE_URL}/companies/filters/states`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch states: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get cities in a state with company count. Call when a state is selected.
 */
export async function getCitiesByState(state: string): Promise<CityCount[]> {
  const url = `${API_BASE_URL}/companies/filters/cities?state=${encodeURIComponent(state)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch cities: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Seed index constituents. source is one of: sp500, dow_jones, nasdaq100, russell2000.
 */
export async function seedIndex(source: 'sp500' | 'dow_jones' | 'nasdaq100' | 'russell2000'): Promise<SeedResult> {
  const url = `${API_BASE_URL}/admin/seed/${source}`;
  const response = await fetch(url, { method: 'POST' });

  if (!response.ok) {
    throw new Error(`Failed to seed ${source}: ${response.statusText}`);
  }

  return response.json();
}

/** @deprecated Use seedIndex('sp500') */
export async function seedSp500(): Promise<SeedResult> {
  return seedIndex('sp500');
}

/**
 * Get a single company by ticker (for detail page).
 */
export async function getCompanyById(id: number): Promise<Company> {
  const response = await fetch(`${API_BASE_URL}/companies/${id}`);
  if (!response.ok) {
    if (response.status === 404) throw new Error(`Company with id '${id}' not found`);
    throw new Error(`Failed to fetch company: ${response.statusText}`);
  }
  return response.json();
}

export async function patchCompanyById(id: number, params: CompanyUpdateParams): Promise<Company> {
  const response = await fetch(`${API_BASE_URL}/companies/by-id/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const text = await response.text();
    let message = response.statusText;
    try { const b = JSON.parse(text); if (b.detail) message = b.detail; } catch { /* ignore */ }
    throw new Error(message);
  }
  return response.json();
}

/**
 * Update ignore flag and/or career_page_url for a company.
 */
export async function patchCompany(ticker: string, params: CompanyUpdateParams): Promise<Company> {
  const url = `${API_BASE_URL}/companies/${encodeURIComponent(ticker)}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const text = await response.text();
    let message = response.statusText;
    try {
      const body = JSON.parse(text);
      if (body.detail) message = typeof body.detail === 'string' ? body.detail : message;
    } catch { /* ignore */ }
    throw new Error(message);
  }
  return response.json();
}

/**
 * Run career page discovery + job count extraction for one company (Refresh).
 */
export async function postScrapeCompany(ticker: string): Promise<CompanyScrapeResponse> {
  const url = `${API_BASE_URL}/scrape/company/${encodeURIComponent(ticker)}`;
  const response = await fetch(url, {
    method: 'POST',
  });

  if (!response.ok) {
    const text = await response.text();
    let message = response.statusText;
    try {
      const body = JSON.parse(text);
      if (body.detail) message = typeof body.detail === 'string' ? body.detail : body.detail.join?.(' ') || message;
    } catch {
      if (text) message = text.slice(0, 200);
    }
    throw new Error(message);
  }

  return response.json();
}

// --- Bulk scrape (Phase 4) ---

export interface ScrapeRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: string;
  universe: string | null;
  total_companies: number;
  success_count: number;
  failed_count: number;
  blocked_count: number;
  not_found_count: number;
  last_error: string | null;
}

export interface ScrapeRunDetail extends ScrapeRun {
  processed: number;
  remaining: number;
  percent_complete: number;
}

export interface ScrapeAllParams {
  universe?: string;
  tickers?: string[];
  /** If true, only scrape companies whose last scrape was not success. */
  failed_only?: boolean;
  /** If set, scrape all companies with this tag (supports private companies without tickers). */
  tag?: string;
}

/**
 * Start a bulk scrape run. Returns immediately with run summary. 409 if already running.
 */
export async function postScrapeAll(params: ScrapeAllParams = {}): Promise<ScrapeRun> {
  const url = `${API_BASE_URL}/scrape/all`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = response.statusText;
    try {
      const body = JSON.parse(text);
      if (body.detail) message = typeof body.detail === 'string' ? body.detail : body.detail.join?.(' ') || message;
    } catch {
      if (text) message = text.slice(0, 300);
    }
    throw new Error(message);
  }
  return response.json();
}

/**
 * List recent scrape runs.
 */
export async function getScrapeRuns(params: { status?: string; universe?: string; page?: number; page_size?: number } = {}): Promise<ScrapeRun[]> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.append('status', params.status);
  if (params.universe) searchParams.append('universe', params.universe);
  if (params.page) searchParams.append('page', params.page.toString());
  if (params.page_size) searchParams.append('page_size', params.page_size.toString());
  const url = `${API_BASE_URL}/scrape/runs?${searchParams.toString()}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch runs: ${response.statusText}`);
  return response.json();
}

/**
 * Cancel a running bulk scrape run.
 */
export async function cancelScrapeRun(runId: number): Promise<ScrapeRun> {
  const url = `${API_BASE_URL}/scrape/runs/${runId}/cancel`;
  const response = await fetch(url, { method: 'POST' });
  if (!response.ok) {
    const text = await response.text();
    let message = response.statusText;
    try {
      const body = JSON.parse(text);
      if (body.detail) message = typeof body.detail === 'string' ? body.detail : message;
    } catch { /* ignore */ }
    throw new Error(message);
  }
  return response.json();
}

/**
 * Get run detail with progress.
 */
export async function getScrapeRun(runId: number): Promise<ScrapeRunDetail> {
  const url = `${API_BASE_URL}/scrape/runs/${runId}`;
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) throw new Error('Run not found');
    throw new Error(`Failed to fetch run: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get companies touched by this run.
 */
export async function getScrapeRunCompanies(runId: number): Promise<Company[]> {
  const url = `${API_BASE_URL}/scrape/runs/${runId}/companies`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch run companies: ${response.statusText}`);
  return response.json();
}

// --- Bay Area Companies ---

export interface BayAreaCompany {
  id: number;
  name: string;
  tags: string | null;
  location: string | null;
  investors: string | null;
  description: string | null;
  website: string | null;
  domain: string | null;
  founded_year: number | null;
  address: string | null;
  hq_city: string | null;
  hq_state: string | null;
  lat: number | null;
  long: number | null;
  company_size: string | null;
  tech_stack: string | null;
  marketing_stack: string | null;
  created_at: string;
  updated_at: string;
}

export interface BayAreaCompanyListResponse {
  items: BayAreaCompany[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface BayAreaSeedResult {
  inserted: number;
  updated: number;
  total: number;
}

export interface BayAreaListParams {
  search?: string;
  location?: string;
  tag?: string;
  company_size?: string;
  sort?: 'name_asc' | 'founded_desc' | 'founded_asc';
  page?: number;
  page_size?: number;
}

export async function seedBayArea(): Promise<BayAreaSeedResult> {
  const response = await fetch(`${API_BASE_URL}/admin/seed/bay-area`, { method: 'POST' });
  if (!response.ok) {
    const text = await response.text();
    let message = response.statusText;
    try { const b = JSON.parse(text); if (b.detail) message = b.detail; } catch { /* ignore */ }
    throw new Error(message);
  }
  return response.json();
}

export async function getBayAreaCompanies(params: BayAreaListParams = {}): Promise<BayAreaCompanyListResponse> {
  const sp = new URLSearchParams();
  if (params.search) sp.append('search', params.search);
  if (params.location) sp.append('location', params.location);
  if (params.tag) sp.append('tag', params.tag);
  if (params.company_size) sp.append('company_size', params.company_size);
  if (params.sort) sp.append('sort', params.sort);
  if (params.page) sp.append('page', params.page.toString());
  if (params.page_size) sp.append('page_size', params.page_size.toString());
  const response = await fetch(`${API_BASE_URL}/bay-area/companies?${sp.toString()}`);
  if (!response.ok) throw new Error(`Failed to fetch Bay Area companies: ${response.statusText}`);
  return response.json();
}

export async function getBayAreaLocations(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/bay-area/companies/filters/locations`);
  if (!response.ok) throw new Error('Failed to fetch locations');
  return response.json();
}

export async function getBayAreaTags(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/bay-area/companies/filters/tags`);
  if (!response.ok) throw new Error('Failed to fetch tags');
  return response.json();
}

export async function getBayAreaSizes(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/bay-area/companies/filters/sizes`);
  if (!response.ok) throw new Error('Failed to fetch sizes');
  return response.json();
}

