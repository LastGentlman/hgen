'use client'

import { useState, useEffect } from 'react'
import { Schedule, BranchCode, Division } from '@/types'
import { storage } from '@/lib/storage'
import { parseLocalDate } from '@/lib/utils'
import { exportAllSchedulesToCSV } from '@/lib/exportUtils'
import { History, Eye, Trash2, Calendar, ChevronDown, ChevronUp, AlertTriangle, Download } from 'lucide-react'
import { showDangerConfirm, showError } from '@/lib/sweetalert'

interface HistoryManagerProps {
  onScheduleSelect: (schedule: Schedule | null) => void
  activeScheduleId: string | null
  branchCode?: BranchCode
  division?: Division
  onUpdate?: () => void
}

export default function HistoryManager({ onScheduleSelect, activeScheduleId, branchCode, division, onUpdate }: HistoryManagerProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    loadSchedules()
  }, [])

  const loadSchedules = async () => {
    const allSchedules = await storage.getSchedules()
    const loadedSchedules = allSchedules
      .filter(s => {
        // If context provided, include only matching schedules (or those untagged for backward compatibility)
        if (branchCode && s.branchCode && s.branchCode !== branchCode) return false
        if (division && s.division && s.division !== division) return false
        return true
      })
    // Sort by start date descending (most recent first)
    const sortedSchedules = [...loadedSchedules].sort((a, b) =>
      parseLocalDate(b.startDate).getTime() - parseLocalDate(a.startDate).getTime()
    )
    setSchedules(sortedSchedules)
  }

  const handleDelete = async (id: string) => {
    const confirmed = await showDangerConfirm(
      'Esta acción no se puede deshacer.',
      '¿Eliminar horario?',
      'Sí, eliminar'
    )

    if (confirmed) {
      await storage.deleteSchedule(id)
      await loadSchedules()

      // If deleted schedule was active
      if (activeScheduleId === id) {
        const remaining = schedules.filter(s => s.id !== id)
        if (remaining.length > 0) {
          // Select the first available schedule
          onScheduleSelect(remaining[0])
        } else {
          // No schedules left, set to null
          onScheduleSelect(null)
        }
      }

      // Notify parent component to refresh state
      if (onUpdate) {
        onUpdate()
      }
    }
  }

  const handleClearAll = async () => {
    const confirmed = await showDangerConfirm(
      'Esto eliminará TODOS los horarios guardados. Esta acción no se puede deshacer.',
      '⚠️ ADVERTENCIA',
      'Sí, eliminar todo'
    )

    if (confirmed) {
      await storage.clearAllSchedules()
      setSchedules([])
      onScheduleSelect(null)

      // Notify parent component to refresh state
      if (onUpdate) {
        onUpdate()
      }
    }
  }

  const handleExportAll = async () => {
    try {
      const employees = await storage.getEmployees()
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `todos_los_horarios_${timestamp}.csv`

      exportAllSchedulesToCSV(schedules, employees, filename)
    } catch (error) {
      console.error('Error exporting all schedules:', error)
      showError('Error al exportar los horarios. Por favor, intenta de nuevo.')
    }
  }

  const getTotalDays = (schedule: Schedule) => {
    return schedule.days.length
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <History className="h-6 w-6 text-primary-600" />
            <div className="text-left">
              <h2 className="text-xl font-bold text-gray-900">Historial de Horarios</h2>
              <p className="text-sm text-gray-600">{schedules.length} horarios guardados</p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </button>

        {isExpanded && (
          <div className="border-t p-6 space-y-4">
            {schedules.length > 0 && (
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleExportAll}
                  className="text-xs text-gray-400 hover:text-primary-600 transition-colors flex items-center space-x-1"
                  title="Exportar todos los horarios a CSV"
                >
                  <Download className="h-3 w-3" />
                  <span>Exportar todo</span>
                </button>
                <button
                  onClick={handleClearAll}
                  className="text-xs text-gray-400 hover:text-red-600 transition-colors flex items-center space-x-1"
                  title="Limpiar todos los horarios"
                >
                  <AlertTriangle className="h-3 w-3" />
                  <span>Limpiar todo</span>
                </button>
              </div>
            )}

            {schedules.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No hay horarios</h3>
                <p className="text-gray-600 mb-6">
                  Crea un horario o importa desde CSV para comenzar.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => onScheduleSelect(null)}
                    className="btn btn-primary"
                  >
                    Crear horario
                  </button>
                  <button
                    onClick={() => document.getElementById('global-import-csv-trigger')?.dispatchEvent(new Event('click', { bubbles: true }))}
                    className="btn btn-secondary"
                  >
                    Importar CSV
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {schedules.map((schedule) => {
                  const totalDays = getTotalDays(schedule)
                  const isActive = activeScheduleId === schedule.id

                  return (
                    <div
                      key={schedule.id}
                      className={`card hover:shadow-md transition-all ${
                        isActive ? 'ring-2 ring-primary-500 bg-primary-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium text-gray-900">{schedule.name}</h3>
                            {isActive && (
                              <span className="px-2 py-1 text-xs bg-primary-600 text-white rounded">
                                Activo
                              </span>
                            )}
                          </div>

                          <div className="space-y-1 text-sm text-gray-600">
                            <p className="flex items-center space-x-1">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {parseLocalDate(schedule.startDate).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                                {' - '}
                                {parseLocalDate(schedule.endDate).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </span>
                            </p>

                            <p className="text-xs text-gray-500">
                              {totalDays} días • Creado: {new Date(schedule.createdAt).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1 ml-4">
                          <button
                            onClick={() => onScheduleSelect(schedule)}
                            className={`p-2 rounded transition-colors ${
                              isActive
                                ? 'text-primary-600 bg-primary-100'
                                : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
                            }`}
                            title="Ver horario"
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(schedule.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar horario"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
