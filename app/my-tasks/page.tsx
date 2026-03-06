"use client"
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import supabase from '../../src/lib/supabaseClient'
import TaskCard from '../../components/TaskCard'
import { emitTaskMutation, emitToast, subscribeTaskMutations } from '../../src/lib/uiEvents'

const AREAS = [
  '', 'Compliance', 'Enforcement', 'Licensing', 'Litigation and Prosecution', 'Investigations', 'Data Protection', 'Legal Advisory', 'Regulatory Affairs', 'Board Affairs'
]

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [query, setQuery] = useState('')
  const [area, setArea] = useState('')
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active')
  const [page, setPage] = useState(1)
  const [currentUserId, setCurrentUserId] = useState('')
  const [editingTaskId, setEditingTaskId] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editArea, setEditArea] = useState('')
  const [saving, setSaving] = useState(false)
  const pageSize = 10

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setErrorMessage('')
      const { data: authData } = await supabase.auth.getUser()
      const user = authData.user
      if (!user) {
        if (mounted) {
          setTasks([])
          setLoading(false)
        }
        return
      }
      setCurrentUserId(user.id)

      let result: any = await supabase
        .from('tasks')
        .select('id,title,description,reporting_area,created_at,deleted_at,users(name)')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (result.error) {
        result = await supabase
          .from('tasks')
          .select('id,title,description,reporting_area,created_at,deleted_at')
          .eq('author_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100)
      }

      if (!mounted) return
      if (result.error) {
        setErrorMessage(result.error.message || 'Failed to load your tasks.')
        setTasks([])
        setLoading(false)
        return
      }

      const mapped = (result.data || []).map((r: any) => ({
        ...r,
        deleted_at: (r as any).deleted_at || null,
        author_name: r.users?.name || 'Unknown'
      }))
      setTasks(mapped)
      setLoading(false)
    })()

    return () => { mounted = false }
  }, [])

  function startEdit(task: any) {
    setEditingTaskId(task.id)
    setEditTitle(task.title || '')
    setEditDescription(task.description || '')
    setEditArea(task.reporting_area || AREAS[1])
  }

  function cancelEdit() {
    setEditingTaskId('')
    setEditTitle('')
    setEditDescription('')
    setEditArea('')
  }

  async function saveEdit(taskId: string) {
    if (!currentUserId) return
    setSaving(true)
    const updates = {
      title: editTitle,
      description: editDescription,
      reporting_area: editArea,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .eq('author_id', currentUserId)

    if (error) {
      emitToast({ type: 'error', message: error.message || 'Failed to update task.' })
      setSaving(false)
      return
    }

    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task)))
    emitTaskMutation({
      action: 'replace',
      tempId: taskId,
      task: {
        ...(tasks.find((item) => item.id === taskId) || {}),
        ...updates,
        id: taskId
      }
    })
    cancelEdit()
    setSaving(false)
    emitToast({ type: 'success', message: 'Task updated successfully.' })
  }

  async function deleteTask(taskId: string) {
    if (!currentUserId) return
    const confirmed = window.confirm('Archive this task? You can keep the audit trail while removing it from active lists.')
    if (!confirmed) return

    const { error } = await supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString(), deleted_by: currentUserId })
      .eq('id', taskId)
      .eq('author_id', currentUserId)
      .is('deleted_at', null)

    if (error) {
      emitToast({ type: 'error', message: error.message || 'Failed to archive task.' })
      return
    }

    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, deleted_at: new Date().toISOString() } : task)))
    emitTaskMutation({ action: 'remove', taskId })
    emitToast({ type: 'success', message: 'Task archived successfully.' })
  }

  async function restoreTask(taskId: string) {
    if (!currentUserId) return

    const { error } = await supabase
      .from('tasks')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', taskId)
      .eq('author_id', currentUserId)

    if (error) {
      emitToast({ type: 'error', message: error.message || 'Failed to restore task.' })
      return
    }

    const restored = tasks.find((task) => task.id === taskId)
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, deleted_at: null } : task)))
    if (restored) {
      emitTaskMutation({ action: 'add', task: { ...restored, deleted_at: null } })
    }
    emitToast({ type: 'success', message: 'Task restored successfully.' })
  }

  useEffect(() => {
    return subscribeTaskMutations((mutation) => {
      setTasks((prev) => {
        if (mutation.action === 'add') return [mutation.task, ...prev]
        if (mutation.action === 'replace') return prev.map((t) => (t.id === mutation.tempId ? mutation.task : t))
        return prev.filter((t) => t.id !== mutation.taskId)
      })
    })
  }, [])

  useEffect(() => {
    setPage(1)
  }, [query, area, viewMode])

  const filteredTasks = tasks.filter((task) => {
    const matchesMode = viewMode === 'active' ? !task.deleted_at : !!task.deleted_at
    const q = query.trim().toLowerCase()
    const matchesQuery = !q || task.title?.toLowerCase().includes(q) || task.description?.toLowerCase().includes(q)
    const matchesArea = !area || task.reporting_area === area
    return matchesMode && matchesQuery && matchesArea
  })

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const paginatedTasks = filteredTasks.slice(startIndex, startIndex + pageSize)

  return (
    <section>
      <h1 className="text-2xl font-semibold mb-4">My Tasks</h1>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setViewMode('active')}
          className={`ucc-btn-sm ${viewMode === 'active' ? '' : 'opacity-70'}`}
        >
          Active
        </button>
        <button
          type="button"
          onClick={() => setViewMode('archived')}
          className={`ucc-btn-sm ${viewMode === 'archived' ? '' : 'opacity-70'}`}
        >
          Archived
        </button>
      </div>
      <div className="ucc-card p-3 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <label className="block text-sm">Search
          <input value={query} onChange={(e)=>setQuery(e.target.value)} className="ucc-input" placeholder="Title or description" />
        </label>
        <label className="block text-sm">Reporting Area
          <select value={area} onChange={(e)=>setArea(e.target.value)} className="ucc-input">
            {AREAS.map((item) => <option key={item || 'all'} value={item}>{item || 'All areas'}</option>)}
          </select>
        </label>
        <div className="text-right">
          <button type="button" onClick={() => { setQuery(''); setArea('') }} className="ucc-btn-sm">Clear filters</button>
        </div>
      </div>
      <div>
        {loading && <p className="text-sm ucc-muted">Loading tasks...</p>}
        {!loading && errorMessage && <p className="text-sm text-red-700">{errorMessage}</p>}
        {!loading && tasks.length === 0 && (
          <div className="ucc-card p-4 text-sm">
            <p className="ucc-muted">You have not logged any tasks yet.</p>
            <Link href="/tasks/new" className="ucc-link">Log a task now</Link>
          </div>
        )}
        {!loading && tasks.length > 0 && filteredTasks.length === 0 && (
          <p className="text-sm ucc-muted">
            {viewMode === 'active' ? 'No active tasks match your filters.' : 'No archived tasks match your filters.'}
          </p>
        )}
        {paginatedTasks.map((t:any)=> (
          viewMode === 'active' && editingTaskId === t.id ? (
            <article key={t.id} className="ucc-card p-4 mb-3">
              <label className="block mb-2 text-sm">Title
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="ucc-input" required />
              </label>
              <label className="block mb-2 text-sm">Description
                <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="ucc-input" />
              </label>
              <label className="block mb-2 text-sm">Reporting Area
                <select value={editArea} onChange={(e) => setEditArea(e.target.value)} className="ucc-input">
                  {AREAS.slice(1).map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={saving || !editTitle.trim()} onClick={() => saveEdit(t.id)} className="ucc-btn-sm disabled:opacity-50">{saving ? 'Saving...' : 'Save changes'}</button>
                <button type="button" disabled={saving} onClick={cancelEdit} className="ucc-btn-sm disabled:opacity-50">Cancel</button>
              </div>
            </article>
          ) : (
            <TaskCard
              key={t.id}
              task={t}
              actions={(
                <>
                  {viewMode === 'active' ? (
                    <>
                      <button type="button" onClick={() => startEdit(t)} className="ucc-btn-sm">Edit</button>
                      <button type="button" onClick={() => deleteTask(t.id)} className="ucc-btn-sm">Archive</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => restoreTask(t.id)} className="ucc-btn-sm">Restore</button>
                  )}
                </>
              )}
            />
          )
        ))}
        {!loading && filteredTasks.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="ucc-muted">Page {safePage} of {totalPages}</span>
            <div className="flex gap-2">
              <button type="button" className="ucc-btn-sm disabled:opacity-50" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
              <button type="button" className="ucc-btn-sm disabled:opacity-50" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
