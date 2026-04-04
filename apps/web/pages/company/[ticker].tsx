'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { getCompany, postScrapeCompany, patchCompany, getApplications, createApplication, updateApplication, getApplicationStatuses, Company, JobApplication } from '../../lib/api'

export default function CompanyDetailPage() {
  const router = useRouter()
  const { ticker } = router.query
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editCareerUrl, setEditCareerUrl] = useState('')
  const [editNotInterested, setEditNotInterested] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [applications, setApplications] = useState<JobApplication[]>([])
  const [applicationStatuses, setApplicationStatuses] = useState<string[]>(['Applied', 'Phone Screen', 'Interview', 'Offer', 'Rejected', 'Withdrawn'])
  const [addJobOpen, setAddJobOpen] = useState(false)
  const [addJobUrl, setAddJobUrl] = useState('')
  const [addJobTitle, setAddJobTitle] = useState('')
  const [addJobDate, setAddJobDate] = useState('')
  const [addJobStatus, setAddJobStatus] = useState('Applied')
  const [addJobNotes, setAddJobNotes] = useState('')
  const [addJobSaving, setAddJobSaving] = useState(false)
  const [addJobError, setAddJobError] = useState<string | null>(null)
  const [editingApp, setEditingApp] = useState<JobApplication | null>(null)
  const [editAppStatus, setEditAppStatus] = useState('')
  const [editAppNotes, setEditAppNotes] = useState('')
  const [editAppSaving, setEditAppSaving] = useState(false)

  useEffect(() => {
    if (typeof ticker !== 'string') return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [data, apps, statuses] = await Promise.all([
          getCompany(ticker),
          getApplications(ticker).catch(() => []),
          getApplicationStatuses().catch(() => ['Applied', 'Phone Screen', 'Interview', 'Offer', 'Rejected', 'Withdrawn']),
        ])
        setCompany(data)
        setApplications(apps)
        setApplicationStatuses(statuses)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load company')
        setCompany(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [ticker])

  const today = new Date().toISOString().slice(0, 10)

  const handleAddJobOpen = () => {
    setAddJobUrl('')
    setAddJobTitle('')
    setAddJobDate(today)
    setAddJobStatus('Applied')
    setAddJobNotes('')
    setAddJobError(null)
    setAddJobOpen(true)
  }

  const handleAddJobSave = async () => {
    if (!company || typeof ticker !== 'string') return
    if (!addJobUrl.trim()) { setAddJobError('Job URL is required'); return }
    setAddJobSaving(true)
    setAddJobError(null)
    try {
      const created = await createApplication(ticker, {
        job_url: addJobUrl.trim(),
        job_title: addJobTitle.trim() || undefined,
        applied_date: addJobDate,
        status: addJobStatus,
        notes: addJobNotes.trim() || undefined,
      })
      setApplications((prev) => [created, ...prev])
      setAddJobOpen(false)
    } catch (err) {
      setAddJobError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setAddJobSaving(false)
    }
  }

  const handleEditAppOpen = (app: JobApplication) => {
    setEditingApp(app)
    setEditAppStatus(app.status)
    setEditAppNotes(app.notes ?? '')
  }

  const handleEditAppSave = async () => {
    if (!editingApp) return
    setEditAppSaving(true)
    try {
      const updated = await updateApplication(editingApp.id, { status: editAppStatus, notes: editAppNotes || undefined })
      setApplications((prev) => prev.map((a) => a.id === updated.id ? updated : a))
      setEditingApp(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setEditAppSaving(false)
    }
  }

  const handleEditOpen = () => {
    if (!company) return
    setEditCareerUrl(company.career_page_url ?? '')
    setEditNotInterested(company.not_interested)
    setEditError(null)
    setEditing(true)
  }

  const handleEditSave = async () => {
    if (!company || typeof ticker !== 'string') return
    setEditSaving(true)
    setEditError(null)
    try {
      const updated = await patchCompany(ticker, { career_page_url: editCareerUrl, not_interested: editNotInterested })
      setCompany(updated)
      setEditing(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setEditSaving(false)
    }
  }

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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handleEditOpen}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleAddJobOpen}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
          >
            Add Job
          </button>
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

        <dt style={{ color: '#666', fontWeight: 600 }}>Not Interested</dt>
        <dd style={{ margin: 0 }}>
          {company.not_interested
            ? <span style={{ color: '#dc2626', fontWeight: 600 }}>Yes — excluded from scrape runs</span>
            : <span style={{ color: '#666' }}>No</span>}
        </dd>

        {company.career_page_url && (
          <>
            <dt style={{ color: '#666', fontWeight: 600 }}>Bulk Scrape</dt>
            <dd style={{ margin: 0, color: '#059669', fontWeight: 600 }}>Excluded — career URL already set</dd>
          </>
        )}
      </dl>

      {/* Job Applications */}
      <div style={{ marginTop: '2.5rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Job Applications ({applications.length})</h2>
        {applications.length === 0 ? (
          <p style={{ color: '#666' }}>No applications tracked yet. Click "Add Job" to start.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Job Title</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Job URL</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Date Applied</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Notes</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ddd' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => {
                  const statusColors: Record<string, string> = {
                    'Applied': '#0066cc', 'Phone Screen': '#7c3aed', 'Interview': '#b45309',
                    'Offer': '#16a34a', 'Rejected': '#dc2626', 'Withdrawn': '#6b7280',
                  }
                  return (
                    <tr key={app.id} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{app.job_title ?? '—'}</td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <a href={app.job_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc' }} title={app.job_url}>
                          {app.job_url.length > 40 ? app.job_url.slice(0, 40) + '…' : app.job_url}
                        </a>
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{app.applied_date}</td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd', fontWeight: 600, color: statusColors[app.status] ?? '#333' }}>{app.status}</td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd', fontSize: '0.875rem', color: '#555' }}>{app.notes ?? '—'}</td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'center' }}>
                        <button
                          onClick={() => handleEditAppOpen(app)}
                          style={{ padding: '0.3rem 0.75rem', fontSize: '0.875rem', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Update
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Job modal */}
      {addJobOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '2rem', width: '500px', maxWidth: '95vw', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
            <h2 style={{ margin: '0 0 1.5rem' }}>Add Job — {company.name}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Job Posting URL *</label>
              <input type="url" value={addJobUrl} onChange={(e) => setAddJobUrl(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Job Title</label>
              <input type="text" value={addJobTitle} onChange={(e) => setAddJobTitle(e.target.value)} placeholder="e.g. Senior Software Engineer" style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Date Applied</label>
                <input type="date" value={addJobDate} onChange={(e) => setAddJobDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Status</label>
                <select value={addJobStatus} onChange={(e) => setAddJobStatus(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}>
                  {applicationStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Notes</label>
              <textarea value={addJobNotes} onChange={(e) => setAddJobNotes(e.target.value)} placeholder="Optional notes..." rows={2} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            {addJobError && <div style={{ padding: '0.5rem', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.875rem' }}>{addJobError}</div>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setAddJobOpen(false)} disabled={addJobSaving} style={{ padding: '0.5rem 1.25rem', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: 'white', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAddJobSave} disabled={addJobSaving} style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: '4px', backgroundColor: addJobSaving ? '#ccc' : '#059669', color: 'white', cursor: addJobSaving ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                {addJobSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update application status modal */}
      {editingApp && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '2rem', width: '400px', maxWidth: '95vw', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
            <h2 style={{ margin: '0 0 1.5rem' }}>Update Application</h2>
            <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#555' }}>
              {editingApp.job_title && <strong>{editingApp.job_title}</strong>}
              <div style={{ wordBreak: 'break-all' }}><a href={editingApp.job_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc' }}>{editingApp.job_url}</a></div>
            </div>
            <div style={{ marginBottom: '1rem', marginTop: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Status</label>
              <select value={editAppStatus} onChange={(e) => setEditAppStatus(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem' }}>
                {applicationStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Notes</label>
              <textarea value={editAppNotes} onChange={(e) => setEditAppNotes(e.target.value)} rows={2} style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingApp(null)} disabled={editAppSaving} style={{ padding: '0.5rem 1.25rem', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: 'white', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleEditAppSave} disabled={editAppSaving} style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: '4px', backgroundColor: editAppSaving ? '#ccc' : '#0066cc', color: 'white', cursor: editAppSaving ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                {editAppSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '2rem', width: '480px', maxWidth: '95vw', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
            <h2 style={{ margin: '0 0 1.5rem' }}>Edit — {company.name}</h2>

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
                onClick={() => setEditing(false)}
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
    </div>
  )
}
