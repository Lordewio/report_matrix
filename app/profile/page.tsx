"use client"
import React, { useEffect, useState } from 'react'
import supabase from '../../src/lib/supabaseClient'
import { emitToast } from '../../src/lib/uiEvents'

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

type ProfileRow = {
  id: string
  name: string | null
  email: string
  role: string
  created_at: string | null
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removingPhoto, setRemovingPhoto] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  function getStoragePathFromPublicUrl(url: string) {
    const marker = '/storage/v1/object/public/attachments/'
    const index = url.indexOf(marker)
    if (index < 0) return ''
    return decodeURIComponent(url.slice(index + marker.length))
  }

  function handleAvatarFileChange(file: File | null) {
    if (!file) {
      setAvatarFile(null)
      return
    }

    if (!ALLOWED_AVATAR_MIME_TYPES.includes(file.type)) {
      setErrorMessage('Please upload a JPG, PNG, WEBP, or GIF image.')
      setAvatarFile(null)
      return
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setErrorMessage('Profile photo must be 5MB or smaller.')
      setAvatarFile(null)
      return
    }

    setErrorMessage('')
    setAvatarFile(file)
  }

  useEffect(() => {
    let mounted = true

    ;(async () => {
      setErrorMessage('')

      const { data: authData, error: authError } = await supabase.auth.getUser()
      const user = authData.user

      if (!user || authError) {
        if (mounted) {
          setErrorMessage('Please sign in to view your profile.')
          setLoading(false)
        }
        return
      }

      const fallbackName =
        (user.user_metadata?.name as string | undefined) ||
        (user.user_metadata?.full_name as string | undefined) ||
        user.email?.split('@')[0] ||
        'User'

      const { error: ensureProfileError } = await supabase.from('users').upsert(
        {
          id: user.id,
          email: user.email || `${user.id}@example.local`,
          name: fallbackName
        },
        { onConflict: 'id' }
      )

      if (ensureProfileError) {
        if (mounted) {
          setErrorMessage(ensureProfileError.message || 'Failed to load profile.')
          setLoading(false)
        }
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('id,name,email,role,created_at')
        .eq('id', user.id)
        .single()

      if (!mounted) return

      if (profileError || !profileData) {
        setErrorMessage(profileError?.message || 'Failed to load profile.')
        setLoading(false)
        return
      }

      setProfile(profileData as ProfileRow)
      setName((profileData.name || '').trim())
      setAvatarUrl(String(user.user_metadata?.avatar_url || user.user_metadata?.avatarUrl || ''))
      setLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setErrorMessage('Name is required.')
      return
    }

    setSaving(true)
    setErrorMessage('')

    let nextAvatarUrl = avatarUrl

    if (avatarFile) {
      const path = `avatars/${profile.id}/${Date.now()}-${avatarFile.name}`
      const { error: uploadError } = await supabase.storage.from('attachments').upload(path, avatarFile)
      if (uploadError) {
        setErrorMessage(uploadError.message || 'Failed to upload profile photo.')
        setSaving(false)
        return
      }
      nextAvatarUrl = supabase.storage.from('attachments').getPublicUrl(path).data.publicUrl
    }

    const { error } = await supabase
      .from('users')
      .update({ name: trimmedName })
      .eq('id', profile.id)

    if (error) {
      setErrorMessage(error.message || 'Failed to update profile.')
      setSaving(false)
      return
    }

    await supabase.auth.updateUser({ data: { name: trimmedName, full_name: trimmedName, avatar_url: nextAvatarUrl } })

    setProfile((prev) => (prev ? { ...prev, name: trimmedName } : prev))
    setAvatarUrl(nextAvatarUrl)
    setAvatarFile(null)
    setSaving(false)
    emitToast({ type: 'success', message: 'Profile updated successfully.' })
  }

  async function handleRemovePhoto() {
    if (!avatarUrl) return
    if (!profile) return

    const confirmed = window.confirm('Remove your profile photo?')
    if (!confirmed) return

    setRemovingPhoto(true)
    setErrorMessage('')

    const path = getStoragePathFromPublicUrl(avatarUrl)
    if (path) {
      await supabase.storage.from('attachments').remove([path])
    }

    const { error } = await supabase.auth.updateUser({ data: { avatar_url: null, avatarUrl: null } })
    if (error) {
      setErrorMessage(error.message || 'Failed to remove profile photo.')
      setRemovingPhoto(false)
      return
    }

    setAvatarUrl('')
    setAvatarFile(null)
    setRemovingPhoto(false)
    emitToast({ type: 'success', message: 'Profile photo removed.' })
  }

  if (loading) {
    return (
      <section>
        <h1 className="text-2xl font-semibold mb-4">My Profile</h1>
        <p className="text-sm ucc-muted">Loading profile...</p>
      </section>
    )
  }

  if (!profile) {
    return (
      <section>
        <h1 className="text-2xl font-semibold mb-4">My Profile</h1>
        <div className="ucc-card p-4">
          <p className="text-sm text-red-700">{errorMessage || 'Unable to load profile.'}</p>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold mb-4">My Profile</h1>

      <form onSubmit={handleSave} className="ucc-card p-4 max-w-2xl">
        {errorMessage && <p className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{errorMessage}</p>}

        <div className="mb-4 flex items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" className="h-16 w-16 rounded-full object-cover border" />
          ) : (
            <div className="h-16 w-16 rounded-full border grid place-items-center text-xs ucc-muted">No photo</div>
          )}
          <label className="block text-sm flex-1">Profile photo
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleAvatarFileChange(e.target.files?.[0] || null)}
              className="ucc-input"
            />
            <span className="mt-1 block text-xs ucc-muted">
              {avatarFile
                ? `Selected: ${avatarFile.name}`
                : `Upload a square image for best results. Max ${Math.floor(MAX_AVATAR_SIZE_BYTES / (1024 * 1024))}MB.`}
            </span>
          </label>
        </div>

        {avatarUrl && (
          <div className="mb-4">
            <button
              type="button"
              onClick={handleRemovePhoto}
              disabled={saving || removingPhoto}
              className="ucc-btn-sm disabled:opacity-50"
            >
              {removingPhoto ? 'Removing photo...' : 'Remove photo'}
            </button>
          </div>
        )}

        <label className="block mb-3 text-sm">Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="ucc-input"
            required
            maxLength={120}
          />
        </label>

        <label className="block mb-3 text-sm">Email
          <input value={profile.email || ''} className="ucc-input" disabled />
        </label>

        <label className="block mb-3 text-sm">Role
          <input value={profile.role || 'User'} className="ucc-input" disabled />
        </label>

        <label className="block mb-4 text-sm">Member Since
          <input
            value={profile.created_at ? new Date(profile.created_at).toLocaleString() : '-'}
            className="ucc-input"
            disabled
          />
        </label>

        <div className="text-right">
          <button type="submit" disabled={saving || !name.trim()} className="ucc-btn disabled:opacity-50">
            {saving ? 'Saving...' : 'Save profile'}
          </button>
        </div>
      </form>
    </section>
  )
}
