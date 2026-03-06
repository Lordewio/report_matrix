"use client"
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import supabase from '../src/lib/supabaseClient'
import { subscribeTaskMutations } from '../src/lib/uiEvents'

function startOfWeekUtc(date: Date) {
  const copy = new Date(date)
  const day = copy.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  copy.setUTCDate(copy.getUTCDate() + diffToMonday)
  copy.setUTCHours(0, 0, 0, 0)
  return copy
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')

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
        .select('id,title,reporting_area,created_at,users(name)')
        .eq('author_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50)

      if (result.error) {
        result = await supabase
          .from('tasks')
          .select('id,title,reporting_area,created_at')
          .eq('author_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)
      }

      if (!mounted) return

      if (result.error) {
        setErrorMessage(result.error.message || 'Failed to load dashboard data.')
        setTasks([])
        setLoading(false)
        return
      }

      setTasks(result.data || [])
      setLastUpdatedAt(new Date())
      setLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    return subscribeTaskMutations((mutation) => {
      setTasks((prev) => {
        if (mutation.action === 'add') {
          if ((mutation.task as any)?.author_id && (mutation.task as any).author_id !== currentUserId) return prev
          return [mutation.task, ...prev]
        }

        if (mutation.action === 'replace') {
          if ((mutation.task as any)?.author_id && (mutation.task as any).author_id !== currentUserId) {
            return prev.filter((task) => task.id !== mutation.tempId)
          }
          return prev.map((task) => (task.id === mutation.tempId ? mutation.task : task))
        }

        return prev.filter((task) => task.id !== mutation.taskId)
      })
      setLastUpdatedAt(new Date())
    })
  }, [currentUserId])

  const weekStartIso = useMemo(() => startOfWeekUtc(new Date()).toISOString(), [])

  const totalTasks = tasks.length
  const thisWeekTasks = tasks.filter((task) => task.created_at && task.created_at >= weekStartIso).length
  const recentTasks = tasks.slice(0, 5)

  return (
    <section>
      <h1 className="text-2xl font-semibold mb-4">Dashboard</h1>
      {!loading && !errorMessage && lastUpdatedAt && (
        <p className="text-xs ucc-muted mb-4">Last updated {lastUpdatedAt.toLocaleTimeString()}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="ucc-card p-4">
          <p className="text-sm ucc-muted mb-1">Total Tasks</p>
          <p className="text-2xl font-semibold">{loading ? '—' : totalTasks}</p>
        </div>
        <div className="ucc-card p-4">
          <p className="text-sm ucc-muted mb-1">This Week</p>
          <p className="text-2xl font-semibold">{loading ? '—' : thisWeekTasks}</p>
        </div>
      </div>

      <div className="ucc-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent Tasks</h2>
          <Link href="/my-tasks" className="ucc-link text-sm">View my tasks</Link>
        </div>

        {loading && <p className="text-sm ucc-muted">Loading dashboard...</p>}
        {!loading && errorMessage && <p className="text-sm text-red-700">{errorMessage}</p>}
        {!loading && !errorMessage && recentTasks.length === 0 && <p className="text-sm ucc-muted">No tasks yet.</p>}

        {!loading && !errorMessage && recentTasks.length > 0 && (
          <ul className="divide-y">
            {recentTasks.map((task: any) => (
              <li key={task.id} className="py-2">
                <p className="font-medium">{task.title}</p>
                <p className="text-sm ucc-muted">
                  {task.reporting_area || 'Unspecified area'} • {new Date(task.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
