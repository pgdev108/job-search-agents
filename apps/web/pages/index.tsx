'use client'

import { useEffect, useState, useCallback } from 'react'
import { getCompanies, getSectors, getUniverses, seedSp500, Company, CompanyListParams } from '../lib/api'

export default function Home() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [sectors, setSectors] = useState<string[]>([])
  const [universes, setUniverses] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seedMessage, setSeedMessage] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  
  // Filter and pagination state
  const [search, setSearch] = useState('')
  const [selectedSector, setSelectedSector] = useState<string>('')
  const [selectedUniverse, setSelectedUniverse] = useState<string>('')
  const [sort, setSort] = useState<CompanyListParams['sort']>('name_asc')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  
  // Debounced search
  const [searchInput, setSearchInput] = useState('')

  // Load sectors and universes on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [sectorsData, universesData] = await Promise.all([
          getSectors(),
          getUniverses(),
        ])
        setSectors(sectorsData)
        setUniverses(universesData)
      } catch (err) {
        console.error('Failed to load filters:', err)
      }
    }
    loadFilters()
  }, [])

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
    setPage(1) // Reset to first page on filter change
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
      return <span style={{ color: 'green' }}>✓ Success</span>
    }
    if (company.last_scrape_status === 'error') {
      return <span style={{ color: 'red' }}>✗ Error</span>
    }
    return <span style={{ color: '#666' }}>{company.last_scrape_status}</span>
  }

  return (
    <div style={{ 
      fontFamily: 'system-ui, sans-serif',
      padding: '2rem',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Job Search Agent - Companies</h1>
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
      </div>

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
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>HQ Location</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Career Page</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>Job Count</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Last Scraped</th>
                </tr>
              </thead>
              <tbody>
                {companies.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                      No companies found
                    </td>
                  </tr>
                ) : (
                  companies.map((company) => (
                    <tr key={company.id} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        <div>
                          <strong>{company.name}</strong>
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
                        {company.hq_location || '-'}
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '1rem'
            }}>
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
          )}
        </>
      )}
    </div>
  )
}
