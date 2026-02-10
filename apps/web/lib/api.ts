/**
 * API client for backend communication.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export interface Company {
  id: number;
  name: string;
  ticker: string;
  sector: string | null;
  industry: string | null;
  hq_location: string | null;
  country: string | null;
  career_page_url: string | null;
  job_count: number | null;
  last_scraped_at: string | null;
  last_scrape_status: string | null;
  last_scrape_error: string | null;
  universe: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyListParams {
  search?: string;
  sector?: string;
  universe?: string;
  sort?: 'name_asc' | 'job_count_desc' | 'last_scraped_at_desc';
  page?: number;
  page_size?: number;
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
 * Seed S&P 500 companies.
 */
export async function seedSp500(): Promise<SeedResult> {
  const url = `${API_BASE_URL}/admin/seed/sp500`;
  const response = await fetch(url, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to seed S&P 500: ${response.statusText}`);
  }

  return response.json();
}

