"use client"
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import supabase from '../../../src/lib/supabaseClient'
import { emitToast } from '../../../src/lib/uiEvents'

type AuditLog = {
  id: string
  actor_id: string | null
  action: string
  entity: string
  entity_id: string | null
  metadata: Record<string, any>
  created_at: string
}

const ACTIONS = [
  '',
  'TASK_CREATED',
  'TASK_UPDATED',
  'TASK_ARCHIVED',
  'TASK_RESTORED',
  'TASK_DELETED',
  'ATTACHMENT_ADDED',
  'ATTACHMENT_REMOVED',
  'USER_ROLE_CHANGED'
]

const ENTITIES = ['', 'tasks', 'attachments', 'users']

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [count, setCount] = useState(0)
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / pageSize)), [count, pageSize])

  async function getAccessToken() {
    const { data: sessionData } = await supabase.auth.getSession()
    return sessionData.session?.access_token || ''
  }

  async function loadLogs() {
    setLoading(true)
    setErrorMessage('')

    const accessToken = await getAccessToken()
    if (!accessToken) {
      setLoading(false)
      setErrorMessage('Please sign in.')
      emitToast({ type: 'error', message: 'Please sign in to access audit logs.' })
      return
    }

    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize)
    })
    if (actionFilter) params.set('action', actionFilter)
    if (entityFilter) params.set('entity', entityFilter)

    const response = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setLoading(false)
      setErrorMessage(payload.error || 'Failed to load audit logs.')
      return
    }

    setLogs(payload.logs || [])
    setCount(payload.count || 0)
    setLoading(false)
  }

  useEffect(() => {
    loadLogs()
  }, [page, actionFilter, entityFilter])

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <Link href="/admin" className="ucc-link">Back to Admin</Link>
      </div>

      <div className="ucc-card p-3 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <label className="block text-sm">Action
          <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1) }} className="ucc-input">
            {ACTIONS.map((value) => <option key={value || 'all'} value={value}>{value || 'All actions'}</option>)}
          </select>
        </label>
        <label className="block text-sm">Entity
          <select value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setPage(1) }} className="ucc-input">
            {ENTITIES.map((value) => <option key={value || 'all'} value={value}>{value || 'All entities'}</option>)}
          </select>
        </label>
        <div className="text-right">
          <button className="ucc-btn-sm" onClick={() => { setActionFilter(''); setEntityFilter(''); setPage(1) }}>Clear filters</button>
        </div>
      </div>

      {loading && <p className="text-sm ucc-muted">Loading audit logs...</p>}
      {!loading && errorMessage && <div className="ucc-card p-4 text-sm text-red-700">{errorMessage}</div>}

      {!loading && !errorMessage && (
        <div className="ucc-card p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Entity</th>
                <th className="py-2 pr-3">Entity ID</th>
                <th className="py-2 pr-3">Actor</th>
                <th className="py-2">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{log.action}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{log.entity}</td>
                  <td className="py-2 pr-3"><span className="text-xs ucc-muted">{log.entity_id || '—'}</span></td>
                  <td className="py-2 pr-3"><span className="text-xs ucc-muted">{log.actor_id || '—'}</span></td>
                  <td className="py-2"><pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(log.metadata || {}, null, 2)}</pre></td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-sm ucc-muted">No audit records match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="ucc-muted">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button type="button" className="ucc-btn-sm disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
              <button type="button" className="ucc-btn-sm disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
