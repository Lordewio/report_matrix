"use client"
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import supabase from '../src/lib/supabaseClient'

export default function Header() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    let mounted = true

    const refreshUserState = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) {
        if (mounted) setIsSignedIn(false)
        if (mounted) setIsAdmin(false)
        if (mounted) setAvatarUrl('')
        return
      }

      if (mounted) setIsSignedIn(true)
      if (mounted) {
        setAvatarUrl(
          String(user.user_metadata?.avatar_url || user.user_metadata?.avatarUrl || '')
        )
      }

      const { data: profile, error } = await supabase.from('users').select('role').eq('id', user.id).single()
      if (mounted) setIsAdmin(!error && String(profile?.role || '').toLowerCase() === 'admin')
    }

    refreshUserState()

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      refreshUserState()
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    setIsSigningOut(true)
    await supabase.auth.signOut()
    setIsSigningOut(false)
    router.replace('/login')
  }

  return (
    <header className="ucc-header shadow">
      <div className="max-w-5xl mx-auto p-4 flex items-center justify-between">
        <Link href="/" className="font-semibold text-white flex items-center gap-2">
           <img src="/ucc-logo.png" alt="Uganda Communications Commission" className="h-8 w-8 rounded-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/ucc-logo.svg' }} />
          <span>UCC Legal Reporting Matrix</span>
        </Link>
        <nav className="space-x-4 text-sm flex items-center">
          <Link href="/" className="ucc-nav-link">Dashboard</Link>
          <Link href="/tasks" className="ucc-nav-link">Task Feed</Link>
          <Link href="/tasks/new" className="ucc-nav-link">Log Task</Link>
          <Link href="/my-tasks" className="ucc-nav-link">My Tasks</Link>
          <Link href="/profile" className="ucc-nav-link flex items-center gap-2">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="h-7 w-7 rounded-full object-cover border border-white/40" />
            ) : (
              <span className="h-7 w-7 rounded-full border border-white/40 text-white/90 text-[10px] grid place-items-center">ME</span>
            )}
            <span>Profile</span>
          </Link>
          <Link href="/reports" className="ucc-nav-link">Reports</Link>
          {isAdmin && <Link href="/admin" className="ucc-nav-link">Admin</Link>}
          {isSignedIn && (
            <button type="button" onClick={handleSignOut} disabled={isSigningOut} className="ucc-nav-link disabled:opacity-60">
              {isSigningOut ? 'Signing out...' : 'Sign out'}
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}
