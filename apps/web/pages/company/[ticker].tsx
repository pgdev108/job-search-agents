'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { getCompany, postScrapeCompany, Company } from '../../lib/api'

export default function CompanyDetailPage() {
  const router = useRouter()
  const { ticker } = router.query
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (typeof ticker !== 'string') return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getCompany(ticker)
        setCompany(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load company')
        setCompany(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [ticker])

  const handleRefresh = async () => {
    if (!company || typeof ticker !== 'string') return
    setRefreshing(true)
    setError(null)
    try {
      const result = await postScrapeCompany(ticker)
      setCompany(result.company)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    try {
      return new Date(dateString).toLocaleString()
    } catch {
      return dateString
    }
  }

  const getStatusBadge = (c: Company) => {
    if (!c.last_scrape_status) return <span style={{ color: '#666' }}>Not scraped</span>
    if (c.last_scrape_status === 'success') return <span style={{ color: 'green', fontWeight: 600 }}>✓ Success</span>
    if (c.last_scrape_status === 'failed') return <span style={{ color: '#c00', fontWeight: 600 }}>✗ Failed</span>
    if (c.last_scrape_status === 'blocked') return <span style={{ color: '#b8860b', fontWeight: 600 }}>Blocked</span>
    if (c.last_scrape_status === 'not_found') return <span style={{ color: '#666', fontWeight: 600 }}>Not found</span>
    return <span style={{ color: '#666' }}>{c.last_scrape_status}</span>
  }

  if (loading || !ticker) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (error && !company) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <p style={{ color: '#c00' }}>{error}</p>
        <Link href="/" style={{ color: '#0066cc' }}>← Back to companies</Link>
      </div>
    )
  }

  if (!company) return null

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/" style={{ color: '#0066cc', textDecoration: 'none' }}>← Back to companies</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0 }}>{company.name}</h1>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: refreshing ? '#ccc' : '#0066cc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', marginTop: '1rem', color: '#c00' }}>
          {error}
        </div>
      )}

      <dl style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem 1.5rem', marginTop: '1.5rem' }}>
        <dt style={{ color: '#666', fontWeight: 600 }}>Ticker</dt>
        <dd style={{ margin: 0 }}>{company.ticker}</dd>

        <dt style={{ color: '#666', fontWeight: 600 }}>Sector</dt>
        <dd style={{ margin: 0 }}>{company.sector ?? '—'}</dd>

        <dt style={{ color: '#666', fontWeight: 600 }}>Industry</dt>
        <dd style={{ margin: 0 }}>{company.industry ?? '—'}</dd>

        <dt style={{ color: '#666', fontWeight: 600 }}>HQ City</dt>
        <dd style={{ margin: 0 }}>{company.hq_city ?? company.hq_location ?? '—'}</dd>

        <dt style={{ color: '#666', fontWeight: 600 }}>HQ State</dt>
        <dd style={{ margin: 0 }}>{company.hq_state ?? '—'}</dd>

        <dt style={{ color: '#666', fontWeight: 600 }}>Career Page</dt>
        <dd style={{ margin: 0 }}>
          {company.career_page_url ? (
            <a href={company.career_page_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc' }}>
              {company.career_page_url}
            </a>
          ) : (
            '—'
          )}
        </dd>

        <dt style={{ color: '#666', fontWeight: 600 }}>Job Count</dt>
        <dd style={{ margin: 0 }}>{company.job_count !== null ? company.job_count.toLocaleString() : '—'}</dd>

        <dt style={{ color: '#666', fontWeight: 600 }}>Scrape Status</dt>
        <dd style={{ margin: 0 }}>{getStatusBadge(company)}</dd>

        <dt style={{ color: '#666', fontWeight: 600 }}>Last Scraped</dt>
        <dd style={{ margin: 0 }}>{formatDate(company.last_scraped_at)}</dd>

        {company.last_scrape_error && (
          <>
            <dt style={{ color: '#666', fontWeight: 600 }}>Last Error</dt>
            <dd style={{ margin: 0, color: '#c00', fontSize: '0.9rem' }}>{company.last_scrape_error}</dd>
          </>
        )}
      </dl>
    </div>
  )
}
