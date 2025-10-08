'use client'

import { useState, useEffect } from 'react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { syncQueue, subscribeSyncStatus, type SyncStatus } from '@/lib/sync-queue'
import { getLastSync } from '@/lib/hybrid-storage'
import { processSyncQueue } from '@/lib/sync-processor'
import { storage } from '@/lib/storage'
import { Cloud, CloudOff, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export default function SyncIndicator() {
  const isOnline = useOnlineStatus()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)

  // Actualizar contador de operaciones pendientes
  useEffect(() => {
    const updatePendingCount = () => {
      setPendingCount(syncQueue.size())
    }

    updatePendingCount()
    const interval = setInterval(updatePendingCount, 1000)

    return () => clearInterval(interval)
  }, [])

  // Suscribirse a cambios de estado de sincronización
  useEffect(() => {
    const unsubscribe = subscribeSyncStatus(setSyncStatus)
    return unsubscribe
  }, [])

  // Actualizar última sincronización
  useEffect(() => {
    setLastSync(getLastSync())
  }, [syncStatus])

  // Auto-sincronizar cuando vuelve la conexión
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      handleSync()
    }
  }, [isOnline, pendingCount])

  const handleSync = async () => {
    if (isSyncing || !isOnline) return

    setIsSyncing(true)
    try {
      // 1. Sincronizar cola de operaciones pendientes
      await processSyncQueue()

      // 2. Sincronizar datos desde servidor
      await storage.syncFromServer()

      setLastSync(getLastSync())
    } catch (error) {
      console.error('Error during sync:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  const getStatusIcon = () => {
    if (!isOnline) {
      return <CloudOff className="h-4 w-4 text-gray-400" />
    }

    if (isSyncing) {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    }

    if (pendingCount > 0) {
      return <AlertCircle className="h-4 w-4 text-amber-500" />
    }

    if (syncStatus === 'error') {
      return <AlertCircle className="h-4 w-4 text-red-500" />
    }

    return <Cloud className="h-4 w-4 text-green-500" />
  }

  const getStatusText = () => {
    if (!isOnline) {
      return 'Modo Offline'
    }

    if (isSyncing) {
      return 'Sincronizando...'
    }

    if (pendingCount > 0) {
      return `${pendingCount} pendiente${pendingCount > 1 ? 's' : ''}`
    }

    if (syncStatus === 'error') {
      return 'Error de sincronización'
    }

    return 'Sincronizado'
  }

  const getStatusColor = () => {
    if (!isOnline) return 'text-gray-600 bg-gray-50 border-gray-200'
    if (isSyncing) return 'text-blue-600 bg-blue-50 border-blue-200'
    if (pendingCount > 0) return 'text-amber-600 bg-amber-50 border-amber-200'
    if (syncStatus === 'error') return 'text-red-600 bg-red-50 border-red-200'
    return 'text-green-600 bg-green-50 border-green-200'
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={handleSync}
        disabled={!isOnline || isSyncing}
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg border shadow-sm transition-all ${getStatusColor()} ${
          isOnline && !isSyncing ? 'hover:shadow-md cursor-pointer' : 'cursor-not-allowed'
        }`}
        title={lastSync ? `Última sincronización: ${new Date(lastSync).toLocaleString()}` : 'Sin sincronizar'}
      >
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
        {isOnline && !isSyncing && (
          <RefreshCw className="h-3 w-3 opacity-60" />
        )}
      </button>

      {/* Badge de operaciones pendientes (solo visible cuando hay) */}
      {pendingCount > 0 && (
        <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-md">
          {pendingCount}
        </div>
      )}
    </div>
  )
}
