'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { getCompanies } from '../../lib/api'

export default function CompanyDetailPage() {
  const router = useRouter()
  const { ticker } = router.query

  useEffect(() => {
    if (typeof ticker !== 'string') return
    getCompanies({ search: ticker, page: 1, page_size: 5 })
      .then(data => {
        const match = data.items.find(c => c.ticker?.toLowerCase() === ticker.toLowerCase())
        if (match) {
          router.replace(`/company/id/${match.id}`)
        } else {
          router.replace('/')
        }
      })
      .catch(() => router.replace('/'))
  }, [ticker, router])

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      Redirecting...
    </div>
  )
}
