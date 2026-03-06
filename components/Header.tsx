"use client"
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import supabase from '../src/lib/supabaseClient'

export default function Header() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    let mounted = true

    const refreshUserState = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) {
        if (mounted) setIsSignedIn(false)
        if (mounted) setIsAdmin(false)
        return
      }

      if (mounted) setIsSignedIn(true)

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
        <Link href="/" className="font-semibold text-white">UCC Reporting Matrix</Link>
        <nav className="space-x-4 text-sm flex items-center">
          <Link href="/" className="ucc-nav-link">Dashboard</Link>
          <Link href="/tasks" className="ucc-nav-link">Task Feed</Link>
          <Link href="/tasks/new" className="ucc-nav-link">Log Task</Link>
          <Link href="/my-tasks" className="ucc-nav-link">My Tasks</Link>
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
