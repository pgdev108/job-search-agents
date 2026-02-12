'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getCompanies, getSectors, getUniverses, seedSp500, postScrapeCompany, postScrapeAll, getScrapeRuns, getScrapeRun, Company, CompanyListParams, ScrapeRun, ScrapeRunDetail } from '../lib/api'

export default function Home() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [sectors, setSectors] = useState<string[]>([])
  const [universes, setUniverses] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seedMessage, setSeedMessage] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [refreshingTicker, setRefreshingTicker] = useState<string | null>(null)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkRunId, setBulkRunId] = useState<number | null>(null)
  const [bulkRunProgress, setBulkRunProgress] = useState<ScrapeRunDetail | null>(null)
  const [runs, setRuns] = useState<ScrapeRun[]>([])
  
  // Filter and pagination state
  const [search, setSearch] = useState('')
  const [selectedSector, setSelectedSector] = useState<string>('')
  const [selectedUniverse, setSelectedUniverse] = useState<string>('')
  const [sort, setSort] = useState<CompanyListParams['sort']>('name_asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  
  // Debounced search
  const [searchInput, setSearchInput] = useState('')

  // Load sectors, universes, and runs on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [sectorsData, universesData, runsData] = await Promise.all([
          getSectors(),
          getUniverses(),
          getScrapeRuns({ page_size: 5 }).catch(() => []),
        ])
        setSectors(sectorsData)
        setUniverses(universesData)
        setRuns(runsData)
      } catch (err) {
        console.error('Failed to load filters:', err)
      }
    }
    loadFilters()
  }, [])

  // Poll running bulk run progress (every 4s) and refresh runs list when done
  useEffect(() => {
    if (bulkRunId == null) return
    const t = setInterval(async () => {
      try {
        const detail = await getScrapeRun(bulkRunId)
        setBulkRunProgress(detail)
        if (detail.status !== 'running') {
          setBulkRunning(false)
          setBulkRunId(null)
          setBulkRunProgress(null)
          const runsData = await getScrapeRuns({ page_size: 5 })
          setRuns(runsData)
        }
      } catch {
        setBulkRunId(null)
        setBulkRunProgress(null)
      }
    }, 4000)
    return () => clearInterval(t)
  }, [bulkRunId])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1) // Reset to first page on search change
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  // Load companies when filters change
  useEffect(() => {
    const loadCompanies = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const params: CompanyListParams = {
          page,
          page_size: pageSize,
          sort,
        }
        
        if (search) {
          params.search = search
        }
        if (selectedSector) {
          params.sector = selectedSector
        }
        if (selectedUniverse) {
          params.universe = selectedUniverse
        }
        
        const data = await getCompanies(params)
        setCompanies(data.items)
        setTotalPages(data.total_pages)
        setTotal(data.total)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load companies')
        setCompanies([])
      } finally {
        setLoading(false)
      }
    }

    loadCompanies()
  }, [search, selectedSector, selectedUniverse, sort, page, pageSize])

  const handleSectorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSector(e.target.value)
    setPage(1) // Reset to first page on filter change
  }

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value as CompanyListParams['sort'])
    setPage(1) // Reset to first page on sort change
  }

  const handleUniverseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedUniverse(e.target.value)
    setPage(1)
  }

  const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500] as const
  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value))
    setPage(1)
  }

  const handleSeedSp500 = async () => {
    setSeeding(true)
    setSeedMessage(null)
    setError(null)
    
    try {
      const result = await seedSp500()
      setSeedMessage(
        `S&P 500 seeded successfully! Inserted: ${result.inserted}, Updated: ${result.updated}, Total: ${result.total}`
      )
      
      // Reload universes and companies
      const [universesData] = await Promise.all([
        getUniverses(),
        getCompanies({
          page,
          page_size: pageSize,
          sort,
          ...(search && { search }),
          ...(selectedSector && { sector: selectedSector }),
          ...(selectedUniverse && { universe: selectedUniverse }),
        }).then(data => {
          setCompanies(data.items)
          setTotalPages(data.total_pages)
          setTotal(data.total)
        }),
      ])
      setUniverses(universesData)
      
      // Clear message after 5 seconds
      setTimeout(() => setSeedMessage(null), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed S&P 500')
    } finally {
      setSeeding(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return dateString
    }
  }

  const getStatusBadge = (company: Company) => {
    if (!company.last_scrape_status) {
      return <span style={{ color: '#666' }}>Not scraped</span>
    }
    if (company.last_scrape_status === 'success') {
      return <span style={{ color: 'green', fontWeight: 600 }}>✓ Success</span>
    }
    if (company.last_scrape_status === 'failed') {
      return <span style={{ color: '#c00', fontWeight: 600 }}>✗ Failed</span>
    }
    if (company.last_scrape_status === 'blocked') {
      return <span style={{ color: '#b8860b', fontWeight: 600 }}>Blocked</span>
    }
    if (company.last_scrape_status === 'not_found') {
      return <span style={{ color: '#666', fontWeight: 600 }}>Not found</span>
    }
    return <span style={{ color: '#666' }}>{company.last_scrape_status}</span>
  }

  const handleRefresh = async (ticker: string) => {
    setRefreshingTicker(ticker)
    try {
      const result = await postScrapeCompany(ticker)
      setCompanies((prev) =>
        prev.map((c) => (c.ticker === ticker ? result.company : c))
      )
    } catch (err) {
      console.error('Refresh failed:', err)
      alert(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshingTicker(null)
    }
  }

  const handleRefreshAll = async () => {
    const universe = selectedUniverse || 'sp500'
    if (!confirm(`Start bulk refresh for universe "${universe}"? This may take a while.`)) return
    setBulkRunning(true)
    setBulkRunId(null)
    setError(null)
    try {
      const run = await postScrapeAll({ universe })
      setBulkRunId(run.id)
      setBulkRunProgress({ ...run, processed: 0, remaining: run.total_companies, percent_complete: 0 })
      setRuns((prev) => [run, ...prev.slice(0, 4)])
    } catch (err) {
      setBulkRunning(false)
      setError(err instanceof Error ? err.message : 'Bulk scrape failed')
    }
  }

  return (
    <div style={{ 
      fontFamily: 'system-ui, sans-serif',
      padding: '2rem',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0 }}>Job Search Agent - Companies</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link href="/runs" style={{ padding: '0.75rem 1rem', color: '#0066cc', fontWeight: 600, textDecoration: 'none' }}>Scrape Runs</Link>
          <button
            onClick={handleRefreshAll}
            disabled={bulkRunning}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: bulkRunning ? '#ccc' : '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: bulkRunning ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            {bulkRunning ? 'Bulk running...' : 'Refresh All (Universe)'}
          </button>
          <button
            onClick={handleSeedSp500}
            disabled={seeding}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: seeding ? '#ccc' : '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: seeding ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            {seeding ? 'Seeding...' : 'Seed S&P 500'}
          </button>
        </div>
      </div>

      {/* Bulk run progress banner */}
      {bulkRunProgress && bulkRunProgress.status === 'running' && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: '#e0f2fe', border: '1px solid #0ea5e9', borderRadius: '4px', marginBottom: '1rem' }}>
          <strong>Bulk refresh running:</strong> {bulkRunProgress.percent_complete.toFixed(0)}% complete
          ({bulkRunProgress.processed} / {bulkRunProgress.total_companies}) —{' '}
          <Link href={`/runs/${bulkRunProgress.id}`} style={{ color: '#0369a1', fontWeight: 600 }}>View run</Link>
        </div>
      )}

      {/* Seed success message */}
      {seedMessage && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#dfd',
          border: '1px solid #9c9',
          borderRadius: '4px',
          marginBottom: '1rem',
          color: '#060'
        }}>
          {seedMessage}
        </div>
      )}

      {/* Filters */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        marginBottom: '2rem',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ flex: '1', minWidth: '200px' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Search (Name/Ticker)
          </label>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search companies..."
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
        </div>

        <div style={{ minWidth: '150px' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Sector
          </label>
          <select
            value={selectedSector}
            onChange={handleSectorChange}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          >
            <option value="">All Sectors</option>
            {sectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: '150px' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Universe
          </label>
          <select
            value={selectedUniverse}
            onChange={handleUniverseChange}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          >
            <option value="">All Universes</option>
            {universes.map((universe) => (
              <option key={universe} value={universe}>
                {universe}
              </option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: '180px' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Sort By
          </label>
          <select
            value={sort}
            onChange={handleSortChange}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          >
            <option value="name_asc">Name (A-Z)</option>
            <option value="job_count_desc">Job Count (High to Low)</option>
            <option value="last_scraped_at_desc">Last Scraped (Recent First)</option>
          </select>
        </div>

        <div style={{ minWidth: '120px' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Per page
          </label>
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Recent scrape runs */}
      {runs.length > 0 && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
          <strong>Recent runs:</strong>{' '}
          {runs.slice(0, 5).map((r) => (
            <span key={r.id} style={{ marginRight: '1rem' }}>
              <Link href={`/runs/${r.id}`} style={{ color: '#0066cc' }}>#{r.id}</Link>
              {' '}{r.status}{' '}({r.success_count + r.failed_count + r.blocked_count + r.not_found_count}/{r.total_companies})
            </span>
          ))}
        </div>
      )}

      {/* Results count */}
      <div style={{ marginBottom: '1rem', color: '#666' }}>
        Showing {companies.length} of {total} companies
      </div>

      {/* Error state */}
      {error && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          marginBottom: '1rem',
          color: '#c00'
        }}>
          Error: {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          Loading companies...
        </div>
      )}

      {/* Companies table */}
      {!loading && !error && (
        <>
          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              border: '1px solid #ddd'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Company</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Sector</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Universe</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>HQ City</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>HQ State</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Career Page</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>Job Count</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Last Scraped</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ddd' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                      No companies found
                    </td>
                  </tr>
                ) : (
                  companies.map((company) => (
                    <tr key={company.id} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        <div>
                          <Link href={`/company/${company.ticker}`} style={{ color: '#0066cc', fontWeight: 600 }}>
                            {company.name}
                          </Link>
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#666' }}>
                          {company.ticker}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {company.sector || '-'}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {company.universe || '-'}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {company.hq_city ?? company.hq_location ?? '-'}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {company.hq_state ?? '-'}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {company.career_page_url ? (
                          <a 
                            href={company.career_page_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: '#0066cc' }}
                          >
                            View Careers
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>
                        {company.job_count !== null ? company.job_count.toLocaleString() : '-'}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {getStatusBadge(company)}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {formatDate(company.last_scraped_at)}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleRefresh(company.ticker)}
                          disabled={refreshingTicker === company.ticker}
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.875rem',
                            backgroundColor: refreshingTicker === company.ticker ? '#e0e0e0' : '#0066cc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: refreshingTicker === company.ticker ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {refreshingTicker === company.ticker ? 'Refreshing...' : 'Refresh'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination + Per page */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '1rem',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ color: '#666', fontSize: '0.9rem' }}>Per page:</label>
              <select
                value={pageSize}
                onChange={handlePageSizeChange}
                style={{ padding: '0.35rem 0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.9rem' }}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            {totalPages > 1 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: page === 1 ? '#f5f5f5' : 'white',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '1rem'
                }}
              >
                Previous
              </button>

              <span style={{ color: '#666' }}>
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: page === totalPages ? '#f5f5f5' : 'white',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '1rem'
                }}
              >
                Next
              </button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
