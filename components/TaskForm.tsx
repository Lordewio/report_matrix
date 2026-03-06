"use client"
import React, { useState } from 'react'
import Link from 'next/link'
import supabase from '../src/lib/supabaseClient'
import { emitTaskMutation, emitToast } from '../src/lib/uiEvents'

const AREAS = [
  'Compliance','Enforcement','Licensing','Litigation and Prosecution','Investigations','Data Protection','Legal Advisory','Regulatory Affairs','Board Affairs'
]

export default function TaskForm({ onDone }: { onDone?: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [area, setArea] = useState(AREAS[0])
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [createdTaskId, setCreatedTaskId] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrorMessage('')
    setSuccessMessage('')
    setCreatedTaskId('')

    const tempId = `temp-${Date.now()}`
    emitTaskMutation({
      action: 'add',
      task: {
        id: tempId,
        title,
        description,
        reporting_area: area,
        created_at: new Date().toISOString(),
        author_name: 'You',
        author_id: 'pending',
        optimistic: true
      }
    })

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      setErrorMessage('Please sign in to log a task.')
      emitTaskMutation({ action: 'remove', taskId: tempId })
      emitToast({ type: 'error', message: 'Please sign in to log a task.' })
      setSaving(false)
      return
    }

    const user = authData.user
    const { error: profileError } = await supabase.from('users').upsert(
      {
        id: user.id,
        email: user.email || `${user.id}@example.local`,
        name: (user.user_metadata?.name as string | undefined) || (user.user_metadata?.full_name as string | undefined) || user.email || 'User'
      },
      { onConflict: 'id' }
    )
    if (profileError) {
      setErrorMessage(profileError.message)
      emitTaskMutation({ action: 'remove', taskId: tempId })
      emitToast({ type: 'error', message: 'Failed to prepare your profile.' })
      setSaving(false)
      return
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert([{ title, description, reporting_area: area, author_id: user.id }])
      .select('id')
      .single()
    if (error) {
      setErrorMessage(error.message)
      emitTaskMutation({ action: 'remove', taskId: tempId })
      emitToast({ type: 'error', message: 'Failed to save task.' })
      setSaving(false)
      return
    }
    const task = data
    emitTaskMutation({
      action: 'replace',
      tempId,
      task: {
        id: task.id,
        title,
        description,
        reporting_area: area,
        created_at: new Date().toISOString(),
        author_name: 'You',
        author_id: user.id
      }
    })
    if (file && task) {
      const bucket = process.env.NEXT_PUBLIC_SUPABASE_URL ? 'attachments' : 'attachments'
      const path = `${task.id}/${file.name}`
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file)
      if (uploadError) {
        setErrorMessage(uploadError.message)
        emitToast({ type: 'error', message: 'Task saved, but attachment upload failed.' })
        setSaving(false)
        return
      }
      const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
      const { error: attachmentError } = await supabase.from('attachments').insert([{ task_id: task.id, file_url: url }])
      if (attachmentError) {
        setErrorMessage(attachmentError.message)
        emitToast({ type: 'error', message: 'Task saved, but attachment record failed.' })
        setSaving(false)
        return
      }
    }
    setCreatedTaskId(task.id)
    setSuccessMessage('Task logged successfully.')
    setTitle('')
    setDescription('')
    setFile(null)
    setSaving(false)
    emitToast({ type: 'success', message: 'Task logged successfully.' })
    onDone?.()
  }

  return (
    <form onSubmit={handleSubmit} className="ucc-card p-4">
      {errorMessage && <p className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{errorMessage}</p>}
      {successMessage && (
        <div className="mb-3 rounded border border-green-200 bg-green-50 p-2 text-sm text-green-700">
          <p>{successMessage}</p>
          <div className="mt-1 flex gap-3">
            <Link href="/tasks" className="ucc-link">View Task Feed</Link>
            {createdTaskId && <Link href="/my-tasks" className="ucc-link">View My Tasks</Link>}
          </div>
        </div>
      )}
      <label className="block mb-2">Title
        <input value={title} onChange={(e)=>setTitle(e.target.value)} required className="ucc-input" />
      </label>
      <label className="block mb-2">Description
        <textarea value={description} onChange={(e)=>setDescription(e.target.value)} className="ucc-input" />
      </label>
      <label className="block mb-2">Reporting Area
        <select value={area} onChange={(e)=>setArea(e.target.value)} className="ucc-input">
          {AREAS.map(a=> <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      <label className="block mb-2">Attachment
        <input type="file" onChange={(e)=>setFile(e.target.files?.[0]||null)} className="ucc-input" />
      </label>
      <div className="text-right">
        <button disabled={saving} className="ucc-btn">{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </form>
  )
}
