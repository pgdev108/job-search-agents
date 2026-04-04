'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getCompanies, getSectors, getUniverses, getLastScrapeStatuses, getStates, getCitiesByState, seedIndex, postScrapeCompany, postScrapeAll, getScrapeRuns, getScrapeRun, getScrapeStatusCounts, cancelScrapeRun, patchCompany, createApplication, getApplicationStatuses, Company, CompanyListParams, ScrapeRun, ScrapeRunDetail } from '../lib/api'

export default function Home() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [sectors, setSectors] = useState<string[]>([])
  const [universes, setUniverses] = useState<string[]>([])
  const [lastScrapeStatuses, setLastScrapeStatuses] = useState<string[]>([])
  const [states, setStates] = useState<string[]>([])
  const [cities, setCities] = useState<{ city: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seedMessage, setSeedMessage] = useState<string | null>(null)
  const [seeding, setSeeding] = useState<'sp500' | 'dow_jones' | 'nasdaq100' | 'russell2000' | null>(null)
  const [refreshingTicker, setRefreshingTicker] = useState<string | null>(null)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkRunId, setBulkRunId] = useState<number | null>(null)
  const [bulkRunProgress, setBulkRunProgress] = useState<ScrapeRunDetail | null>(null)
  const [runs, setRuns] = useState<ScrapeRun[]>([])
  const [scrapeStatusCounts, setScrapeStatusCounts] = useState<Record<string, number>>({})
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [editCareerUrl, setEditCareerUrl] = useState('')
  const [editNotInterested, setEditNotInterested] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [addJobCompany, setAddJobCompany] = useState<Company | null>(null)
  const [addJobUrl, setAddJobUrl] = useState('')
  const [addJobTitle, setAddJobTitle] = useState('')
  const [addJobDate, setAddJobDate] = useState('')
  const [addJobStatus, setAddJobStatus] = useState('Applied')
  const [addJobNotes, setAddJobNotes] = useState('')
  const [addJobSaving, setAddJobSaving] = useState(false)
  const [addJobError, setAddJobError] = useState<string | null>(null)
  const [applicationStatuses, setApplicationStatuses] = useState<string[]>(['Applied', 'Phone Screen', 'Interview', 'Offer', 'Rejected', 'Withdrawn'])
  
  // Filter and pagination state
  const [search, setSearch] = useState('')
  const [selectedSector, setSelectedSector] = useState<string>('')
  const [selectedUniverse, setSelectedUniverse] = useState<string>('')
  const [selectedLastScrapeStatus, setSelectedLastScrapeStatus] = useState<string>('')
  const [selectedState, setSelectedState] = useState<string>('')
  const [selectedCity, setSelectedCity] = useState<string>('')
  const [interestedOnly, setInterestedOnly] = useState(true)
  const [hasApplications, setHasApplications] = useState<'yes' | 'no' | ''>('')
  const [sort, setSort] = useState<CompanyListParams['sort']>('name_asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  
  // Debounced search
  const [searchInput, setSearchInput] = useState('')

  // Load cities when state is selected (and clear when state is cleared)
  useEffect(() => {
    if (!selectedState) {
      setCities([])
      setSelectedCity('')
      return
    }
    getCitiesByState(selectedState)
      .then(setCities)
      .catch(() => setCities([]))
    setSelectedCity('')
  }, [selectedState])

  // Load sectors, universes, and runs on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [sectorsData, universesData, statusesData, statesData, runsData, countsData, appStatusesData] = await Promise.all([
          getSectors(),
          getUniverses(),
          getLastScrapeStatuses().catch(() => []),
          getStates().catch(() => []),
          getScrapeRuns({ page_size: 5 }).catch(() => []),
          getScrapeStatusCounts().catch(() => ({})),
          getApplicationStatuses().catch(() => ['Applied', 'Phone Screen', 'Interview', 'Offer', 'Rejected', 'Withdrawn']),
        ])
        setSectors(sectorsData)
        setUniverses(universesData)
        setLastScrapeStatuses(statusesData)
        setStates(statesData)
        setRuns(runsData)
        setScrapeStatusCounts(countsData)
        setApplicationStatuses(appStatusesData)
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
        if (selectedLastScrapeStatus) {
          params.last_scrape_status = selectedLastScrapeStatus
        }
        if (selectedState) {
          params.state = selectedState
        }
        if (selectedCity) {
          params.city = selectedCity
        }
        params.interested_only = interestedOnly
        if (hasApplications) params.has_applications = hasApplications

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
  }, [search, selectedSector, selectedUniverse, selectedLastScrapeStatus, selectedState, selectedCity, interestedOnly, hasApplications, sort, page, pageSize])

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

  const handleLastScrapeStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLastScrapeStatus(e.target.value)
    setPage(1)
  }

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedState(e.target.value)
    setSelectedCity('')
    setPage(1)
  }

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCity(e.target.value)
    setPage(1)
  }

  const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500] as const
  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value))
    setPage(1)
  }

  const seedLabels: Record<'sp500' | 'dow_jones' | 'nasdaq100' | 'russell2000', string> = {
    sp500: 'S&P 500',
    dow_jones: 'Dow Jones',
    nasdaq100: 'Nasdaq 100',
    russell2000: 'Russell 2000',
  }

  const handleSeed = async (source: 'sp500' | 'dow_jones' | 'nasdaq100' | 'russell2000') => {
    setSeeding(source)
    setSeedMessage(null)
    setError(null)
    const label = seedLabels[source]
    try {
      const result = await seedIndex(source)
      setSeedMessage(
        `${label} seeded successfully! Inserted: ${result.inserted}, Updated: ${result.updated}, Total: ${result.total}`
      )
      const [universesData] = await Promise.all([
        getUniverses(),
        getCompanies({
          page,
          page_size: pageSize,
          sort,
          ...(search && { search }),
          ...(selectedSector && { sector: selectedSector }),
          ...(selectedUniverse && { universe: selectedUniverse }),
          ...(selectedLastScrapeStatus && { last_scrape_status: selectedLastScrapeStatus }),
          ...(selectedState && { state: selectedState }),
          ...(selectedCity && { city: selectedCity }),
        }).then(data => {
          setCompanies(data.items)
          setTotalPages(data.total_pages)
          setTotal(data.total)
        }),
      ])
      setUniverses(universesData)
      setTimeout(() => setSeedMessage(null), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to seed ${label}`)
    } finally {
      setSeeding(null)
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

  const handleRefreshFailed = async () => {
    const universe = selectedUniverse || undefined
    const universeLabel = universe ?? 'All Universes'
    if (!confirm(`Refresh only failed/non-success companies for "${universeLabel}"? This may take a while.`)) return
    setBulkRunning(true)
    setBulkRunId(null)
    setError(null)
    try {
      const run = await postScrapeAll({ universe, failed_only: true })
      setBulkRunId(run.id)
      setBulkRunProgress({ ...run, processed: 0, remaining: run.total_companies, percent_complete: 0 })
      setRuns((prev) => [run, ...prev.slice(0, 4)])
    } catch (err) {
      setBulkRunning(false)
      setError(err instanceof Error ? err.message : 'Refresh failed scrape failed')
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  const handleAddJobOpen = (company: Company) => {
    setAddJobCompany(company)
    setAddJobUrl('')
    setAddJobTitle('')
    setAddJobDate(today)
    setAddJobStatus('Applied')
    setAddJobNotes('')
    setAddJobError(null)
  }

  const handleAddJobSave = async () => {
    if (!addJobCompany) return
    if (!addJobUrl.trim()) { setAddJobError('Job URL is required'); return }
    setAddJobSaving(true)
    setAddJobError(null)
    try {
      await createApplication(addJobCompany.ticker, {
        job_url: addJobUrl.trim(),
        job_title: addJobTitle.trim() || undefined,
        applied_date: addJobDate,
        status: addJobStatus,
        notes: addJobNotes.trim() || undefined,
      })
      setAddJobCompany(null)
    } catch (err) {
      setAddJobError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setAddJobSaving(false)
    }
  }

  const handleEditOpen = (company: Company) => {
    setEditingCompany(company)
    setEditCareerUrl(company.career_page_url ?? '')
    setEditNotInterested(company.not_interested)
    setEditError(null)
  }

  const handleEditSave = async () => {
    if (!editingCompany) return
    setEditSaving(true)
    setEditError(null)
    try {
      const updated = await patchCompany(editingCompany.ticker, {
        career_page_url: editCareerUrl,
        not_interested: editNotInterested,
      })
      setCompanies((prev) => prev.map((c) => c.ticker === updated.ticker ? updated : c))
      setEditingCompany(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setEditSaving(false)
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
            onClick={handleRefreshFailed}
            disabled={bulkRunning}
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: bulkRunning ? '#ccc' : '#b45309',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: bulkRunning ? 'not-allowed' : 'pointer',
              fontSize: '0.95rem',
              fontWeight: 'bold'
            }}
          >
            Refresh Failed
          </button>
          {(['sp500', 'dow_jones', 'nasdaq100', 'russell2000'] as const).map((source) => (
            <button
              key={source}
              onClick={() => handleSeed(source)}
              disabled={seeding != null}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: seeding != null ? '#ccc' : '#0066cc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: seeding != null ? 'not-allowed' : 'pointer',
                fontSize: '0.95rem',
                fontWeight: 'bold'
              }}
            >
              {seeding === source ? 'Seeding...' : `Seed ${seedLabels[source]}`}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk run progress banner */}
      {bulkRunProgress && bulkRunProgress.status === 'running' && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: '#e0f2fe', border: '1px solid #0ea5e9', borderRadius: '4px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span>
            <strong>Bulk refresh running:</strong> {bulkRunProgress.percent_complete.toFixed(0)}% complete
            ({bulkRunProgress.processed} / {bulkRunProgress.total_companies}) —{' '}
            <Link href={`/runs/${bulkRunProgress.id}`} style={{ color: '#0369a1', fontWeight: 600 }}>View run</Link>
          </span>
          <button
            onClick={async () => {
              if (!bulkRunId) return
              if (!confirm('Cancel the current bulk scrape run?')) return
              try {
                await cancelScrapeRun(bulkRunId)
                setBulkRunning(false)
                setBulkRunId(null)
                setBulkRunProgress(null)
                const runsData = await getScrapeRuns({ page_size: 5 })
                setRuns(runsData)
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Cancel failed')
              }
            }}
            style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            Cancel Run
          </button>
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

        <div style={{ minWidth: '160px' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Last Scrape Status
          </label>
          <select
            value={selectedLastScrapeStatus}
            onChange={handleLastScrapeStatusChange}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          >
            <option value="">All</option>
            <option value="never">Never</option>
            {lastScrapeStatuses.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: '140px' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Jobs Applied
          </label>
          <select
            value={hasApplications}
            onChange={(e) => { setHasApplications(e.target.value as 'yes' | 'no' | ''); setPage(1) }}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '1rem' }}
          >
            <option value="">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        <div style={{ minWidth: '140px' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            State
          </label>
          <select
            value={selectedState}
            onChange={handleStateChange}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          >
            <option value="">All States</option>
            {states.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        {selectedState && (
          <div style={{ minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              City
            </label>
            <select
              value={selectedCity}
              onChange={handleCityChange}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            >
              <option value="">All Cities</option>
              {cities.map(({ city, count }) => (
                <option key={city} value={city}>
                  {city} ({count})
                </option>
              ))}
            </select>
          </div>
        )}

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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
          <input
            type="checkbox"
            id="interested-only"
            checked={interestedOnly}
            onChange={(e) => { setInterestedOnly(e.target.checked); setPage(1) }}
            style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
          />
          <label htmlFor="interested-only" style={{ fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Show Interested Only
          </label>
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

      {/* Scrape status summary */}
      {Object.keys(scrapeStatusCounts).length > 0 && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <strong style={{ whiteSpace: 'nowrap' }}>Scrape status:</strong>
          {Object.entries(scrapeStatusCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([status, count]) => {
              const colors: Record<string, string> = {
                success: '#16a34a',
                failed: '#dc2626',
                blocked: '#b45309',
                not_found: '#666',
                never: '#888',
              }
              return (
                <span key={status} style={{ color: colors[status] ?? '#333', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}: {count.toLocaleString()}
                </span>
              )
            })}
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
                  <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>Jobs Applied</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Last Scrape Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Last Scraped</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ddd' }}>Not Interested?</th>
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
                        {company.applications_count > 0 ? company.applications_count : '-'}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {getStatusBadge(company)}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {formatDate(company.last_scraped_at)}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'center', fontSize: '0.9rem' }}>
                        {company.not_interested ? '✓' : ''}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
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
                          <button
                            type="button"
                            onClick={() => handleEditOpen(company)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.875rem',
                              backgroundColor: '#6b7280',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddJobOpen(company)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.875rem',
                              backgroundColor: '#059669',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            Add Job
                          </button>
                        </div>
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

      {/* Edit modal */}
      {editingCompany && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '2rem', width: '480px', maxWidth: '95vw', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
            <h2 style={{ margin: '0 0 1.5rem' }}>Edit — {editingCompany.name} ({editingCompany.ticker})</h2>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Career Page URL</label>
              <input
                type="url"
                value={editCareerUrl}
                onChange={(e) => setEditCareerUrl(e.target.value)}
                placeholder="https://careers.company.com"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
              <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                If a URL is set (manually or via scrape), the company will be excluded from bulk scrape runs.
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <input
                type="checkbox"
                id="edit-not-interested"
                checked={editNotInterested}
                onChange={(e) => setEditNotInterested(e.target.checked)}
                style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
              />
              <label htmlFor="edit-not-interested" style={{ fontWeight: 600, cursor: 'pointer' }}>
                Not Interested in pursuing this company
              </label>
            </div>

            {editError && (
              <div style={{ padding: '0.5rem', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                {editError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingCompany(null)}
                disabled={editSaving}
                style={{ padding: '0.5rem 1.25rem', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: 'white', cursor: 'pointer', fontSize: '0.95rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: '4px', backgroundColor: editSaving ? '#ccc' : '#0066cc', color: 'white', cursor: editSaving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.95rem' }}
              >
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add Job modal */}
      {addJobCompany && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '2rem', width: '500px', maxWidth: '95vw', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
            <h2 style={{ margin: '0 0 1.5rem' }}>Add Job — {addJobCompany.name}</h2>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Job Posting URL *</label>
              <input
                type="url"
                value={addJobUrl}
                onChange={(e) => setAddJobUrl(e.target.value)}
                placeholder="https://..."
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Job Title</label>
              <input
                type="text"
                value={addJobTitle}
                onChange={(e) => setAddJobTitle(e.target.value)}
                placeholder="e.g. Senior Software Engineer"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Date Applied</label>
                <input
                  type="date"
                  value={addJobDate}
                  onChange={(e) => setAddJobDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Status</label>
                <select
                  value={addJobStatus}
                  onChange={(e) => setAddJobStatus(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                >
                  {applicationStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Notes</label>
              <textarea
                value={addJobNotes}
                onChange={(e) => setAddJobNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            {addJobError && (
              <div style={{ padding: '0.5rem', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                {addJobError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setAddJobCompany(null)}
                disabled={addJobSaving}
                style={{ padding: '0.5rem 1.25rem', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: 'white', cursor: 'pointer', fontSize: '0.95rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddJobSave}
                disabled={addJobSaving}
                style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: '4px', backgroundColor: addJobSaving ? '#ccc' : '#059669', color: 'white', cursor: addJobSaving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.95rem' }}
              >
                {addJobSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
