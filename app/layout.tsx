import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HGen - Work Schedule Generator',
  description: 'Generate and manage employee work schedules with ease',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  )
}