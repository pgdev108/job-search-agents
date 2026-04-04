'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getTags, createTag, deleteTag } from '../lib/api'

export default function TagsPage() {
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [newTagInput, setNewTagInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingTag, setDeletingTag] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTags()
      .then(setTags)
      .catch(() => setError('Failed to load tags'))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    const name = newTagInput.trim().toLowerCase()
    if (!name) return
    if (tags.includes(name)) {
      setError(`Tag "${name}" already exists`)
      return
    }
    setCreating(true)
    setError(null)
    try {
      const updated = await createTag(name)
      setTags(updated)
      setNewTagInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (tag: string) => {
    if (!confirm(`Delete tag "${tag}"?\n\nThis will also remove it from all companies that have this tag.`)) return
    setDeletingTag(tag)
    setError(null)
    try {
      await deleteTag(tag)
      setTags(prev => prev.filter(t => t !== tag))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tag')
    } finally {
      setDeletingTag(null)
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Tags</h1>
        <Link href="/" style={{ color: '#0066cc', fontWeight: 600, textDecoration: 'none' }}>
          ← Back to Companies
        </Link>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', color: '#991b1b', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {/* Add new tag */}
      <div style={{ marginBottom: '2rem', padding: '1.25rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.6rem' }}>Add New Tag</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={newTagInput}
            onChange={e => setNewTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            placeholder="e.g. fintech"
            disabled={creating}
            style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.95rem' }}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newTagInput.trim()}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: creating || !newTagInput.trim() ? '#ccc' : '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: creating || !newTagInput.trim() ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.95rem',
            }}
          >
            {creating ? 'Adding...' : 'Add Tag'}
          </button>
        </div>
      </div>

      {/* Tags list */}
      {loading ? (
        <div style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>Loading tags...</div>
      ) : tags.length === 0 ? (
        <div style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>No tags yet. Add one above.</div>
      ) : (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
          {tags.map((tag, i) => (
            <div
              key={tag}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                borderBottom: i < tags.length - 1 ? '1px solid #e2e8f0' : 'none',
                backgroundColor: 'white',
              }}
            >
              <span style={{ fontWeight: 500, fontSize: '0.95rem' }}>{tag}</span>
              <button
                onClick={() => handleDelete(tag)}
                disabled={deletingTag === tag}
                style={{
                  padding: '0.3rem 0.75rem',
                  backgroundColor: deletingTag === tag ? '#ccc' : '#fef2f2',
                  color: deletingTag === tag ? '#999' : '#dc2626',
                  border: '1px solid',
                  borderColor: deletingTag === tag ? '#ccc' : '#fca5a5',
                  borderRadius: '4px',
                  cursor: deletingTag === tag ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                {deletingTag === tag ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '1rem', color: '#888', fontSize: '0.85rem' }}>
        {tags.length} tag{tags.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
