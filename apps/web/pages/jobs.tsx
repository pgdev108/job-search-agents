'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  listAllApplications,
  updateApplication,
  deleteApplication,
  getApplicationStatuses,
  JobApplicationWithCompany,
} from '../lib/api';

const STATUS_COLORS: Record<string, string> = {
  'To Be Applied': '#0891b2',
  Applied: '#2563eb',
  'Phone Screen': '#7c3aed',
  Interview: '#d97706',
  Offer: '#16a34a',
  Rejected: '#dc2626',
  Withdrawn: '#6b7280',
};

const DEFAULT_STATUSES = [
  'To Be Applied', 'Applied', 'Phone Screen', 'Interview', 'Offer', 'Rejected', 'Withdrawn',
];

const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Status multi-select dropdown
// ---------------------------------------------------------------------------
function StatusMultiSelect({
  allStatuses,
  selected,
  onChange,
}: {
  allStatuses: string[];
  selected: string[];
  onChange: (s: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (s: string) => {
    onChange(selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s]);
  };

  const label =
    selected.length === 0
      ? 'All Statuses'
      : selected.length === 1
      ? selected[0]
      : `${selected.length} statuses`;

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: '160px' }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          padding: '0.5rem 2rem 0.5rem 0.75rem',
          border: `1px solid ${open ? '#0066cc' : '#ccc'}`,
          borderRadius: '4px',
          cursor: 'pointer',
          backgroundColor: 'white',
          fontSize: '0.95rem',
          position: 'relative',
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        {label}
        <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`, color: '#6b7280', fontSize: '0.75rem', transition: 'transform 0.15s' }}>▼</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50, backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: '100%', whiteSpace: 'nowrap' }}>
          <label
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '0.85rem', color: '#666' }}
          >
            <input
              type="checkbox"
              checked={selected.length === 0}
              onChange={() => onChange([])}
              style={{ width: '1rem', height: '1rem' }}
            />
            All Statuses
          </label>
          {allStatuses.map((s) => (
            <label
              key={s}
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem', cursor: 'pointer', backgroundColor: selected.includes(s) ? '#eff6ff' : 'white' }}
              onMouseEnter={(e) => { if (!selected.includes(s)) (e.currentTarget as HTMLElement).style.backgroundColor = '#f9fafb'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = selected.includes(s) ? '#eff6ff' : 'white'; }}
            >
              <input type="checkbox" checked={selected.includes(s)} onChange={() => toggle(s)} style={{ width: '1rem', height: '1rem' }} />
              <span style={{ color: STATUS_COLORS[s] ?? '#333', fontWeight: 500, fontSize: '0.9rem' }}>{s}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function JobsTrackerPage() {
  const [applications, setApplications] = useState<JobApplicationWithCompany[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [allStatuses, setAllStatuses] = useState<string[]>(DEFAULT_STATUSES);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('applied_date_desc');

  // Edit modal state
  const [editingApp, setEditingApp] = useState<JobApplicationWithCompany | null>(null);
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editJobUrl, setEditJobUrl] = useState('');
  const [editAppliedDate, setEditAppliedDate] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Load statuses on mount
  useEffect(() => {
    getApplicationStatuses().then(setAllStatuses).catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAllApplications({
        status: selectedStatuses.length ? selectedStatuses : undefined,
        search: search || undefined,
        sort,
        page,
        page_size: PAGE_SIZE,
      });
      setApplications(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [selectedStatuses, search, sort, page]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  const handleStatusFilterChange = (statuses: string[]) => {
    setSelectedStatuses(statuses);
    setPage(1);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value);
    setPage(1);
  };

  const handleEditOpen = (app: JobApplicationWithCompany) => {
    setEditingApp(app);
    setEditJobTitle(app.job_title ?? '');
    setEditJobUrl(app.job_url);
    setEditAppliedDate(app.applied_date);
    setEditStatus(app.status);
    setEditNotes(app.notes ?? '');
    setEditError(null);
  };

  const handleEditSave = async () => {
    if (!editingApp) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const updated = await updateApplication(editingApp.id, {
        job_title: editJobTitle || undefined,
        job_url: editJobUrl,
        applied_date: editAppliedDate,
        status: editStatus,
        notes: editNotes || undefined,
      });
      setApplications((prev) =>
        prev.map((a) => a.id === updated.id ? { ...updated, company_name: editingApp.company_name } : a)
      );
      setEditingApp(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Nav */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/" style={{ color: '#0066cc', textDecoration: 'none' }}>← Back to Companies</Link>
      </div>
      <h1 style={{ margin: '0 0 2rem', fontSize: '1.75rem' }}>Jobs Tracker</h1>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ minWidth: '240px' }}>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search job title or company…"
            style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}
          />
        </div>

        {/* Status multi-select */}
        <StatusMultiSelect
          allStatuses={allStatuses}
          selected={selectedStatuses}
          onChange={handleStatusFilterChange}
        />

        {/* Sort */}
        <select
          value={sort}
          onChange={handleSortChange}
          style={{ padding: '0.5rem 0.75rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem' }}
        >
          <option value="applied_date_desc">Date: Newest First</option>
          <option value="applied_date_asc">Date: Oldest First</option>
          <option value="company_asc">Company A–Z</option>
        </select>

        {/* Clear filters */}
        {(selectedStatuses.length > 0 || search) && (
          <button
            onClick={() => { setSelectedStatuses([]); setSearchInput(''); setSearch(''); setPage(1); }}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: 'white', cursor: 'pointer', fontSize: '0.9rem', color: '#666' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      {!loading && (
        <div style={{ marginBottom: '1rem', color: '#666', fontSize: '0.9rem' }}>
          Showing {applications.length} of {total} applications
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', color: '#dc2626', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p style={{ color: '#666' }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Company</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Job Title</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>URL</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Applied Date</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Notes</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ddd' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                    No applications found.
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                      <Link href={`/company/id/${app.company_id}`} style={{ color: '#0066cc', fontWeight: 600 }}>
                        {app.company_name}
                      </Link>
                      {(app.hq_city || app.hq_state) && (
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>
                          {[app.hq_city, app.hq_state].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{app.job_title ?? '—'}</td>
                    <td style={{ padding: '0.75rem', border: '1px solid #ddd', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <a href={app.job_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc' }} title={app.job_url}>
                        {app.job_url.length > 40 ? app.job_url.slice(0, 40) + '…' : app.job_url}
                      </a>
                    </td>
                    <td style={{ padding: '0.75rem', border: '1px solid #ddd', whiteSpace: 'nowrap' }}>{app.applied_date}</td>
                    <td style={{ padding: '0.75rem', border: '1px solid #ddd', whiteSpace: 'nowrap' }}>
                      <span style={{ color: STATUS_COLORS[app.status] ?? '#333', fontWeight: 600 }}>{app.status}</span>
                    </td>
                    <td style={{ padding: '0.75rem', border: '1px solid #ddd', color: '#555', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {app.notes ?? '—'}
                    </td>
                    <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleEditOpen(app)}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete this application for "${app.company_name}"?`)) return;
                            try {
                              await deleteApplication(app.id);
                              setApplications((prev) => prev.filter((a) => a.id !== app.id));
                              setTotal((t) => t - 1);
                            } catch (err) {
                              alert(err instanceof Error ? err.message : 'Delete failed');
                            }
                          }}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'center' }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: '0.5rem 1rem', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: page === 1 ? '#f5f5f5' : 'white', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
          >
            Previous
          </button>
          <span style={{ color: '#666', fontSize: '0.9rem' }}>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{ padding: '0.5rem 1rem', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: page === totalPages ? '#f5f5f5' : 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
          >
            Next
          </button>
        </div>
      )}

      {/* Edit modal */}
      {editingApp && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setEditingApp(null)}
        >
          <div
            style={{ backgroundColor: 'white', borderRadius: '8px', padding: '2rem', width: '480px', maxWidth: '95vw', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 1.5rem' }}>Edit Application</h2>
            <div style={{ marginBottom: '0.5rem', color: '#6b7280', fontSize: '0.9rem' }}>{editingApp.company_name}</div>

            {editError && (
              <div style={{ padding: '0.5rem', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                {editError}
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Job Title</label>
              <input
                type="text"
                value={editJobTitle}
                onChange={(e) => setEditJobTitle(e.target.value)}
                placeholder="Software Engineer"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Job URL</label>
              <input
                type="url"
                value={editJobUrl}
                onChange={(e) => setEditJobUrl(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Applied Date</label>
              <input
                type="date"
                value={editAppliedDate}
                onChange={(e) => setEditAppliedDate(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem' }}
              >
                {allStatuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingApp(null)}
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
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
