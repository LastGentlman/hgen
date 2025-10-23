'use client'

import { useState, useEffect, useRef } from 'react'
import { Employee, Schedule, ShiftTemplate, BranchCode, Division, DayOfWeek } from '@/types'
import { storage } from '@/lib/storage'
import { generateWeeklySchedule, getDefaultShiftTemplates } from '@/lib/utils'
import { Plus, Calendar, Edit2, Trash2, Eye, ChevronDown, ChevronUp, Download, AlertTriangle } from 'lucide-react'
import dynamic from 'next/dynamic'
const CreateScheduleDialog = dynamic(() => import('@/components/CreateScheduleDialog'), { ssr: false })
import { showLoading, closeAlert, showSuccess, showError, showConfirm } from '@/lib/sweetalert'
import { showDangerConfirm } from '@/lib/sweetalert'
import { exportAllSchedulesToCSV, importFromCSV, importAllSchedulesFromCSV } from '@/lib/exportUtils'

interface ScheduleManagerProps {
  employees: Employee[]
  onUpdate: () => void
  onScheduleSelect: (schedule: Schedule | null) => void
  branchCode?: BranchCode
  division?: Division
  activeScheduleId?: string | null
}

export default function ScheduleManager({ employees, onUpdate, onScheduleSelect, branchCode, division, activeScheduleId }: ScheduleManagerProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [isCreating, setIsCreating] = useState(false) // legacy toggle (kept for layout conditions)
  const [isUnifiedDialogOpen, setIsUnifiedDialogOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const csvFileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({ name: '', startDate: '' }) // legacy
  // Legacy form state removed in favor of unified dialog
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  type LeftClickBehavior = 'form' | 'quick'
  const [leftClickBehavior, setLeftClickBehavior] = useState<LeftClickBehavior>(() => {
    if (typeof window === 'undefined') return 'form'
    const stored = window.localStorage.getItem('hgen_left_click_create_behavior') as LeftClickBehavior | null
    return stored === 'quick' || stored === 'form' ? stored : 'form'
  })

  useEffect(() => {
    loadSchedules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchCode, division])

  const loadSchedules = async () => {
    const all = await storage.getSchedules()
    const filtered = all.filter(s => {
      if (branchCode && s.branchCode && s.branchCode !== branchCode) return false
      if (division && s.division && s.division !== division) return false
      return true
    })
    setSchedules(filtered)
  }

  useEffect(() => {
    if (!isContextMenuOpen) return
    const close = () => setIsContextMenuOpen(false)
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('contextmenu', close)
    }
  }, [isContextMenuOpen])

  useEffect(() => {
    try {
      window.localStorage.setItem('hgen_left_click_create_behavior', leftClickBehavior)
    } catch {}
  }, [leftClickBehavior])

  const handleCreate = () => {
    // Abrir flujo unificado
    setIsUnifiedDialogOpen(true)
  }

  // handleSave eliminado: ahora usamos el diálogo unificado

  const handleCancel = () => {
    setIsCreating(false)
    setFormData({ name: '', startDate: '' })
  }

  const handleQuickCreate = async () => {
    // Atajo: abre el diálogo con valores precargados (flujo único)
    setIsUnifiedDialogOpen(true)
  }

  const handleImportFromCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) {
      return
    }

    try {
      showLoading('Importando CSV...', 'Procesando archivo(s) y creando horarios')

      // Use ALL employees from storage for robust matching
      const allEmployees = await storage.getEmployees()

      const isMultipleFiles = files.length > 1
      const silentMode = isMultipleFiles
      let importedCount = 0

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileContent = await file.text()
        const hasScheduleNameColumn = fileContent.toLowerCase().includes('nombrehorario')

        if (hasScheduleNameColumn) {
          // Multi-schedule CSV: may contain several schedules inside one file
          const importedSchedules = await importAllSchedulesFromCSV(file, allEmployees, silentMode)
          for (const imported of importedSchedules) {
            imported.branchCode = branchCode || '001'
            imported.division = division || 'super'
            // Duplicate handling: ask to replace if same period/context exists
            const all = await storage.getSchedules()
            const existing = all.find(s => s.startDate === imported.startDate && (s.branchCode || '001') === imported.branchCode && (s.division || 'super') === imported.division)
            if (existing) {
              const confirmed = await showConfirm(
                `Ya existe un horario para esta quincena en Sucursal ${imported.branchCode} / ${imported.division}. ¿Deseas reemplazarlo?`,
                'Horario existente',
                'Reemplazar',
                'Cancelar'
              )
              if (!confirmed) continue
              await storage.deleteSchedule(existing.id)
            }
            await storage.addSchedule(imported)
            importedCount++
          }
        } else {
          // Single schedule CSV
          const scheduleFromFile = await importFromCSV(file, null, allEmployees, silentMode)
          scheduleFromFile.branchCode = branchCode || '001'
          scheduleFromFile.division = division || 'super'
          // Duplicate handling: ask to replace if same period/context exists
          const all = await storage.getSchedules()
          const existing = all.find(s => s.startDate === scheduleFromFile.startDate && (s.branchCode || '001') === scheduleFromFile.branchCode && (s.division || 'super') === scheduleFromFile.division)
          if (existing) {
            const confirmed = await showConfirm(
              `Ya existe un horario para esta quincena en Sucursal ${scheduleFromFile.branchCode} / ${scheduleFromFile.division}. ¿Deseas reemplazarlo?`,
              'Horario existente',
              'Reemplazar',
              'Cancelar'
            )
            if (!confirmed) {
              continue
            }
            await storage.deleteSchedule(existing.id)
          }
          await storage.addSchedule(scheduleFromFile)
          importedCount++
        }
      }

      await loadSchedules()
      onUpdate()
      closeAlert()
      showSuccess(`${importedCount} horario(s) importado(s) correctamente.`, '¡Importación completada!')
    } catch (error) {
      console.error('[ScheduleManager] Error importing CSV:', error)
      closeAlert()
      showError('Error al importar CSV. Verifica el formato e intenta de nuevo.')
    } finally {
      if (csvFileInputRef.current) {
        csvFileInputRef.current.value = ''
      }
    }
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

      // If the deleted schedule was active, update selection
      if (activeScheduleId === id) {
        if (schedules.length > 0) {
          onScheduleSelect(schedules[0])
        } else {
          onScheduleSelect(null)
        }
      }

      onUpdate()
    }
  }

  const handleView = (schedule: Schedule) => {
    onScheduleSelect(schedule)
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
      onUpdate()
    }
  }

  const handleExportAll = async () => {
    try {
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `todos_los_horarios_${timestamp}.csv`
      exportAllSchedulesToCSV(schedules, employees, filename)
    } catch (error) {
      console.error('Error exporting all schedules:', error)
      showError('Error al exportar los horarios. Por favor, intenta de nuevo.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <Calendar className="h-6 w-6 text-primary-600" />
            <div className="text-left">
              <h2 className="text-xl font-bold text-gray-900">Gestión de Horarios</h2>
              <p className="text-sm text-gray-600">{schedules.length} horarios</p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </button>

        {isExpanded && (
          <div className="border-t p-6 space-y-6">
            <div className="flex items-center justify-between">
              {schedules.length > 0 ? (
                <div className="flex items-center space-x-3">
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
              ) : <div />}

              {!isCreating && (
                <button
                  onClick={() => {
                    if (leftClickBehavior === 'quick') {
                      handleQuickCreate()
                    } else {
                      handleCreate()
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setIsContextMenuOpen(true)
                    setContextMenuPos({ x: e.clientX, y: e.clientY })
                  }}
                  className="btn btn-primary flex items-center space-x-2"
                >
                  <Plus className="h-5 w-5" />
                  <span>Crear horario</span>
                </button>
              )}
            </div>

            {employees.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="text-yellow-600">⚠️</div>
                  <div>
                    <h3 className="font-medium text-yellow-800">No hay empleados</h3>
                    <p className="text-yellow-700">Debes agregar empleados antes de crear horarios.</p>
                  </div>
                </div>
              </div>
            )}

      {/* Formulario legacy eliminado en favor del diálogo unificado */}

      {/* Schedule List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schedules.map((schedule) => {
          return (
            <div
              key={schedule.id}
              onClick={() => handleView(schedule)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleView(schedule) }}
              role="button"
              tabIndex={0}
              className="card cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">{schedule.name}</h3>
                  <p className="text-sm text-gray-600">
                    {new Date(schedule.startDate).toLocaleDateString()} - {new Date(schedule.endDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleView(schedule) }}
                    className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                    title="Ver horario"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(schedule.id) }}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Eliminar horario"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-gray-500">
                  Creado: {new Date(schedule.createdAt).toLocaleDateString('es-ES')}
                </div>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); handleView(schedule) }}
                className="w-full mt-4 btn btn-secondary text-sm"
              >
                Ver y editar horario
              </button>
            </div>
          )
        })}
      </div>

            {schedules.length === 0 && !isCreating && (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aún no hay horarios</h3>
                <p className="text-gray-600 mb-6">Crea tu primer horario para empezar a organizar los turnos.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                  <div className="p-5 rounded-xl border-2 hover:shadow-md transition-all text-left">
                    <div className="text-sm font-semibold text-primary-700 mb-1">Crear desde cero</div>
                    <p className="text-sm text-gray-600 mb-3">Define turnos manualmente asignando empleados día por día.</p>
                    <button
                      onClick={() => {
                        if (leftClickBehavior === 'quick') {
                          handleQuickCreate()
                        } else {
                          handleCreate()
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setIsContextMenuOpen(true)
                        setContextMenuPos({ x: e.clientX, y: e.clientY })
                      }}
                      className="btn btn-primary w-full"
                      disabled={employees.length === 0}
                    >Comenzar</button>
                  </div>
                  <div className="p-5 rounded-xl border-2 hover:shadow-md transition-all text-left">
                    <div className="text-sm font-semibold text-gray-800 mb-1">Importar CSV</div>
                    <p className="text-sm text-gray-600 mb-3">¿Ya tienes un horario? Súbelo y edítalo fácilmente.</p>
                    <button
                      onClick={() => csvFileInputRef.current?.click()}
                      className="btn btn-secondary w-full"
                    >Importar</button>
                    <input
                      ref={csvFileInputRef}
                      type="file"
                      accept=".csv"
                      multiple
                      onChange={handleImportFromCSV}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {isContextMenuOpen && contextMenuPos && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-md shadow-lg w-56 py-1"
          style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
          role="menu"
          aria-label="Menú crear horario"
        >
          <div className="px-3 py-1 text-xs text-gray-500">Acciones</div>
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
            onClick={() => {
              setIsContextMenuOpen(false)
              handleCreate()
            }}
            role="menuitem"
          >
            Abrir formulario de creación
          </button>
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
            onClick={() => {
              setIsContextMenuOpen(false)
              handleQuickCreate()
            }}
            role="menuitem"
          >
            Crear rápido ahora
          </button>
          <div className="my-1 border-t border-gray-200" />
          <div className="px-3 py-1 text-xs text-gray-500">Preferencia de clic izquierdo</div>
          <button
            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${leftClickBehavior === 'form' ? 'font-semibold' : ''}`}
            onClick={() => {
              setLeftClickBehavior('form')
              setIsContextMenuOpen(false)
            }}
            role="menuitem"
            aria-checked={leftClickBehavior === 'form'}
          >
            {leftClickBehavior === 'form' ? '✓ ' : ''}Abrir formulario (predeterminado)
          </button>
          <button
            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${leftClickBehavior === 'quick' ? 'font-semibold' : ''}`}
            onClick={() => {
              setLeftClickBehavior('quick')
              setIsContextMenuOpen(false)
            }}
            role="menuitem"
            aria-checked={leftClickBehavior === 'quick'}
          >
            {leftClickBehavior === 'quick' ? '✓ ' : ''}Crear rápido
          </button>
        </div>
      )}
      {/* Unified Create Schedule Dialog */}
      {isUnifiedDialogOpen && (
        <CreateScheduleDialog
          isOpen={isUnifiedDialogOpen}
          onClose={() => setIsUnifiedDialogOpen(false)}
          branchCode={branchCode || '001'}
          division={division || 'super'}
          employees={employees}
          onCreated={async (s) => {
            await loadSchedules()
            onUpdate()
            onScheduleSelect(s)
            setIsUnifiedDialogOpen(false)
          }}
        />
      )}
    </div>
  )
}