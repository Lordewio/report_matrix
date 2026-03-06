"use client"
import React, { useState } from 'react'
import supabase from '../src/lib/supabaseClient'
import { emitToast } from '../src/lib/uiEvents'

const AREAS = [
  '','Compliance','Enforcement','Licensing','Litigation and Prosecution','Investigations','Data Protection','Legal Advisory','Regulatory Affairs','Board Affairs'
]

export default function ReportForm() {
  const [scope, setScope] = useState<'all' | 'mine' | 'department' | 'user'>('all')
  const [area, setArea] = useState('')
  const [userId, setUserId] = useState('')
  const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string }>>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [frequency, setFrequency] = useState('weekly')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{pdfUrl?:string,docxUrl?:string,docxError?:string}|null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  React.useEffect(() => {
    setErrorMessage('')
    setResult(null)
    if (scope !== 'department') setArea('')
    if (scope !== 'user') setUserId('')
  }, [scope])

  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      setUsersLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        if (mounted) {
          setUsers([])
          setUsersLoading(false)
        }
        return
      }

      const response = await fetch('/api/users/active', {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const payload = await response.json().catch(() => ({}))

      if (!mounted) return
      if (response.ok) {
        setUsers((payload.users || []) as Array<{ id: string; name: string | null; email: string }>)
      }
      setUsersLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (scope === 'department' && !area) {
      setErrorMessage('Please select a department.')
      return
    }
    if (scope === 'user' && !userId) {
      setErrorMessage('Please select a user.')
      return
    }

    setLoading(true)
    setResult(null)
    setErrorMessage('')
    setSuccessMessage('')
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) {
      setLoading(false)
      setErrorMessage('Please sign in to generate reports.')
      emitToast({ type: 'error', message: 'Please sign in to generate reports.' })
      return
    }

    const res = await fetch('/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        scope,
        area: scope === 'department' ? area : '',
        userId: scope === 'user' ? userId : '',
        frequency
      })
    })
    const raw = await res.text()
    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = { error: raw || 'Failed' }
    }
    setLoading(false)
    if (res.ok) {
      setResult(data)
      setSuccessMessage('Report generated successfully.')
      emitToast({ type: 'success', message: 'Report generated successfully.' })
      return
    }
    setErrorMessage(data.error || 'Failed to generate report.')
    emitToast({ type: 'error', message: data.error || 'Failed to generate report.' })
  }

  return (
    <form onSubmit={handleSubmit} className="ucc-card p-4">
      {errorMessage && <p className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{errorMessage}</p>}
      {successMessage && <p className="mb-3 rounded border border-green-200 bg-green-50 p-2 text-sm text-green-700">{successMessage}</p>}
      <p className="mb-3 text-xs ucc-muted">Daily, weekly, and bi-weekly reports are generated for the current period to date. Choose one scope below.</p>
      <div className="grid grid-cols-2 gap-4">
        <label>Report Scope
          <select value={scope} onChange={(e)=>setScope(e.target.value as 'all' | 'mine' | 'department' | 'user')} className="ucc-input">
            <option value="all">General report (everything)</option>
            <option value="mine">My tasks</option>
            <option value="department">Department</option>
            <option value="user">Particular user</option>
          </select>
        </label>
        {scope === 'department' && (
          <label>Department
            <select value={area} onChange={(e)=>setArea(e.target.value)} className="ucc-input">
              {AREAS.map(a=> <option key={a} value={a}>{a||'Select department'}</option>)}
            </select>
          </label>
        )}
        {scope === 'user' && (
          <label>User
            <select value={userId} onChange={(e)=>setUserId(e.target.value)} className="ucc-input" disabled={usersLoading}>
              <option value="">{usersLoading ? 'Loading users...' : 'Select user'}</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email} ({u.email})</option>)}
            </select>
          </label>
        )}
        <div className="col-span-2">
          <label className="mr-2"><input type="radio" name="freq" value="daily" checked={frequency==='daily'} onChange={()=>setFrequency('daily')} /> Daily</label>
          <label className="mr-2"><input type="radio" name="freq" value="weekly" checked={frequency==='weekly'} onChange={()=>setFrequency('weekly')} /> Weekly</label>
          <label className="ml-4"><input type="radio" name="freq" value="biweekly" checked={frequency==='biweekly'} onChange={()=>setFrequency('biweekly')} /> Bi-weekly</label>
        </div>
      </div>
      <div className="mt-4 text-right">
        <button disabled={loading} className="ucc-btn">{loading? 'Generating...' : 'Generate'}</button>
      </div>
      {result && (
        <div className="mt-4">
          {(result as any).period?.label && (
            <p className="text-xs ucc-muted mb-2">Period used: {(result as any).period.label} • Tasks found: {typeof (result as any).totalTasks === 'number' ? (result as any).totalTasks : '—'}</p>
          )}
          {result.pdfUrl && <div><a className="ucc-link" href={result.pdfUrl} target="_blank">Download PDF</a></div>}
          {result.docxUrl && <div><a className="ucc-link" href={result.docxUrl} target="_blank">Download Word</a></div>}
          {result.docxError && <p className="mt-2 text-xs ucc-muted">DOCX export is currently unavailable. PDF is ready to use.</p>}
        </div>
      )}
    </form>
  )
}
