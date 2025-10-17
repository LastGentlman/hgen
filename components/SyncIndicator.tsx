'use client'

import { useState, useEffect, useRef } from 'react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { syncQueue, subscribeSyncStatus, type SyncStatus } from '@/lib/sync-queue'
import { getLastSync } from '@/lib/hybrid-storage'
import { processSyncQueue } from '@/lib/sync-processor'
import { storage } from '@/lib/storage'
import { Cloud, CloudOff, RefreshCw, CheckCircle, AlertCircle, Loader2, Info, X, Eye, EyeOff } from 'lucide-react'

interface SyncIndicatorProps {
  onDataRefresh?: () => void
}

export default function SyncIndicator({ onDataRefresh }: SyncIndicatorProps) {
  const isOnline = useOnlineStatus()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false)
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [showSupabaseUrl, setShowSupabaseUrl] = useState(false)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

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

  // Cerrar menú contextual al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu(false)
      }
    }

    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showContextMenu])

  const handleSync = async () => {
    if (isSyncing || !isOnline) return

    setIsSyncing(true)
    try {
      // 1. Sincronizar cola de operaciones pendientes (push to Supabase)
      await processSyncQueue()

      // 2. DISABLED: No sincronizar desde servidor (localStorage es la fuente de verdad)
      // await storage.syncFromServer()

      setLastSync(getLastSync())
    } catch (error) {
      console.error('Error during sync:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleRefreshFromSupabase = async () => {
    setShowContextMenu(false)
    setIsSyncing(true)

    try {
      await storage.refreshFromSupabase()
      setLastSync(new Date().toISOString())

      // Llamar callback para refrescar UI
      if (onDataRefresh) {
        onDataRefresh()
      }
    } catch (error) {
      console.error('Error refreshing from Supabase:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleShowDiagnostic = async () => {
    setShowContextMenu(false)
    setIsSyncing(true)

    try {
      const diag = await storage.getDiagnostics()
      setDiagnostics(diag)
      setShowSupabaseUrl(false) // Reset URL visibility
      setShowDiagnosticModal(true)
    } catch (error) {
      console.error('Error getting diagnostics:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowContextMenu(true)
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
    <>
      <div className="fixed bottom-4 right-4 z-50">
        <button
          ref={buttonRef}
          onClick={handleSync}
          onContextMenu={handleContextMenu}
          disabled={!isOnline || isSyncing}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg border shadow-sm transition-all ${getStatusColor()} ${
            isOnline && !isSyncing ? 'hover:shadow-md cursor-pointer' : 'cursor-not-allowed'
          }`}
          title={lastSync ? `Última sincronización: ${new Date(lastSync).toLocaleString()}\n\nClick derecho para más opciones` : 'Sin sincronizar\n\nClick derecho para más opciones'}
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

        {/* Menú Contextual */}
        {showContextMenu && (
          <div
            ref={contextMenuRef}
            className="absolute bottom-full right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[220px] z-[100]"
          >
            <button
              onClick={handleRefreshFromSupabase}
              disabled={!isOnline || isSyncing}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refrescar desde Supabase</span>
            </button>
            <button
              onClick={handleShowDiagnostic}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center space-x-2"
            >
              <Info className="h-4 w-4" />
              <span>Ver Diagnóstico</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal de Diagnóstico */}
      {showDiagnosticModal && diagnostics && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold flex items-center space-x-2">
                <Info className="h-5 w-5 text-blue-500" />
                <span>Diagnóstico del Sistema</span>
              </h2>
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Conexión Supabase */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Conexión Supabase</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estado:</span>
                    <span className={`font-medium ${diagnostics.isConnected ? 'text-green-600' : 'text-red-600'}`}>
                      {diagnostics.isConnected ? '✓ Conectado' : '✗ Desconectado'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-gray-600">URL:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setShowSupabaseUrl(!showSupabaseUrl)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title={showSupabaseUrl ? 'Ocultar URL' : 'Mostrar URL'}
                      >
                        {showSupabaseUrl ? (
                          <EyeOff className="h-4 w-4 text-gray-600" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-600" />
                        )}
                      </button>
                      <span className="font-mono text-xs">
                        {showSupabaseUrl
                          ? diagnostics.supabaseUrl
                          : '♠♠♠♠♠♠♠♠♠♠♠♠♠♠♠♠♠♠♠♠♠♠♠♠♠♠♠♠'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Datos en Supabase */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Datos en Supabase</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Empleados:</span>
                    <span className="font-semibold text-blue-600">{diagnostics.supabaseEmployees}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Horarios:</span>
                    <span className="font-semibold text-blue-600">{diagnostics.supabaseSchedules}</span>
                  </div>
                </div>
              </div>

              {/* Datos en localStorage */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Datos históricos (localStorage)</h3>
                <p className="text-xs text-gray-500 mb-2">Solo para referencia. La app usa Supabase como fuente de verdad.</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Empleados:</span>
                    <span className="font-semibold text-gray-600">{diagnostics.localEmployees}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Horarios:</span>
                    <span className="font-semibold text-gray-600">{diagnostics.localSchedules}</span>
                  </div>
                </div>
              </div>

              {/* Estado de sincronización */}
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Sincronización</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Migración completada:</span>
                    <span className={`font-medium ${diagnostics.migrationFlag ? 'text-green-600' : 'text-gray-600'}`}>
                      {diagnostics.migrationFlag ? 'Sí' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Última sincronización:</span>
                    <span className="font-medium text-gray-900">
                      {diagnostics.lastSync
                        ? new Date(diagnostics.lastSync).toLocaleString()
                        : 'Nunca'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Operaciones pendientes:</span>
                    <span className="font-semibold text-amber-600">{pendingCount}</span>
                  </div>
                </div>
              </div>

              {/* Recomendaciones */}
              {!diagnostics.isConnected && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-medium text-red-900 mb-2">⚠️ Sin conexión a Supabase</h3>
                  <p className="text-sm text-red-800">
                    No se pudo conectar a la base de datos. Verifica tu conexión a internet y las credenciales de Supabase.
                  </p>
                </div>
              )}
              {diagnostics.isConnected && diagnostics.supabaseEmployees === 0 && diagnostics.supabaseSchedules === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-medium text-yellow-900 mb-2">ℹ️ Base de datos vacía</h3>
                  <p className="text-sm text-yellow-800">
                    No hay datos en Supabase. Esto es normal si es la primera vez que usas la aplicación.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-2">
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="px-4 py-2 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  setShowDiagnosticModal(false)
                  handleRefreshFromSupabase()
                }}
                disabled={!isOnline || isSyncing}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refrescar Ahora</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
