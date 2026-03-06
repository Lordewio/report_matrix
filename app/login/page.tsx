"use client"
import React, { useState } from 'react'
import supabase from '../../src/lib/supabaseClient'
import { useRouter } from 'next/navigation'

function getFriendlyAuthError(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) return 'Invalid email or password.'
  if (normalized.includes('email not confirmed')) return 'This email is not confirmed yet. Contact an admin.'
  if (normalized.includes('too many requests')) return 'Too many login attempts. Please wait and try again.'
  if (normalized.includes('network') || normalized.includes('fetch')) return 'Network error. Check your internet and try again.'
  return message || 'Sign in failed. Please try again.'
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  const router = useRouter()

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()

    if (!normalizedEmail || !trimmedPassword) {
      setErrorMessage('Email and password are required.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      setErrorMessage('Please enter a valid email address.')
      return
    }

    setSigningIn(true)
    setErrorMessage('')

    try {
      await supabase.auth.signOut()
      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password: trimmedPassword })
      if (error) {
        setErrorMessage(getFriendlyAuthError(error.message))
        setSigningIn(false)
        return
      }
      setSigningIn(false)
      router.push('/')
    } catch (err: any) {
      setErrorMessage(getFriendlyAuthError(err?.message || ''))
      setSigningIn(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <h1 className="text-xl font-semibold mb-4">Login</h1>
      <form onSubmit={handle} className="ucc-card p-4">
        {errorMessage && <p className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{errorMessage}</p>}
        <label className="block mb-2">Email
          <input type="email" className="ucc-input" value={email} onChange={(e)=>{ setEmail(e.target.value); if (errorMessage) setErrorMessage('') }} />
        </label>
        <label className="block mb-2">Password
          <input type="password" className="ucc-input" value={password} onChange={(e)=>{ setPassword(e.target.value); if (errorMessage) setErrorMessage('') }} />
        </label>
        <div className="text-right"><button disabled={signingIn || !email.trim() || !password.trim()} className="ucc-btn disabled:opacity-50">{signingIn ? 'Signing in...' : 'Sign in'}</button></div>
      </form>
    </div>
  )
}
