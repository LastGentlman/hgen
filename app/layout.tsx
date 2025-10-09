import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HGen - Generador de Horarios de Trabajo',
  description: 'Genera y gestiona horarios de trabajo fácilmente',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50 min-h-screen">
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  )
}