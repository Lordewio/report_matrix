"use client"
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import supabase from '../../../src/lib/supabaseClient'
import { emitToast } from '../../../src/lib/uiEvents'

type TaskDetail = {
  id: string
  title: string
  description: string | null
  reporting_area: string
  created_at: string
  author_id: string
  users?: { name?: string | null; email?: string | null } | null
  attachments?: Array<{ id: string; file_url: string; uploaded_at: string }>
}

export default function TaskDetailPage({ params }: { params: { id: string } }) {
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [authorFallback, setAuthorFallback] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingAttachmentId, setDeletingAttachmentId] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: authData } = await supabase.auth.getUser()
      if (mounted) setCurrentUserId(authData.user?.id || '')

      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      let result: any = await supabase
        .from('tasks')
        .select('id,title,description,reporting_area,created_at,author_id,users(name,email),attachments(id,file_url,uploaded_at)')
        .eq('id', params.id)
        .is('deleted_at', null)
        .single()

      if (result.error) {
        result = await supabase
          .from('tasks')
          .select('id,title,description,reporting_area,created_at,author_id,attachments(id,file_url,uploaded_at)')
          .eq('id', params.id)
          .single()
      }

      if (!mounted) return
      if (result.error || !result.data) {
        setErrorMessage(result.error?.message || 'Task not found.')
        setLoading(false)
        return
      }

      if (accessToken && result.data.author_id) {
        const usersRes = await fetch('/api/users/active', {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        const usersPayload = await usersRes.json().catch(() => ({}))
        if (usersRes.ok) {
          const matched = (usersPayload.users || []).find((item: any) => item.id === result.data.author_id)
          if (mounted && matched) {
            setAuthorFallback(matched.name || matched.email || '')
          }
        }
      }

      setTask(result.data as TaskDetail)
      setLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [params.id])

  async function handleAddAttachment() {
    if (!task || !attachmentFile) return
    setUploading(true)

    const path = `${task.id}/${Date.now()}-${attachmentFile.name}`
    const { error: uploadError } = await supabase.storage.from('attachments').upload(path, attachmentFile)
    if (uploadError) {
      emitToast({ type: 'error', message: uploadError.message || 'Failed to upload attachment.' })
      setUploading(false)
      return
    }

    const url = supabase.storage.from('attachments').getPublicUrl(path).data.publicUrl
    const { data: attachmentRow, error: insertError } = await supabase
      .from('attachments')
      .insert([{ task_id: task.id, file_url: url }])
      .select('id,file_url,uploaded_at')
      .single()

    if (insertError || !attachmentRow) {
      emitToast({ type: 'error', message: insertError?.message || 'Attachment uploaded but metadata save failed.' })
      setUploading(false)
      return
    }

    setTask((prev) => {
      if (!prev) return prev
      return { ...prev, attachments: [...(prev.attachments || []), attachmentRow] }
    })
    setAttachmentFile(null)
    setUploading(false)
    emitToast({ type: 'success', message: 'Attachment added successfully.' })
  }

  async function handleDeleteAttachment(attachment: { id: string; file_url: string }) {
    if (!task) return
    const confirmed = window.confirm('Remove this attachment?')
    if (!confirmed) return

    setDeletingAttachmentId(attachment.id)

    const marker = '/storage/v1/object/public/attachments/'
    const index = attachment.file_url.indexOf(marker)
    const path = index >= 0 ? decodeURIComponent(attachment.file_url.slice(index + marker.length)) : ''

    if (path) {
      const { error: storageDeleteError } = await supabase.storage.from('attachments').remove([path])
      if (storageDeleteError) {
        emitToast({ type: 'error', message: storageDeleteError.message || 'Failed to remove file from storage.' })
        setDeletingAttachmentId('')
        return
      }
    }

    const { error } = await supabase.from('attachments').delete().eq('id', attachment.id).eq('task_id', task.id)
    if (error) {
      emitToast({ type: 'error', message: error.message || 'Failed to remove attachment metadata.' })
      setDeletingAttachmentId('')
      return
    }

    setTask((prev) => {
      if (!prev) return prev
      return { ...prev, attachments: (prev.attachments || []).filter((item) => item.id !== attachment.id) }
    })
    setDeletingAttachmentId('')
    emitToast({ type: 'success', message: 'Attachment removed successfully.' })
  }

  if (loading) {
    return (
      <section>
        <h1 className="text-2xl font-semibold mb-4">Task Details</h1>
        <p className="text-sm ucc-muted">Loading task details...</p>
      </section>
    )
  }

  if (!task) {
    return (
      <section>
        <h1 className="text-2xl font-semibold mb-4">Task Details</h1>
        <div className="ucc-card p-4">
          <p className="text-sm text-red-700">{errorMessage || 'Task not found.'}</p>
          <Link href="/tasks" className="ucc-link">Back to Task Feed</Link>
        </div>
      </section>
    )
  }

  const canManageAttachments = currentUserId && task.author_id === currentUserId

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Task Details</h1>
        <Link href="/tasks" className="ucc-link">Back to Task Feed</Link>
      </div>

      <article className="ucc-card p-4 space-y-3">
        <div>
          <h2 className="text-xl font-semibold">{task.title}</h2>
          <p className="text-xs ucc-muted mt-1">
            {new Date(task.created_at).toLocaleString()} • {task.reporting_area} • {task.users?.name || task.users?.email || authorFallback || 'Unknown'}
          </p>
        </div>

        <div>
          <h3 className="font-medium">Description</h3>
          <p className="text-sm mt-1 whitespace-pre-wrap">{task.description || 'No description provided.'}</p>
        </div>

        <div>
          <h3 className="font-medium">Attachments</h3>
          {canManageAttachments && (
            <div className="mt-2 mb-3 flex flex-wrap items-center gap-2">
              <label className="text-sm">
                Add file
                <input type="file" onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)} className="ucc-input max-w-md" />
              </label>
              <button type="button" disabled={!attachmentFile || uploading} onClick={handleAddAttachment} className="ucc-btn-sm disabled:opacity-50">
                {uploading ? 'Uploading...' : 'Add attachment'}
              </button>
            </div>
          )}
          {task.attachments && task.attachments.length > 0 ? (
            <ul className="mt-2 space-y-2 text-sm">
              {task.attachments.map((attachment, index) => (
                <li key={attachment.id} className="flex items-center gap-3">
                  <a href={attachment.file_url} target="_blank" rel="noreferrer" className="ucc-link">
                    View attachment {index + 1}
                  </a>
                  {canManageAttachments && (
                    <button
                      type="button"
                      disabled={deletingAttachmentId === attachment.id}
                      onClick={() => handleDeleteAttachment(attachment)}
                      className="ucc-btn-sm disabled:opacity-50"
                    >
                      {deletingAttachmentId === attachment.id ? 'Removing...' : 'Remove'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm ucc-muted mt-1">No attachments.</p>
          )}
        </div>
      </article>
    </section>
  )
}
