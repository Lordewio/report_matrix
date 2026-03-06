"use client"
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import supabase from '../src/lib/supabaseClient'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)

  const publicPaths = ['/login', '/auth', '/reset-password']
  const isPublicPath = publicPaths.some((p) => pathname === p || pathname?.startsWith(`${p}/`))

  useEffect(() => {
    if (isPublicPath) {
      setChecked(true)
      return
    }

    let mounted = true
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (!data?.user) {
        router.replace('/login')
      } else if (mounted) setChecked(true)
    })()
    return () => { mounted = false }
  }, [router, isPublicPath])

  if (!checked) return null
  return <>{children}</>
}
