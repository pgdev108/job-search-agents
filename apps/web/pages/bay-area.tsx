'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  getBayAreaCompanies,
  getBayAreaLocations,
  getBayAreaTags,
  getBayAreaSizes,
  BayAreaCompany,
  BayAreaListParams,
} from '../lib/api'

export default function BayAreaPage() {
  const [companies, setCompanies] = useState<BayAreaCompany[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [sizes, setSizes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [selectedSize, setSelectedSize] = useState('')
  const [sort, setSort] = useState<BayAreaListParams['sort']>('name_asc')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  // Load filter options on mount
  useEffect(() => {
    Promise.all([
      getBayAreaLocations().catch(() => []),
      getBayAreaTags().catch(() => []),
      getBayAreaSizes().catch(() => []),
    ]).then(([locs, ts, ss]) => {
      setLocations(locs)
      setTags(ts)
      setSizes(ss)
    })
  }, [])

  const loadCompanies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getBayAreaCompanies({
        search: search || undefined,
        location: selectedLocation || undefined,
        tag: selectedTag || undefined,
        company_size: selectedSize || undefined,
        sort,
        page,
        page_size: pageSize,
      })
      setCompanies(res.items)
      setTotal(res.total)
      setTotalPages(res.total_pages)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load companies')
    } finally {
      setLoading(false)
    }
  }, [search, selectedLocation, selectedTag, selectedSize, sort, page, pageSize])

  useEffect(() => {
    loadCompanies()
  }, [loadCompanies])

  function resetFilters() {
    setSearchInput('')
    setSearch('')
    setSelectedLocation('')
    setSelectedTag('')
    setSelectedSize('')
    setSort('name_asc')
    setPage(1)
  }

  const hasFilters = search || selectedLocation || selectedTag || selectedSize

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <Link href="/" style={{ color: '#0070f3', textDecoration: 'none', fontSize: '14px' }}>
          ← Back to Companies
        </Link>
        <h1 style={{ margin: 0, fontSize: '22px' }}>Bay Area Companies</h1>
        <span style={{ color: '#666', fontSize: '14px' }}>
          {total > 0 ? `${total.toLocaleString()} companies` : ''}
        </span>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search name or description…"
          value={searchInput}
          onChange={e => { setSearchInput(e.target.value); setPage(1) }}
          style={{ padding: '7px 10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px', width: '220px' }}
        />

        <select
          value={selectedLocation}
          onChange={e => { setSelectedLocation(e.target.value); setPage(1) }}
          style={{ padding: '7px 10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }}
        >
          <option value="">All Locations</option>
          {locations.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        <select
          value={selectedTag}
          onChange={e => { setSelectedTag(e.target.value); setPage(1) }}
          style={{ padding: '7px 10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px', maxWidth: '220px' }}
        >
          <option value="">All Tags</option>
          {tags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={selectedSize}
          onChange={e => { setSelectedSize(e.target.value); setPage(1) }}
          style={{ padding: '7px 10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }}
        >
          <option value="">All Sizes</option>
          {sizes.map(s => <option key={s} value={s}>{s} employees</option>)}
        </select>

        <select
          value={sort}
          onChange={e => { setSort(e.target.value as BayAreaListParams['sort']); setPage(1) }}
          style={{ padding: '7px 10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }}
        >
          <option value="name_asc">Name A→Z</option>
          <option value="founded_desc">Founded (newest first)</option>
          <option value="founded_asc">Founded (oldest first)</option>
        </select>

        {hasFilters && (
          <button
            onClick={resetFilters}
            style={{ padding: '7px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px', background: '#fff', cursor: 'pointer' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px', background: '#fff3f3', border: '1px solid #f00', borderRadius: '4px', color: '#c00', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Empty state before seeding */}
      {!loading && companies.length === 0 && total === 0 && !hasFilters && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
          <p style={{ fontSize: '16px', marginBottom: '8px' }}>No Bay Area companies loaded yet.</p>
          <p style={{ fontSize: '13px' }}>Click <strong>Seed from CSV</strong> to load the data.</p>
        </div>
      )}

      {/* No results with filters */}
      {!loading && companies.length === 0 && (hasFilters || total === 0) && total === 0 && hasFilters && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          No companies match your filters.
        </div>
      )}

      {/* Table */}
      {companies.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                <th style={th}>Company</th>
                <th style={th}>Area</th>
                <th style={th}>City</th>
                <th style={th}>State</th>
                <th style={th}>Address</th>
                <th style={th}>Tags</th>
                <th style={th}>Size</th>
                <th style={th}>Founded</th>
                <th style={th}>Investors</th>
                <th style={th}>Website</th>
                <th style={th}>Tech Stack</th>
                <th style={th}>Marketing Stack</th>
                <th style={th}>Description</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #eee', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{c.name}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: '#555' }}>{c.location || '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: '#555' }}>{c.hq_city || '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: '#555' }}>{c.hq_state || '—'}</td>
                  <td style={{ ...td, color: '#555', maxWidth: '180px' }}>{c.address || '—'}</td>
                  <td style={td}>
                    {c.tags ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {c.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                          <span
                            key={t}
                            onClick={() => { setSelectedTag(t); setPage(1) }}
                            style={{ display: 'inline-block', padding: '2px 7px', background: '#e8f0fe', color: '#1a56db', borderRadius: '10px', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : '—'}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: '#555' }}>{c.company_size ? `${c.company_size}` : '—'}</td>
                  <td style={{ ...td, textAlign: 'center', color: '#555' }}>{c.founded_year ?? '—'}</td>
                  <td style={{ ...td, color: '#555', maxWidth: '160px' }}>{c.investors || '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    {c.website ? (
                      <a
                        href={c.website.startsWith('http') ? c.website : `https://${c.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#0070f3', textDecoration: 'none' }}
                      >
                        {c.domain || c.website}
                      </a>
                    ) : '—'}
                  </td>
                  <td style={{ ...td, color: '#555', whiteSpace: 'nowrap' }}>{c.tech_stack || '—'}</td>
                  <td style={{ ...td, color: '#555', whiteSpace: 'nowrap' }}>{c.marketing_stack || '—'}</td>
                  <td style={{ ...td, color: '#555', maxWidth: '320px' }}>
                    <span title={c.description ?? undefined} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {c.description || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', justifyContent: 'center' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ padding: '6px 14px', border: '1px solid #ccc', borderRadius: '4px', cursor: page <= 1 ? 'not-allowed' : 'pointer', background: '#fff' }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: '13px', color: '#555' }}>
            Page {page} of {totalPages} &nbsp;·&nbsp; {total.toLocaleString()} companies
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ padding: '6px 14px', border: '1px solid #ccc', borderRadius: '4px', cursor: page >= totalPages ? 'not-allowed' : 'pointer', background: '#fff' }}
          >
            Next →
          </button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Loading…</div>
      )}
    </div>
  )
}

const th: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 600,
  color: '#444',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '9px 12px',
  verticalAlign: 'top',
}
