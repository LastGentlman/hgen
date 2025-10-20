'use client'

import { useState, useEffect } from 'react'
import { Employee, Schedule, ShiftTemplate, BranchCode, Division } from '@/types'
import { storage } from '@/lib/storage'
import { generateWeeklySchedule, getDefaultShiftTemplates } from '@/lib/utils'
import { Plus, Calendar, Edit2, Trash2, Eye, ChevronDown, ChevronUp, Download, AlertTriangle } from 'lucide-react'
import { showLoading, closeAlert, showSuccess, showError } from '@/lib/sweetalert'
import { showDangerConfirm } from '@/lib/sweetalert'
import { exportAllSchedulesToCSV } from '@/lib/exportUtils'

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
  const [isCreating, setIsCreating] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    startDate: ''
  })
  const [useGemini, setUseGemini] = useState(false)
  const [geminiNotes, setGeminiNotes] = useState('')
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
    setIsCreating(true)
    const today = new Date()

    setFormData({
      name: `Horario de 15 días - ${today.toLocaleDateString('es-ES')}`,
      startDate: today.toISOString().split('T')[0]
    })
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.startDate) return

    try {
      showLoading('Creando horario...', useGemini ? 'Consultando Gemini AI para sugerir turnos…' : 'Generando turnos y guardando en tu dispositivo')
      let templates = getDefaultShiftTemplates()

      if (useGemini) {
        try {
          const resp = await fetch('/api/gemini/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instructions: geminiNotes?.trim() || undefined })
          })
          const data = await resp.json()
          if (data?.ok && Array.isArray(data?.data?.shiftTemplates) && data.data.shiftTemplates.length > 0) {
            templates = data.data.shiftTemplates
          }
        } catch (e) {
          console.warn('Gemini suggest failed, using defaults', e)
        }
      }
      const schedule = generateWeeklySchedule(formData.startDate, formData.name.trim(), templates)

      await storage.addSchedule(schedule)
      const schedules = await storage.getSchedules()
      setSchedules(schedules)
      setIsCreating(false)
      setFormData({ name: '', startDate: '' })
      onUpdate()
      closeAlert()
      showSuccess('El horario se creó correctamente.', '¡Horario creado!')
    } catch (error) {
      console.error(error)
      closeAlert()
      showError('No se pudo crear el horario. Intenta de nuevo.')
    }
  }

  const handleCancel = () => {
    setIsCreating(false)
    setFormData({ name: '', startDate: '' })
  }

  const handleQuickCreate = async () => {
    try {
      const today = new Date()
      const name = `Horario rápido - ${today.toLocaleDateString('es-ES')}`
      const startDate = today.toISOString().split('T')[0]
      showLoading('Creando horario...', 'Generando turnos y guardando en tu dispositivo')
      const templates = getDefaultShiftTemplates()
      const schedule = generateWeeklySchedule(startDate, name.trim(), templates)
      await storage.addSchedule(schedule)
      const schedules = await storage.getSchedules()
      setSchedules(schedules)
      setIsCreating(false)
      setFormData({ name: '', startDate: '' })
      onUpdate()
      closeAlert()
      showSuccess('El horario se creó correctamente.', '¡Horario creado!')
    } catch (error) {
      console.error(error)
      closeAlert()
      showError('No se pudo crear el horario. Intenta de nuevo.')
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
                disabled={isCreating}
              >
                <Plus className="h-5 w-5" />
                <span>Crear horario</span>
              </button>
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

      {/* Create Form */}
      {isCreating && (
        <div className="card">
          <h3 className="text-lg font-medium mb-4">Crear nuevo horario</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del horario *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="Ingresa el nombre del horario"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de inicio *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Plantilla de horario por defecto (ciclo de 15 días)</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Operación 24/7:</strong> 3 turnos por día, todos los días</p>
              <p><strong>Turno Mañana:</strong> 06:00 - 14:00</p>
              <p><strong>Turno Tarde:</strong> 14:00 - 22:00</p>
              <p><strong>Turno Noche:</strong> 22:00 - 06:00</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              El horario dura 15 días consecutivos. Puedes personalizar los turnos después de crear el horario.
            </p>
            <div className="mt-4 p-3 border rounded-md bg-white space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={useGemini}
                  onChange={(e) => setUseGemini(e.target.checked)}
                />
                <span className="text-sm text-gray-800">Usar Gemini AI para sugerir plantillas (opcional)</span>
              </label>
              {useGemini && (
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Instrucciones para Gemini (opcional)</label>
                  <textarea
                    className="input min-h-[80px]"
                    placeholder="Ej. Prefiere inicio de mañana 06:00, evita noches consecutivas, etc."
                    value={geminiNotes}
                    onChange={(e) => setGeminiNotes(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">Si no hay clave de Gemini configurada o falla la consulta, se usarán las plantillas por defecto.</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3 mt-6">
            <button
              onClick={handleSave}
              className="btn btn-primary"
              disabled={!formData.name.trim() || !formData.startDate}
            >
              Crear horario
            </button>
            <button onClick={handleCancel} className="btn btn-secondary">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Schedule List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schedules.map((schedule) => {
          const totalShifts = schedule.days.reduce((sum, day) => sum + day.shifts.length, 0)
          const assignedShifts = schedule.days.reduce(
            (sum, day) => sum + day.shifts.filter(shift => shift.isAssigned).length,
            0
          )

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
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Progreso:</span>
                  <span className="font-medium">
                    {assignedShifts}/{totalShifts} turnos asignados
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all"
                    style={{ width: `${totalShifts > 0 ? (assignedShifts / totalShifts) * 100 : 0}%` }}
                  />
                </div>

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
                      onClick={() => document.getElementById('global-import-csv-trigger')?.dispatchEvent(new Event('click', { bubbles: true }))}
                      className="btn btn-secondary w-full"
                    >Importar</button>
                  </div>
                  <div className="p-5 rounded-xl border-2 hover:shadow-md transition-all text-left">
                    <div className="text-sm font-semibold text-gray-800 mb-1">Usar plantilla</div>
                    <p className="text-sm text-gray-600 mb-3">Duplica un horario anterior y ajústalo.</p>
                    <button onClick={() => setIsExpanded(true)} className="btn w-full">Ver plantillas</button>
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
    </div>
  )
}