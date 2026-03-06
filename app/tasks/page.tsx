"use client"
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import supabase from '../../src/lib/supabaseClient'
import TaskCard from '../../components/TaskCard'
import { subscribeTaskMutations } from '../../src/lib/uiEvents'

const AREAS = [
  '', 'Compliance', 'Enforcement', 'Licensing', 'Litigation and Prosecution', 'Investigations', 'Data Protection', 'Legal Advisory', 'Regulatory Affairs', 'Board Affairs'
]

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [query, setQuery] = useState('')
  const [area, setArea] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setErrorMessage('')
      let result: any = await supabase
        .from('tasks')
        .select('id,title,description,reporting_area,created_at,users(name)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50)

      if (result.error) {
        result = await supabase
          .from('tasks')
          .select('id,title,description,reporting_area,created_at')
          .order('created_at', { ascending: false })
          .limit(50)
      }

      if (!mounted) return
      if (result.error) {
        setErrorMessage(result.error.message || 'Failed to load tasks.')
        setTasks([])
        setLoading(false)
        return
      }
      const mapped = (result.data || []).map((r: any) => ({ ...r, author_name: r.users?.name || 'Unknown' }))
      setTasks(mapped)
      setLoading(false)
    })()

    return () => { mounted = false }
  }, [])

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
  }, [query, area])

  const filteredTasks = tasks.filter((task) => {
    const q = query.trim().toLowerCase()
    const matchesQuery = !q || task.title?.toLowerCase().includes(q) || task.description?.toLowerCase().includes(q) || task.author_name?.toLowerCase().includes(q)
    const matchesArea = !area || task.reporting_area === area
    return matchesQuery && matchesArea
  })

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const paginatedTasks = filteredTasks.slice(startIndex, startIndex + pageSize)

  return (
    <section>
      <h1 className="text-2xl font-semibold mb-4">Task Feed</h1>
      <div className="ucc-card p-3 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <label className="block text-sm">Search
          <input value={query} onChange={(e)=>setQuery(e.target.value)} className="ucc-input" placeholder="Title, description, author" />
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
            <p className="ucc-muted">No tasks have been logged yet.</p>
            <Link href="/tasks/new" className="ucc-link">Log the first task</Link>
          </div>
        )}
        {!loading && tasks.length > 0 && filteredTasks.length === 0 && <p className="text-sm ucc-muted">No tasks match your filters.</p>}
        {paginatedTasks.map((t:any)=> <TaskCard key={t.id} task={t} />)}
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
