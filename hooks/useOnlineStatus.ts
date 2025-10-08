import { useState, useEffect } from 'react'

/**
 * Hook para detectar el estado de conexión online/offline
 * Detecta cambios en tiempo real y persiste el estado
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    // SSR safety: assume online on server
    if (typeof window === 'undefined') return true
    return navigator.onLine
  })

  useEffect(() => {
    // SSR safety
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      console.log('🌐 Conexión restablecida')
      setIsOnline(true)
    }

    const handleOffline = () => {
      console.warn('⚠️ Sin conexión a internet')
      setIsOnline(false)
    }

    // Escuchar eventos del navegador
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Verificar estado actual
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
