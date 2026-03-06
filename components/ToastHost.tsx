"use client"
import React, { useEffect, useState } from 'react'
import { subscribeToasts, ToastMessage } from '../src/lib/uiEvents'

type ToastItem = ToastMessage & { id: string }

export default function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    return subscribeToasts((toast) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      setToasts((prev) => [...prev, { ...toast, id }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 3500)
    })
  }, [])

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 w-80">
      {toasts.map((toast) => {
        const tone = toast.type === 'success'
          ? 'border-green-200 bg-green-50 text-green-700'
          : toast.type === 'error'
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-blue-200 bg-blue-50 text-blue-700'

        return (
          <div key={toast.id} className={`rounded border px-3 py-2 shadow ${tone}`}>
            <p className="text-sm">{toast.message}</p>
          </div>
        )
      })}
    </div>
  )
}
