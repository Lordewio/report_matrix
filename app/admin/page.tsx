"use client"
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import supabase from '../../src/lib/supabaseClient'
import { emitToast } from '../../src/lib/uiEvents'

type UserRow = {
  id: string
  name: string | null
  email: string
  role: string
  created_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [savingUserId, setSavingUserId] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('User')
  const [deletingUserId, setDeletingUserId] = useState('')
  const [resettingUserId, setResettingUserId] = useState('')

  async function getAccessToken() {
    const { data: sessionData } = await supabase.auth.getSession()
    return sessionData.session?.access_token || ''
  }

  async function loadUsers() {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      setAuthorized(false)
      setLoading(false)
      setErrorMessage('Please sign in.')
      emitToast({ type: 'error', message: 'Please sign in to access admin tools.' })
      router.replace('/tasks')
      return
    }

    const response = await fetch('/api/admin/users', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setAuthorized(false)
      setLoading(false)
      setErrorMessage(payload.error || 'Access denied — Admins only.')
      emitToast({ type: 'error', message: payload.error || 'Access denied — Admins only.' })
      router.replace('/tasks')
      return
    }

    setUsers(payload.users || [])
    setAuthorized(true)
    setLoading(false)
  }

  async function handleRoleSave(userId: string, role: string) {
    setSavingUserId(userId)
    const accessToken = await getAccessToken()
    if (!accessToken) {
      setSavingUserId('')
      emitToast({ type: 'error', message: 'Session expired. Please sign in again.' })
      return
    }

    const body = new FormData()
    body.append('userId', userId)
    body.append('role', role)

    const response = await fetch('/api/admin/change-role', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setSavingUserId('')
      emitToast({ type: 'error', message: payload.error || 'Failed to update role.' })
      return
    }

    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, role } : user)))
    setSavingUserId('')
    emitToast({ type: 'success', message: 'Role updated successfully.' })
  }

  async function handleCreateUser() {
    const normalizedEmail = newEmail.trim().toLowerCase()
    const normalizedName = newName.trim()
    if (!normalizedEmail) {
      emitToast({ type: 'error', message: 'Email is required.' })
      return
    }

    setCreating(true)
    const accessToken = await getAccessToken()
    if (!accessToken) {
      setCreating(false)
      emitToast({ type: 'error', message: 'Session expired. Please sign in again.' })
      return
    }

    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: normalizedName,
        email: normalizedEmail,
        password: newPassword,
        role: newRole
      })
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setCreating(false)
      emitToast({ type: 'error', message: payload.error || 'Failed to create user.' })
      return
    }

    if (payload.user) {
      setUsers((prev) => [...prev, payload.user].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email)))
    }
    setNewName('')
    setNewEmail('')
    setNewPassword('')
    setNewRole('User')
    setCreating(false)
    emitToast({ type: 'success', message: 'User created successfully.' })
  }

  async function handleDeleteUser(userId: string) {
    const target = users.find((u) => u.id === userId)
    if (!target) return
    const confirmed = window.confirm(`Delete user ${target.email}? This cannot be undone.`)
    if (!confirmed) return

    setDeletingUserId(userId)
    const accessToken = await getAccessToken()
    if (!accessToken) {
      setDeletingUserId('')
      emitToast({ type: 'error', message: 'Session expired. Please sign in again.' })
      return
    }

    const response = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setDeletingUserId('')
      emitToast({ type: 'error', message: payload.error || 'Failed to delete user.' })
      return
    }

    setUsers((prev) => prev.filter((u) => u.id !== userId))
    setDeletingUserId('')
    emitToast({ type: 'success', message: 'User deleted successfully.' })
  }

  async function handleResetPassword(userId: string) {
    const target = users.find((u) => u.id === userId)
    if (!target) return
    const password = window.prompt(`Enter a new password for ${target.email} (min 6 characters):`, '') || ''
    if (!password) return
    if (password.length < 6) {
      emitToast({ type: 'error', message: 'Password must be at least 6 characters.' })
      return
    }

    setResettingUserId(userId)
    const accessToken = await getAccessToken()
    if (!accessToken) {
      setResettingUserId('')
      emitToast({ type: 'error', message: 'Session expired. Please sign in again.' })
      return
    }

    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId, password })
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setResettingUserId('')
      emitToast({ type: 'error', message: payload.error || 'Failed to reset password.' })
      return
    }

    setResettingUserId('')
    emitToast({ type: 'success', message: 'Password reset successfully.' })
  }

  useEffect(() => {
    loadUsers()
  }, [router])

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Admin Panel</h1>
        <div className="flex gap-4">
          <Link href="/admin/archived" className="ucc-link">Archived Tasks</Link>
          <Link href="/admin/audit" className="ucc-link">View Audit Logs</Link>
        </div>
      </div>

      {loading && <p className="text-sm ucc-muted">Loading admin tools...</p>}
      {!loading && !authorized && <div className="ucc-card p-4 text-sm ucc-muted">{errorMessage || 'Access denied — Admins only.'}</div>}

      {!loading && authorized && (
        <div className="space-y-4">
          <div className="ucc-card p-4">
            <h2 className="font-semibold mb-3">Add User</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <label className="text-sm">Name
                <input value={newName} onChange={(e) => setNewName(e.target.value)} className="ucc-input" placeholder="Full name" />
              </label>
              <label className="text-sm">Email
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="ucc-input" placeholder="name@domain.com" />
              </label>
              <label className="text-sm">Password
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="ucc-input" placeholder="At least 6 characters" />
              </label>
              <label className="text-sm">Role
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="ucc-input">
                  <option value="User">User</option>
                  <option value="Admin">Admin</option>
                </select>
              </label>
              <button
                type="button"
                className="ucc-btn disabled:opacity-50"
                disabled={creating || !newEmail.trim() || newPassword.length < 6}
                onClick={handleCreateUser}
              >
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>
            <p className="mt-2 text-xs ucc-muted">Delete is blocked for users with tasks and for the last remaining admin.</p>
          </div>

          <div className="ucc-card p-4">
            <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b"><th>Name</th><th>Email</th><th>Role</th><th>Action</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <AdminRow
                  key={u.id}
                  user={u}
                  onSave={handleRoleSave}
                  onDelete={handleDeleteUser}
                  onResetPassword={handleResetPassword}
                  saving={savingUserId === u.id}
                  deleting={deletingUserId === u.id}
                  resetting={resettingUserId === u.id}
                />
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </section>
  )
}

function AdminRow({ user, onSave, onDelete, onResetPassword, saving, deleting, resetting }: { user: UserRow; onSave: (userId: string, role: string) => void; onDelete: (userId: string) => void; onResetPassword: (userId: string) => void; saving: boolean; deleting: boolean; resetting: boolean }) {
  const [role, setRole] = useState(user.role)

  return (
    <tr className="border-b">
      <td className="py-2">{user.name}</td>
      <td>{user.email}</td>
      <td>{user.role}</td>
      <td>
        <div className="flex gap-2">
          <select
            aria-label={`Role for ${user.name || user.email || 'user'}`}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="ucc-input mt-0 py-1 px-2"
          >
            <option value="User">User</option>
            <option value="Admin">Admin</option>
          </select>
          <button disabled={saving || role === user.role} onClick={() => onSave(user.id, role)} className="ucc-btn-sm disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
          <button disabled={resetting} onClick={() => onResetPassword(user.id)} className="ucc-btn-sm disabled:opacity-50">{resetting ? 'Resetting...' : 'Reset Password'}</button>
          <button disabled={deleting} onClick={() => onDelete(user.id)} className="ucc-btn-sm disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
        </div>
      </td>
    </tr>
  )
}
