"use client"
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import supabase from '../../../src/lib/supabaseClient'
import { emitToast } from '../../../src/lib/uiEvents'

type ArchivedTask = {
  id: string
  title: string
  description: string | null
  reporting_area: string
  created_at: string
  deleted_at: string | null
  deleted_by: string | null
  users?: { name?: string | null; email?: string | null } | null
}

export default function AdminArchivedTasksPage() {
  const [tasks, setTasks] = useState<ArchivedTask[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [count, setCount] = useState(0)
  const [restoringId, setRestoringId] = useState('')
  const [restoreReason, setRestoreReason] = useState<Record<string, string>>({})

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / pageSize)), [count, pageSize])

  async function getAccessToken() {
    const { data: sessionData } = await supabase.auth.getSession()
    return sessionData.session?.access_token || ''
  }

  async function loadArchivedTasks() {
    setLoading(true)
    setErrorMessage('')

    const accessToken = await getAccessToken()
    if (!accessToken) {
      setLoading(false)
      setErrorMessage('Please sign in.')
      emitToast({ type: 'error', message: 'Please sign in to access archived tasks.' })
      return
    }

    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize)
    })

    const response = await fetch(`/api/admin/archived-tasks?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setLoading(false)
      setErrorMessage(payload.error || 'Failed to load archived tasks.')
      return
    }

    setTasks(payload.tasks || [])
    setCount(payload.count || 0)
    setLoading(false)
  }

  async function restoreTask(taskId: string) {
    setRestoringId(taskId)
    const accessToken = await getAccessToken()
    if (!accessToken) {
      setRestoringId('')
      emitToast({ type: 'error', message: 'Session expired. Please sign in again.' })
      return
    }

    const response = await fetch('/api/admin/archived-tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ taskId, reason: restoreReason[taskId] || '' })
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setRestoringId('')
      emitToast({ type: 'error', message: payload.error || 'Failed to restore task.' })
      return
    }

    setTasks((prev) => prev.filter((task) => task.id !== taskId))
    setCount((prev) => Math.max(0, prev - 1))
    setRestoreReason((prev) => {
      const next = { ...prev }
      delete next[taskId]
      return next
    })
    setRestoringId('')
    emitToast({ type: 'success', message: 'Task restored successfully.' })
  }

  useEffect(() => {
    loadArchivedTasks()
  }, [page])

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Archived Tasks</h1>
        <Link href="/admin" className="ucc-link">Back to Admin</Link>
      </div>

      {loading && <p className="text-sm ucc-muted">Loading archived tasks...</p>}
      {!loading && errorMessage && <div className="ucc-card p-4 text-sm text-red-700">{errorMessage}</div>}

      {!loading && !errorMessage && (
        <div className="ucc-card p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Area</th>
                <th className="py-2 pr-3">Author</th>
                <th className="py-2 pr-3">Deleted At</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b align-top">
                  <td className="py-2 pr-3">{task.title}</td>
                  <td className="py-2 pr-3">{task.reporting_area}</td>
                  <td className="py-2 pr-3">{task.users?.name || task.users?.email || 'Unknown'}</td>
                  <td className="py-2 pr-3">{task.deleted_at ? new Date(task.deleted_at).toLocaleString() : '—'}</td>
                  <td className="py-2">
                    <div className="flex flex-col gap-2">
                      <input
                        value={restoreReason[task.id] || ''}
                        onChange={(e) => setRestoreReason((prev) => ({ ...prev, [task.id]: e.target.value }))}
                        placeholder="Restore reason (optional)"
                        className="ucc-input max-w-xs"
                      />
                      <button
                        type="button"
                        className="ucc-btn-sm disabled:opacity-50"
                        disabled={restoringId === task.id}
                        onClick={() => restoreTask(task.id)}
                      >
                        {restoringId === task.id ? 'Restoring...' : 'Restore'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-sm ucc-muted">No archived tasks found.</td>
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
