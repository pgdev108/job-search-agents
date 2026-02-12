'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { getScrapeRun, getScrapeRunCompanies, ScrapeRunDetail, Company } from '../../lib/api'

export default function RunDetailPage() {
  const router = useRouter()
  const { runId } = router.query
  const [run, setRun] = useState<ScrapeRunDetail | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all') // all | failed | blocked

  const id = typeof runId === 'string' ? parseInt(runId, 10) : NaN

  useEffect(() => {
    if (!id || isNaN(id)) return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [runData, companiesData] = await Promise.all([
          getScrapeRun(id),
          getScrapeRunCompanies(id),
        ])
        setRun(runData)
        setCompanies(companiesData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load run')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // Poll run status every 5s while running (single request per tick to avoid extra load)
  useEffect(() => {
    if (!id || isNaN(id) || !run || run.status !== 'running') return
    const t = setInterval(async () => {
      try {
        const runData = await getScrapeRun(id)
        setRun(runData)
        if (runData.status !== 'running') {
          const companiesData = await getScrapeRunCompanies(id)
          setCompanies(companiesData)
        }
      } catch {
        // ignore
      }
    }, 5000)
    return () => clearInterval(t)
  }, [id, run?.status])

  const filteredCompanies = companies.filter((c) => {
    if (statusFilter === 'all') return true
    return c.last_scrape_status === statusFilter
  })

  const formatDate = (s: string | null) => {
    if (!s) return '—'
    try {
      return new Date(s).toLocaleString()
    } catch {
      return s
    }
  }

  const statusBadge = (c: Company) => {
    const s = c.last_scrape_status || '—'
    if (s === 'success') return <span style={{ color: '#16a34a', fontWeight: 600 }}>success</span>
    if (s === 'failed') return <span style={{ color: '#dc2626', fontWeight: 600 }}>failed</span>
    if (s === 'blocked') return <span style={{ color: '#b45309', fontWeight: 600 }}>blocked</span>
    if (s === 'not_found') return <span style={{ color: '#666', fontWeight: 600 }}>not_found</span>
    return <span>{s}</span>
  }

  if (loading && !run) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (error && !run) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <p style={{ color: '#c00' }}>{error}</p>
        <Link href="/runs" style={{ color: '#0066cc' }}>← Back to runs</Link>
      </div>
    )
  }

  if (!run) return null

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/runs" style={{ color: '#0066cc', textDecoration: 'none' }}>← Back to runs</Link>
      </div>
      <h1 style={{ margin: 0 }}>Run #{run.id}</h1>
      <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
          <div><strong>Status</strong><br /><span style={{ color: run.status === 'running' ? '#059669' : run.status === 'success' ? '#16a34a' : '#dc2626' }}>{run.status}</span></div>
          <div><strong>Started</strong><br />{formatDate(run.started_at)}</div>
          <div><strong>Finished</strong><br />{formatDate(run.finished_at)}</div>
          <div><strong>Universe</strong><br />{run.universe ?? '—'}</div>
          <div><strong>Progress</strong><br />{run.processed} / {run.total_companies} ({run.percent_complete.toFixed(0)}%)</div>
          <div><strong>Success</strong><br /><span style={{ color: '#16a34a' }}>{run.success_count}</span></div>
          <div><strong>Failed</strong><br /><span style={{ color: '#dc2626' }}>{run.failed_count}</span></div>
          <div><strong>Blocked</strong><br /><span style={{ color: '#b45309' }}>{run.blocked_count}</span></div>
          <div><strong>Not found</strong><br /><span style={{ color: '#666' }}>{run.not_found_count}</span></div>
        </div>
        {run.status === 'running' && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${run.percent_complete}%`, backgroundColor: '#059669', transition: 'width 0.3s' }} />
            </div>
          </div>
        )}
        {run.last_error && (
          <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: '#fef2f2', fontSize: '0.875rem', color: '#991b1b' }}>
            Last error: {run.last_error}
          </div>
        )}
      </div>

      <h2 style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>Companies in this run</h2>
      <div style={{ marginBottom: '0.75rem' }}>
        <label>Filter: </label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '0.35rem', marginLeft: '0.5rem' }}
        >
          <option value="all">All ({companies.length})</option>
          <option value="failed">Failed only</option>
          <option value="blocked">Blocked only</option>
          <option value="not_found">Not found only</option>
          <option value="success">Success only</option>
        </select>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Ticker</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Name</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Status</th>
              <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>Job count</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Career page</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Error</th>
            </tr>
          </thead>
          <tbody>
            {filteredCompanies.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                  {companies.length === 0 && run.status === 'running' ? 'Companies will appear as they are processed...' : 'No companies match the filter'}
                </td>
              </tr>
            ) : (
              filteredCompanies.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                    <Link href={`/company/${c.ticker}`} style={{ color: '#0066cc' }}>{c.ticker}</Link>
                  </td>
                  <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{c.name}</td>
                  <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{statusBadge(c)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>{c.job_count ?? '—'}</td>
                  <td style={{ padding: '0.75rem', border: '1px solid #ddd', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.career_page_url ? (
                      <a href={c.career_page_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc' }}>Link</a>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '0.75rem', border: '1px solid #ddd', fontSize: '0.8rem', color: '#991b1b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.last_scrape_error ?? ''}>
                    {c.last_scrape_error ? c.last_scrape_error.slice(0, 80) + (c.last_scrape_error.length > 80 ? '…' : '') : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
