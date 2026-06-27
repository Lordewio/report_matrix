import './globals.css'
import React from 'react'
import Header from '../components/Header'
import AuthGuard from '../components/AuthGuard'
import ToastHost from '../components/ToastHost'

export const metadata = {
  title: 'UCC Reporting Matrix',
  icons: {
    icon: '/icon.svg'
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <ToastHost />
        <AuthGuard>
          <main className="max-w-5xl mx-auto p-4">{children}</main>
        </AuthGuard>
      </body>
    </html>
  )
}
