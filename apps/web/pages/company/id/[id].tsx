'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import {
  getCompanyById,
  patchCompanyById,
  getApplications,
  getApplicationStatuses,
  createApplication,
  updateApplication,
  deleteApplication,
  deleteCompany,
  getTags,
  Company,
  JobApplication,
} from '../../../lib/api'

function TagMultiSelect({
  allTags,
  selected,
  onChange,
}: {
  allTags: string[]
  selected: string[]
  onChange: (tags: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (tag: string) => {
    onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag])
  }

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Tags</label>
      <div ref={ref} style={{ position: 'relative' }}>
        <div
          onClick={() => setOpen((o) => !o)}
          style={{
            width: '100%', minHeight: '38px', padding: '0.35rem 2rem 0.35rem 0.5rem',
            border: `1px solid ${open ? '#0066cc' : '#ccc'}`, borderRadius: '4px',
            cursor: 'pointer', backgroundColor: 'white', boxSizing: 'border-box',
            display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', position: 'relative',
          }}
        >
          {selected.length === 0 ? (
            <span style={{ color: '#9ca3af', fontSize: '0.95rem' }}>Select tags…</span>
          ) : (
            selected.map((tag) => (
              <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', backgroundColor: '#dbeafe', color: '#1d4ed8', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 500 }}>
                {tag}
                <span onClick={(e) => { e.stopPropagation(); toggle(tag) }} style={{ cursor: 'pointer', fontWeight: 700, lineHeight: 1, color: '#1d4ed8' }}>×</span>
              </span>
            ))
          )}
          <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`, color: '#6b7280', fontSize: '0.75rem', pointerEvents: 'none', transition: 'transform 0.15s' }}>▼</span>
        </div>
        {open && (
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
            {allTags.length === 0 ? (
              <div style={{ padding: '0.75rem', color: '#9ca3af', fontSize: '0.9rem' }}>
                No tags available. <Link href='/tags' target='_blank' style={{ color: '#0066cc' }}>Add tags</Link>
              </div>
            ) : (
              allTags.map((tag) => (
                <label
                  key={tag}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem', cursor: 'pointer', backgroundColor: selected.includes(tag) ? '#eff6ff' : 'white' }}
                  onMouseEnter={(e) => { if (!selected.includes(tag)) (e.currentTarget as HTMLElement).style.backgroundColor = '#f9fafb' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = selected.includes(tag) ? '#eff6ff' : 'white' }}
                >
                  <input type='checkbox' checked={selected.includes(tag)} onChange={() => toggle(tag)} style={{ width: '1rem', height: '1rem' }} />
                  <span style={{ fontSize: '0.9rem' }}>{tag}</span>
                </label>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function CompanyDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add Job modal state
  const [addJobOpen, setAddJobOpen] = useState(false)
  const [addJobUrl, setAddJobUrl] = useState('')
  const [addJobTitle, setAddJobTitle] = useState('')
  const [addJobDate, setAddJobDate] = useState('')
  const [addJobStatus, setAddJobStatus] = useState('To Be Applied')
  const [addJobNotes, setAddJobNotes] = useState('')
  const [addJobSaving, setAddJobSaving] = useState(false)
  const [addJobError, setAddJobError] = useState<string | null>(null)

  // Edit modal state
  const [editing, setEditing] = useState(false)
  const [editCareerUrl, setEditCareerUrl] = useState('')
  const [editNotInterested, setEditNotInterested] = useState(false)
  const [editSelectedTags, setEditSelectedTags] = useState<string[]>([])
  const [editWebsite, setEditWebsite] = useState('')
  const [editHqCity, setEditHqCity] = useState('')
  const [editHqState, setEditHqState] = useState('')
  const [editSector, setEditSector] = useState('')
  const [editIndustry, setEditIndustry] = useState('')
  const [editFoundedYear, setEditFoundedYear] = useState('')
  const [editCompanySize, setEditCompanySize] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [allTags, setAllTags] = useState<string[]>([])

  // Applications
  const [applicationStatuses, setApplicationStatuses] = useState<string[]>(['To Be Applied', 'Applied', 'Phone Screen', 'Interview', 'Offer', 'Rejected', 'Withdrawn'])
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [editingApp, setEditingApp] = useState<JobApplication | null>(null)
  const [appEditJobTitle, setAppEditJobTitle] = useState('')
  const [appEditJobUrl, setAppEditJobUrl] = useState('')
  const [appEditAppliedDate, setAppEditAppliedDate] = useState('')
  const [appEditStatus, setAppEditStatus] = useState('')
  const [appEditNotes, setAppEditNotes] = useState('')
  const [appEditSaving, setAppEditSaving] = useState(false)

  useEffect(() => {
    if (typeof id !== 'string') return
    const numId = parseInt(id, 10)
    if (isNaN(numId)) { setError('Invalid company ID'); setLoading(false); return }
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [data, statuses, apps, tags] = await Promise.all([
          getCompanyById(numId),
          getApplicationStatuses().catch(() => ['To Be Applied', 'Applied', 'Phone Screen', 'Interview', 'Offer', 'Rejected', 'Withdrawn']),
          getApplications(numId).catch(() => []),
          getTags().catch(() => []),
        ])
        setCompany(data)
        setApplicationStatuses(statuses)
        setApplications(apps)
        setAllTags(tags)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load company')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const today = new Date().toISOString().slice(0, 10)

  const handleAddJobOpen = () => {
    setAddJobUrl('')
    setAddJobTitle('')
    setAddJobDate(today)
    setAddJobStatus('To Be Applied')
    setAddJobNotes('')
    setAddJobError(null)
    setAddJobOpen(true)
  }

  const handleAddJobSave = async () => {
    if (!company) return
    if (!addJobUrl.trim()) { setAddJobError('Job URL is required'); return }
    setAddJobSaving(true)
    setAddJobError(null)
    try {
      const newApp = await createApplication(company.id, {
        job_url: addJobUrl.trim(),
        job_title: addJobTitle.trim() || undefined,
        applied_date: addJobDate,
        status: addJobStatus,
        notes: addJobNotes.trim() || undefined,
      })
      setApplications((prev) => [newApp, ...prev])
      setAddJobOpen(false)
    } catch (err) {
      setAddJobError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setAddJobSaving(false)
    }
  }

  const handleDeleteCompany = async () => {
    if (!company) return
    if (!confirm(`Delete "${company.name}"? This cannot be undone.`)) return
    try {
      await deleteCompany(company.id)
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handleEditOpen = () => {
    if (!company) return
    setEditCareerUrl(company.career_page_url ?? '')
    setEditNotInterested(company.not_interested)
    setEditSelectedTags(company.company_tags ? company.company_tags.split(',').map((t) => t.trim()).filter(Boolean) : [])
    setEditWebsite(company.website ?? '')
    setEditHqCity(company.hq_city ?? '')
    setEditHqState(company.hq_state ?? '')
    setEditSector(company.sector ?? '')
    setEditIndustry(company.industry ?? '')
    setEditFoundedYear(company.founded_year ? String(company.founded_year) : '')
    setEditCompanySize(company.company_size ?? '')
    setEditDescription(company.description ?? '')
    setEditError(null)
    setEditing(true)
  }

  const handleEditSave = async () => {
    if (!company) return
    setEditSaving(true)
    setEditError(null)
    try {
      const updated = await patchCompanyById(company.id, {
        career_page_url: editCareerUrl,
        not_interested: editNotInterested,
        company_tags: editSelectedTags.join(','),
        website: editWebsite,
        hq_city: editHqCity,
        hq_state: editHqState,
        sector: editSector,
        industry: editIndustry,
        description: editDescription,
        founded_year: editFoundedYear ? parseInt(editFoundedYear, 10) : undefined,
        company_size: editCompanySize,
      })
      setCompany(updated)
      setEditing(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setEditSaving(false)
    }
  }

  const handleAppEditOpen = (app: JobApplication) => {
    setEditingApp(app)
    setAppEditJobTitle(app.job_title ?? '')
    setAppEditJobUrl(app.job_url)
    setAppEditAppliedDate(app.applied_date)
    setAppEditStatus(app.status)
    setAppEditNotes(app.notes ?? '')
  }

  const handleAppEditSave = async () => {
    if (!editingApp) return
    setAppEditSaving(true)
    try {
      const updated = await updateApplication(editingApp.id, {
        job_title: appEditJobTitle || undefined,
        job_url: appEditJobUrl,
        applied_date: appEditAppliedDate,
        status: appEditStatus,
        notes: appEditNotes || undefined,
      })
      setApplications((prev) => prev.map((a) => a.id === updated.id ? updated : a))
      setEditingApp(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setAppEditSaving(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    try { return new Date(dateString).toLocaleString() } catch { return dateString }
  }

  const statusColors: Record<string, string> = {
    'To Be Applied': '#0891b2', Applied: '#2563eb', 'Phone Screen': '#7c3aed', Interview: '#d97706',
    Offer: '#16a34a', Rejected: '#dc2626', Withdrawn: '#6b7280',
  }

  if (loading || !id) {
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
        <div>
          <h1 style={{ margin: 0 }}>{company.name}</h1>
          {!company.ticker && (
            <span style={{ fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic' }}>Private company</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handleAddJobOpen}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
          >
            Add Job
          </button>
          <button
            type="button"
            onClick={handleEditOpen}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDeleteCompany}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
          >
            Delete
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', marginTop: '1rem', color: '#c00' }}>
          {error}
        </div>
      )}

      <dl style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem 1.5rem', marginTop: '1.5rem' }}>
        <dt style={{ color: '#666', fontWeight: 600 }}>Sector</dt>
        <dd style={{ margin: 0 }}>{company.sector ?? '—'}</dd>

        <dt style={{ color: '#666', fontWeight: 600 }}>Industry</dt>
        <dd style={{ margin: 0 }}>{company.industry ?? '—'}</dd>

        <dt style={{ color: '#666', fontWeight: 600 }}>HQ</dt>
        <dd style={{ margin: 0 }}>{[company.hq_city ?? company.hq_location, company.hq_state].filter(Boolean).join(', ') || '—'}</dd>

        {company.website && (
          <>
            <dt style={{ color: '#666', fontWeight: 600 }}>Website</dt>
            <dd style={{ margin: 0 }}>
              <a href={company.website} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc' }}>{company.website}</a>
            </dd>
          </>
        )}

        {company.founded_year && (
          <>
            <dt style={{ color: '#666', fontWeight: 600 }}>Founded</dt>
            <dd style={{ margin: 0 }}>{company.founded_year}</dd>
          </>
        )}

        {company.company_size && (
          <>
            <dt style={{ color: '#666', fontWeight: 600 }}>Size</dt>
            <dd style={{ margin: 0 }}>{company.company_size}</dd>
          </>
        )}

        <dt style={{ color: '#666', fontWeight: 600 }}>Career Page</dt>
        <dd style={{ margin: 0 }}>
          {company.career_page_url ? (
            <a href={company.career_page_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc' }}>
              {company.career_page_url}
            </a>
          ) : '—'}
        </dd>

        {company.company_tags && (
          <>
            <dt style={{ color: '#666', fontWeight: 600 }}>Tags</dt>
            <dd style={{ margin: 0 }}>
              {company.company_tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                <span key={tag} style={{ display: 'inline-block', padding: '2px 8px', backgroundColor: '#dbeafe', color: '#1d4ed8', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 500, marginRight: '4px' }}>
                  {tag}
                </span>
              ))}
            </dd>
          </>
        )}

        {company.description && (
          <>
            <dt style={{ color: '#666', fontWeight: 600 }}>Description</dt>
            <dd style={{ margin: 0, fontSize: '0.9rem', color: '#444' }}>{company.description}</dd>
          </>
        )}

        <dt style={{ color: '#666', fontWeight: 600 }}>Not Interested</dt>
        <dd style={{ margin: 0 }}>
          {company.not_interested
            ? <span style={{ color: '#dc2626', fontWeight: 600 }}>Yes</span>
            : <span style={{ color: '#666' }}>No</span>}
        </dd>

        <dt style={{ color: '#666', fontWeight: 600 }}>Last Updated</dt>
        <dd style={{ margin: 0 }}>{formatDate(company.updated_at)}</dd>
      </dl>

      {/* Applied Jobs */}
      <div style={{ marginTop: '2.5rem' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>
          Applied Jobs {applications.length > 0 && <span style={{ color: '#6b7280', fontWeight: 'normal', fontSize: '1rem' }}>({applications.length})</span>}
        </h2>
        {applications.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>No job applications recorded for this company.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Job Title</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>URL</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Applied Date</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Status</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Notes</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', border: '1px solid #ddd' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.6rem 0.75rem', border: '1px solid #ddd' }}>{app.job_title ?? '—'}</td>
                  <td style={{ padding: '0.6rem 0.75rem', border: '1px solid #ddd' }}>
                    <a href={app.job_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc' }}>
                      {app.job_url.length > 40 ? app.job_url.slice(0, 40) + '…' : app.job_url}
                    </a>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', border: '1px solid #ddd' }}>{app.applied_date}</td>
                  <td style={{ padding: '0.6rem 0.75rem', border: '1px solid #ddd' }}>
                    <span style={{ color: statusColors[app.status] ?? '#333', fontWeight: 600 }}>{app.status}</span>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', border: '1px solid #ddd', color: '#555' }}>{app.notes ?? '—'}</td>
                  <td style={{ padding: '0.6rem 0.75rem', border: '1px solid #ddd', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleAppEditOpen(app)}
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('Delete this application?')) return;
                          try {
                            await deleteApplication(app.id);
                            setApplications((prev) => prev.filter((a) => a.id !== app.id));
                          } catch (err) {
                            alert(err instanceof Error ? err.message : 'Delete failed');
                          }
                        }}
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit company modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '2rem', width: '560px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
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

            <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
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

            <TagMultiSelect allTags={allTags} selected={editSelectedTags} onChange={setEditSelectedTags} />

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Website</label>
              <input
                type="url"
                value={editWebsite}
                onChange={(e) => setEditWebsite(e.target.value)}
                placeholder="https://example.com"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>HQ City</label>
                <input
                  type="text"
                  value={editHqCity}
                  onChange={(e) => setEditHqCity(e.target.value)}
                  placeholder="San Francisco"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: '0 0 80px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>State</label>
                <input
                  type="text"
                  value={editHqState}
                  onChange={(e) => setEditHqState(e.target.value)}
                  placeholder="CA"
                  maxLength={2}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Sector</label>
                <input
                  type="text"
                  value={editSector}
                  onChange={(e) => setEditSector(e.target.value)}
                  placeholder="Technology"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Industry</label>
                <input
                  type="text"
                  value={editIndustry}
                  onChange={(e) => setEditIndustry(e.target.value)}
                  placeholder="Software"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Founded Year</label>
                <input
                  type="number"
                  value={editFoundedYear}
                  onChange={(e) => setEditFoundedYear(e.target.value)}
                  placeholder="2005"
                  min={1800}
                  max={new Date().getFullYear()}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Company Size</label>
                <input
                  type="text"
                  value={editCompanySize}
                  onChange={(e) => setEditCompanySize(e.target.value)}
                  placeholder="1001-5000"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Brief description of the company..."
                rows={3}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            {editError && (
              <div style={{ padding: '0.5rem', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                {editError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditing(false)} disabled={editSaving} style={{ padding: '0.5rem 1.25rem', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: 'white', cursor: 'pointer', fontSize: '0.95rem' }}>
                Cancel
              </button>
              <button onClick={handleEditSave} disabled={editSaving} style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: '4px', backgroundColor: editSaving ? '#ccc' : '#0066cc', color: 'white', cursor: editSaving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.95rem' }}>
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Job modal */}
      {addJobOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setAddJobOpen(false)}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '2rem', width: '500px', maxWidth: '95vw', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 1.5rem' }}>Add Job — {company.name}</h2>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Job Posting URL *</label>
              <input type="url" value={addJobUrl} onChange={(e) => setAddJobUrl(e.target.value)} placeholder="https://..."
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Job Title</label>
              <input type="text" value={addJobTitle} onChange={(e) => setAddJobTitle(e.target.value)} placeholder="e.g. Senior Software Engineer"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Date Applied</label>
                <input type="date" value={addJobDate} onChange={(e) => setAddJobDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Status</label>
                <select value={addJobStatus} onChange={(e) => setAddJobStatus(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem' }}>
                  {applicationStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Notes</label>
              <textarea value={addJobNotes} onChange={(e) => setAddJobNotes(e.target.value)} placeholder="Optional notes..." rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>

            {addJobError && (
              <div style={{ padding: '0.5rem', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                {addJobError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setAddJobOpen(false)} disabled={addJobSaving}
                style={{ padding: '0.5rem 1.25rem', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: 'white', cursor: 'pointer', fontSize: '0.95rem' }}>
                Cancel
              </button>
              <button onClick={handleAddJobSave} disabled={addJobSaving}
                style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: '4px', backgroundColor: addJobSaving ? '#ccc' : '#059669', color: 'white', cursor: addJobSaving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.95rem' }}>
                {addJobSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit application modal */}
      {editingApp && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '2rem', width: '420px', maxWidth: '95vw', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
            <h2 style={{ margin: '0 0 1.5rem' }}>Edit Application</h2>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Job Title</label>
              <input
                type="text"
                value={appEditJobTitle}
                onChange={(e) => setAppEditJobTitle(e.target.value)}
                placeholder="Software Engineer"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Job URL</label>
              <input
                type="url"
                value={appEditJobUrl}
                onChange={(e) => setAppEditJobUrl(e.target.value)}
                placeholder="https://..."
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Applied Date</label>
              <input
                type="date"
                value={appEditAppliedDate}
                onChange={(e) => setAppEditAppliedDate(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Status</label>
              <select
                value={appEditStatus}
                onChange={(e) => setAppEditStatus(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem' }}
              >
                {applicationStatuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Notes</label>
              <textarea
                value={appEditNotes}
                onChange={(e) => setAppEditNotes(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingApp(null)} disabled={appEditSaving} style={{ padding: '0.5rem 1.25rem', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: 'white', cursor: 'pointer', fontSize: '0.95rem' }}>
                Cancel
              </button>
              <button onClick={handleAppEditSave} disabled={appEditSaving} style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: '4px', backgroundColor: appEditSaving ? '#ccc' : '#0066cc', color: 'white', cursor: appEditSaving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.95rem' }}>
                {appEditSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
