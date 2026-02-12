'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getScrapeRuns, ScrapeRun } from '../../lib/api'

export default function RunsPage() {
  const [runs, setRuns] = useState<ScrapeRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await getScrapeRuns({ page_size: 50 })
        setRuns(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load runs')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const formatDate = (s: string | null) => {
    if (!s) return '—'
    try {
      return new Date(s).toLocaleString()
    } catch {
      return s
    }
  }

  const statusColor = (status: string) => {
    if (status === 'running') return '#059669'
    if (status === 'success') return '#16a34a'
    if (status === 'failed') return '#dc2626'
    return '#666'
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/" style={{ color: '#0066cc', textDecoration: 'none' }}>← Back to companies</Link>
      </div>
      <h1 style={{ margin: 0 }}>Scrape Runs</h1>
      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', marginTop: '1rem', color: '#c00' }}>
          {error}
        </div>
      )}
      {loading && <p style={{ color: '#666' }}>Loading...</p>}
      {!loading && !error && (
        <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Run</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Started</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Universe</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>Progress</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>Success</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>Failed</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>Blocked</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>Not found</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>No runs yet</td>
                </tr>
              ) : (
                runs.map((r) => {
                  const processed = r.success_count + r.failed_count + r.blocked_count + r.not_found_count
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        <Link href={`/runs/${r.id}`} style={{ color: '#0066cc', fontWeight: 600 }}>#{r.id}</Link>
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{formatDate(r.started_at)}</td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd', color: statusColor(r.status), fontWeight: 600 }}>{r.status}</td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{r.universe ?? '—'}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>{processed} / {r.total_companies}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd', color: '#16a34a' }}>{r.success_count}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd', color: '#dc2626' }}>{r.failed_count}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd', color: '#b45309' }}>{r.blocked_count}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd', color: '#666' }}>{r.not_found_count}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
