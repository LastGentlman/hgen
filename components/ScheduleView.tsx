'use client'

import { useState, useRef } from 'react'
import { Employee, Schedule, Shift, ShiftStatus } from '@/types'
import { storage } from '@/lib/storage'
import { formatTime, calculateShiftDuration } from '@/lib/utils'
import { User, Clock, Download, FileText } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { showError, showLoading, closeAlert, showSuccess } from '@/lib/sweetalert'

interface ScheduleViewProps {
  schedule: Schedule | null
  employees: Employee[]
  schedules: Schedule[]
  onScheduleSelect: (schedule: Schedule) => void
  onUpdate: () => void
}

const STATUS_CONFIG = {
  assigned: { label: 'Asignado', bg: 'bg-white', text: 'text-gray-900', border: 'border-gray-300' },
  rest: { label: 'DESC', bg: 'bg-amber-700', text: 'text-white', border: 'border-amber-800' },
  vacation: { label: 'VAC', bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-700' },
  sick: { label: 'ENF', bg: 'bg-red-600', text: 'text-white', border: 'border-red-700' },
  absent: { label: 'AUS', bg: 'bg-orange-600', text: 'text-white', border: 'border-orange-700' },
  covering: { label: 'COB', bg: 'bg-orange-400', text: 'text-white', border: 'border-orange-500' },
  empty: { label: 'Vacío', bg: 'bg-gray-50', text: 'text-gray-400', border: 'border-gray-200' }
}

export default function ScheduleView({ schedule, employees, schedules, onScheduleSelect, onUpdate }: ScheduleViewProps) {
  const [selectedScheduleId, setSelectedScheduleId] = useState(schedule?.id || '')
  const scheduleRef = useRef<HTMLDivElement>(null)

  const employeeMap = new Map(employees.map(emp => [emp.id, emp]))

  const handleScheduleChange = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId)
    const selected = schedules.find(s => s.id === scheduleId)
    if (selected) {
      onScheduleSelect(selected)
    }
  }

  const handleAssignShift = async (dayIndex: number, shiftIndex: number, employeeId: string) => {
    if (!schedule) return

    const updatedSchedule = { ...schedule }
    const shift = updatedSchedule.days[dayIndex].shifts[shiftIndex]

    if (employeeId === '') {
      // Unassign
      shift.employeeId = undefined
      shift.isAssigned = false
      shift.status = 'empty'
    } else {
      shift.employeeId = employeeId
      shift.isAssigned = true
      shift.status = 'assigned'
    }

    await storage.updateSchedule(schedule.id, updatedSchedule)
    onUpdate()
  }

  const handleStatusChange = async (dayIndex: number, shiftIndex: number, status: ShiftStatus) => {
    if (!schedule) return

    const updatedSchedule = { ...schedule }
    const shift = updatedSchedule.days[dayIndex].shifts[shiftIndex]

    shift.status = status

    // A shift is assigned if it has an employee (regardless of status)
    // Rest, vacation, sick, etc. are still "assigned" to someone
    shift.isAssigned = !!shift.employeeId

    if (status === 'empty') {
      shift.employeeId = undefined
      shift.isAssigned = false
    }

    await storage.updateSchedule(schedule.id, updatedSchedule)
    onUpdate()
  }

  const getAvailableEmployees = (dayName: string, currentEmployeeId?: string) => {
    // Support both Spanish and English day names for backward compatibility
    const englishToSpanish: Record<string, string> = {
      'Monday': 'Lunes',
      'Tuesday': 'Martes',
      'Wednesday': 'Miércoles',
      'Thursday': 'Jueves',
      'Friday': 'Viernes',
      'Saturday': 'Sábado',
      'Sunday': 'Domingo',
    }
    const normalizedDay = englishToSpanish[dayName] || dayName
    return employees.filter(emp =>
      emp.availableDays.includes(normalizedDay) || emp.availableDays.includes(dayName) || emp.id === currentEmployeeId
    )
  }

  const exportToPDF = async () => {
    if (!schedule || !scheduleRef.current) return

    try {
      showLoading('Generando PDF...')
      const canvas = await html2canvas(scheduleRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const imgWidth = 210 // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= 297

      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= 297
      }

      pdf.save(`${schedule.name}.pdf`)
      closeAlert()
      showSuccess('PDF generado correctamente.')
    } catch (error) {
      console.error('Error generating PDF:', error)
      closeAlert()
      showError('Error al generar el PDF. Por favor intenta de nuevo.')
    }
  }

  if (!schedule) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Vista de horario</h2>

        {schedules.length === 0 ? (
          <div className="card text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay horarios disponibles</h3>
            <p className="text-gray-600">Crea un horario primero para verlo aquí.</p>
          </div>
        ) : (
          <div className="card">
            <h3 className="text-lg font-medium mb-4">Selecciona un horario</h3>
            <select
              value={selectedScheduleId}
              onChange={(e) => handleScheduleChange(e.target.value)}
              className="input"
            >
              <option value="">Elige un horario...</option>
              {schedules.map(sch => (
                <option key={sch.id} value={sch.id}>
                  {sch.name} ({new Date(sch.startDate).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    )
  }

  const totalShifts = schedule.days.reduce((sum, day) => sum + day.shifts.length, 0)
  const assignedShifts = schedule.days.reduce(
    (sum, day) => sum + day.shifts.filter(shift => shift.isAssigned).length,
    0
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{schedule.name}</h2>
          <p className="text-gray-600">
            {new Date(schedule.startDate).toLocaleDateString()} - {new Date(schedule.endDate).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right text-sm">
            <div className="font-medium">{assignedShifts}/{totalShifts} asignados</div>
            <div className="text-gray-500">
              {totalShifts > 0 ? Math.round((assignedShifts / totalShifts) * 100) : 0}% completo
            </div>
          </div>
          <button
            onClick={exportToPDF}
            className="btn btn-primary flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {schedules.length > 1 && (
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cambiar horario
          </label>
          <select
            value={schedule.id}
            onChange={(e) => handleScheduleChange(e.target.value)}
            className="input max-w-md"
          >
            {schedules.map(sch => (
              <option key={sch.id} value={sch.id}>
                {sch.name} ({new Date(sch.startDate).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Progress Bar */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Progreso de asignación</span>
          <span className="text-sm text-gray-600">{assignedShifts} de {totalShifts} turnos</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-primary-600 h-3 rounded-full transition-all"
            style={{ width: `${totalShifts > 0 ? (assignedShifts / totalShifts) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Schedule Grid */}
      <div ref={scheduleRef} className="space-y-4">
        {schedule.days.map((day, dayIndex) => (
          <div key={day.date} className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{day.dayName.toUpperCase()}</h3>
                <p className="text-sm text-gray-600">{new Date(day.date).toLocaleDateString()}</p>
              </div>
              <div className="text-sm text-gray-600">
                {day.shifts.filter(s => s.isAssigned).length}/{day.shifts.length} asignados
              </div>
            </div>

            {day.shifts.length === 0 ? (
              <p className="text-gray-500 italic">No hay turnos programados</p>
            ) : (
              <div className="space-y-3">
                {day.shifts.map((shift, shiftIndex) => {
                  const employee = shift.employeeId ? employeeMap.get(shift.employeeId) : null
                  const duration = calculateShiftDuration(shift.startTime, shift.endTime)
                  const availableEmployees = getAvailableEmployees(day.dayName, shift.employeeId)

                  // Default to 'empty' if status is missing (for old data)
                  const status = shift.status || (shift.isAssigned ? 'assigned' : 'empty')
                  const statusConfig = STATUS_CONFIG[status]

                  return (
                    <div
                      key={shift.id}
                      className={`p-4 rounded-lg border-2 transition-colors ${statusConfig.border} ${statusConfig.bg}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">
                              {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                            </span>
                            <span className="text-sm text-gray-500">({duration}h)</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          {employee ? (
                            <div className="flex items-center space-x-2">
                              <User className="h-4 w-4 text-green-600" />
                              <span className={`font-medium ${statusConfig.text}`}>{employee.name}</span>
                              {employee.department && (
                                <span className="text-sm text-gray-500">({employee.department})</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 font-medium">SIN ASIGNAR</span>
                          )}

                          <select
                            value={status}
                            onChange={(e) => handleStatusChange(dayIndex, shiftIndex, e.target.value as ShiftStatus)}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="assigned">Asignado</option>
                            <option value="rest">Descanso</option>
                            <option value="vacation">Vacaciones</option>
                            <option value="sick">Enfermo</option>
                            <option value="absent">Ausente</option>
                            <option value="covering">Cubriendo</option>
                            <option value="empty">Vacío</option>
                          </select>

                          <select
                            value={shift.employeeId || ''}
                            onChange={(e) => handleAssignShift(dayIndex, shiftIndex, e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="">Sin asignar</option>
                            {availableEmployees.map(emp => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name} {emp.department ? `(${emp.department})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {availableEmployees.length === 0 && (
                        <div className="mt-2 text-sm text-yellow-600">
                          ⚠️ No hay empleados disponibles para {day.dayName}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}