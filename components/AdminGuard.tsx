"use client"
import React, { useEffect, useState } from 'react'
import supabase from '../src/lib/supabaseClient'

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) {
        setIsAdmin(false)
        return
      }
      // fetch role from users table
      const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
      if (mounted) setIsAdmin(profile?.role === 'Admin')
    })()
    return () => { mounted = false }
  }, [])

  if (isAdmin === null) return null
  if (!isAdmin) return <div className="p-4 bg-white rounded shadow">Access denied — Admins only.</div>
  return <>{children}</>
}
