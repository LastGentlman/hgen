"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { BranchCode, Division, Employee, Schedule, Shift, ShiftStatus, ShiftType, PositionType } from '@/types'
import { storage } from '@/lib/storage'
import { generateWeeklySchedule, getDefaultShiftTemplates, getShiftTypeFromTime } from '@/lib/utils'
import { showLoading, closeAlert, showError, showSuccess, showConfirm } from '@/lib/sweetalert'
import { recordScheduleCreationMeta } from '@/lib/tracking'

interface CreateScheduleDialogProps {
  isOpen: boolean
  onClose: () => void
  branchCode: BranchCode
  division: Division
  employees: Employee[]
  onCreated?: (schedule: Schedule) => void
}

// Utility: Determine half-month period for a given date
function getQuincenaLabel(date: Date): '1ra Quincena' | '2da Quincena' {
  const day = date.getDate()
  return day <= 15 ? '1ra Quincena' : '2da Quincena'
}

function getPeriodStartFromDate(date: Date): Date {
  const y = date.getFullYear()
  const m = date.getMonth()
  const d = date.getDate()
  if (d <= 15) return new Date(y, m, 16)
  return new Date(y, m + 1, 1)
}

function formatAutoName(date: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' }
  const label = getQuincenaLabel(date)
  return `Horario ${date.toLocaleString('es-ES', opts)} - ${label}`
}

function datesEqualISO(a: Date, b: Date): boolean {
  return a.toISOString().split('T')[0] === b.toISOString().split('T')[0]
}

// Rotation mapping copied and generalized from GridView, adapted to default 07/15/23 times
function rotateShiftAndPosition(currentShift: ShiftType, currentPosition: PositionType): { shift: ShiftType; position: PositionType } {
  if (currentPosition === 'EXT') {
    const shiftRotation: Record<ShiftType, ShiftType> = {
      morning: 'afternoon',
      afternoon: 'night',
      night: 'morning',
      unassigned: 'unassigned'
    }
    return { shift: shiftRotation[currentShift], position: 'EXT' }
  }

  const rotation: Record<string, { shift: ShiftType; position: PositionType }> = {
    // Morning rotations
    'morning-C1': { shift: 'afternoon', position: 'C2' },
    'morning-C2': { shift: 'afternoon', position: 'C3' },
    'morning-C3': { shift: 'afternoon', position: 'C1' },
    // Afternoon rotations (to night: no C1, use C2/C3)
    'afternoon-C1': { shift: 'night', position: 'C2' },
    'afternoon-C2': { shift: 'night', position: 'C3' },
    'afternoon-C3': { shift: 'night', position: 'C2' },
    // Night rotations (from night: C2↔C3, then to morning)
    'night-C2': { shift: 'morning', position: 'C3' },
    'night-C3': { shift: 'morning', position: 'C1' }
  }
  const key = `${currentShift}-${currentPosition}`
  return rotation[key] || { shift: currentShift, position: currentPosition }
}

function advanceRestDay(dayName: string): string {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const currentIndex = days.indexOf(dayName)
  if (currentIndex === -1) return dayName
  const nextIndex = (currentIndex + 1) % days.length
  return days[nextIndex]
}

const DEFAULT_SHIFT_TIMES: Record<ShiftType, { start: string; end: string }> = {
  morning: { start: '07:00', end: '15:00' },
  afternoon: { start: '15:00', end: '23:00' },
  night: { start: '23:00', end: '07:00' },
  unassigned: { start: '', end: '' }
}

export default function CreateScheduleDialog({ isOpen, onClose, branchCode, division, employees, onCreated }: CreateScheduleDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [suggestedStart, setSuggestedStart] = useState<Date | null>(null)
  const [suggestedName, setSuggestedName] = useState<string>('')
  const [existingConflict, setExistingConflict] = useState<Schedule | null>(null)

  const hasEmployees = employees && employees.length > 0

  // Compute next available quincena and name on open
  useEffect(() => {
    if (!isOpen) return
    ;(async () => {
      const all = await storage.getSchedules()
      const context = all.filter(s => (s.branchCode || branchCode) === branchCode && (s.division || division) === division)

      // Start from the day after the latest schedule end, else from today
      let base = new Date()
      if (context.length > 0) {
        const latest = [...context].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0]
        const end = new Date(latest.endDate)
        end.setDate(end.getDate() + 1)
        base = end
      }

      // Find next available quincena (no schedule with same startDate in this context)
      let candidate = getPeriodStartFromDate(base)
      let attempts = 0
      while (attempts < 24) { // up to ~12 months
        const exists = context.some(s => s.startDate === candidate.toISOString().split('T')[0])
        if (!exists) break
        // If occupied, advance to the next period
        candidate = getPeriodStartFromDate(candidate)
        attempts++
      }

      // If still colliding (all occupied), mark first as conflict
      let conflict: Schedule | null = null
      if (context.some(s => s.startDate === candidate.toISOString().split('T')[0])) {
        conflict = context.find(s => s.startDate === candidate.toISOString().split('T')[0]) || null
      }

      setExistingConflict(conflict)
      setSuggestedStart(candidate)
      setSuggestedName(formatAutoName(candidate))
    })()
  }, [isOpen, branchCode, division])

  const summary = useMemo(() => {
    if (!suggestedStart) return ''
    const start = suggestedStart
    const end = (() => {
      const d = new Date(start)
      const day = d.getDate()
      if (day === 1) return new Date(d.getFullYear(), d.getMonth(), 15)
      return new Date(d.getFullYear(), d.getMonth() + 1, 0)
    })()
    const fmt = (d: Date) => d.toLocaleDateString('es-ES')
    return `${fmt(start)} → ${fmt(end)}`
  }, [suggestedStart])

  const handleCreate = async () => {
    if (!suggestedStart) return
    if (!hasEmployees) {
      await showError('Debes agregar empleados activos en esta sucursal/división antes de crear un horario.', 'No hay empleados')
      return
    }

    setIsSubmitting(true)
    try {
      showLoading('Creando horario...', 'Preparando quincena y generando turnos')

      const allSchedules = await storage.getSchedules()
      const startDateISO = suggestedStart.toISOString().split('T')[0]

      // Replacement path if a schedule already exists for this period/context
      const existing = allSchedules.find(s => s.startDate === startDateISO && (s.branchCode || branchCode) === branchCode && (s.division || division) === division)
      if (existing) {
        const confirmReplace = await showConfirm(
          'Ya existe un horario para esta quincena en esta sucursal/división. ¿Deseas reemplazarlo? Esta acción eliminará el horario existente y creará uno nuevo.',
          'Horario existente',
          'Reemplazar',
          'Cancelar'
        )
        if (!confirmReplace) {
          closeAlert()
          setIsSubmitting(false)
          return
        }
        await storage.deleteSchedule(existing.id)
      }

      // Determine previous schedule for rotation
      const contextSchedules = allSchedules
        .filter(s => (s.branchCode || branchCode) === branchCode && (s.division || division) === division)
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())

      const previousSchedule = contextSchedules[0] || null

      let newSchedule: Schedule | null = null
      let creationSource: 'rotation' | 'ai' | 'template' = 'template'

      if (previousSchedule) {
        // 1) Start with default template (07/15/23)
        const templates = getDefaultShiftTemplates()
        newSchedule = generateWeeklySchedule(startDateISO, suggestedName, templates)
        newSchedule.branchCode = branchCode
        newSchedule.division = division

        // 2) Clear generated empty shifts to build from rotation
        newSchedule.days.forEach(day => { day.shifts = [] })

        // 3) Collect rest days per employee from previous schedule
        const employeeRestDays = new Map<string, string[]>()
        previousSchedule.days.forEach(day => {
          day.shifts.forEach(shift => {
            if (shift.employeeId && shift.isAssigned && shift.status === 'rest') {
              if (!employeeRestDays.has(shift.employeeId)) employeeRestDays.set(shift.employeeId, [])
              const arr = employeeRestDays.get(shift.employeeId)!
              if (!arr.includes(day.dayName)) arr.push(day.dayName)
            }
          })
        })

        // 4) Advance rest days by one
        const newRestDays = new Map<string, string[]>()
        employeeRestDays.forEach((restDays, employeeId) => {
          newRestDays.set(employeeId, restDays.map(advanceRestDay))
        })

        // 5) Build rotated shifts per day
        newSchedule.days.forEach(newDay => {
          const prevDay = previousSchedule.days.find(d => d.dayName === newDay.dayName)
          if (!prevDay) return

          prevDay.shifts.forEach(prevShift => {
            if (!prevShift.employeeId || !prevShift.isAssigned) return

            // Fix: pass both start and end time to getShiftTypeFromTime
            const currentShiftType = getShiftTypeFromTime(prevShift.startTime, prevShift.endTime) || 'unassigned'
            const currentPosition = (prevShift.position || 'EXT') as PositionType

            const employeeNewRest = newRestDays.get(prevShift.employeeId) || []
            const isRestDay = employeeNewRest.includes(newDay.dayName)

            const { shift: rotatedShift, position: rotatedPosition } = rotateShiftAndPosition(currentShiftType, currentPosition)
            const time = DEFAULT_SHIFT_TIMES[rotatedShift]

            const newShift: Shift = {
              id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
              startTime: time.start,
              endTime: time.end,
              date: newDay.date,
              employeeId: prevShift.employeeId,
              isAssigned: true,
              position: rotatedPosition,
              status: isRestDay
                ? ('rest' as ShiftStatus)
                : (prevShift.status === 'rest' ? 'assigned' : (prevShift.status || 'assigned'))
            }

            if (prevShift.coverageInfo && !isRestDay) {
              newShift.coverageInfo = { ...prevShift.coverageInfo }
            }

            newDay.shifts.push(newShift)
          })
        })

        // 6) Update employees rotation counters
        const allEmployees = await storage.getEmployees()
        const updatedEmployees = allEmployees.map(emp => {
          const isInSchedule = newSchedule!.days.some(day => day.shifts.some(s => s.employeeId === emp.id))
          if (isInSchedule && emp.branchCode === branchCode && emp.division === division) {
            return { ...emp, shiftRotationCount: (emp.shiftRotationCount || 0) + 1 }
          }
          return emp
        })
        for (const emp of updatedEmployees) {
          const original = allEmployees.find(e => e.id === emp.id)
          if (original && emp.shiftRotationCount !== original.shiftRotationCount) {
            await storage.updateEmployee(emp.id, { shiftRotationCount: emp.shiftRotationCount })
          }
        }

        creationSource = 'rotation'
      } else {
        // No previous schedule → try AI fallback
        try {
          const resp = await fetch('/api/gemini/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startDate: startDateISO,
              name: suggestedName,
              branchCode,
              division,
            })
          })
          const data = await resp.json()
          if (data?.ok && data?.data?.schedule) {
            newSchedule = data.data.schedule as Schedule
            creationSource = 'ai'
          }
        } catch {}

        if (!newSchedule) {
          // Fallback to default template if AI fails
          const templates = getDefaultShiftTemplates()
          newSchedule = generateWeeklySchedule(startDateISO, suggestedName, templates)
          newSchedule.branchCode = branchCode
          newSchedule.division = division
          creationSource = 'template'
        }
      }

      // Ensure context set
      if (!newSchedule.branchCode) newSchedule.branchCode = branchCode
      if (!newSchedule.division) newSchedule.division = division

      await storage.addSchedule(newSchedule)

      // Record minimal creation metrics (best-effort)
      try {
        const totalShifts = newSchedule.days.reduce((acc, d) => acc + d.shifts.length, 0)
        const assignedShifts = newSchedule.days.reduce((acc, d) => acc + d.shifts.filter(s => s.isAssigned && s.employeeId).length, 0)
        await recordScheduleCreationMeta(newSchedule.id, creationSource, '07-15/15-23/23-07', totalShifts, assignedShifts)
      } catch {}

      closeAlert()
      await showSuccess('El horario se creó correctamente.', '¡Horario creado!')
      setIsSubmitting(false)
      onCreated?.(newSchedule)
      onClose()
    } catch (e) {
      console.error('[CreateScheduleDialog] Error creating schedule:', e)
      closeAlert()
      setIsSubmitting(false)
      await showError('No se pudo crear el horario. Intenta de nuevo.')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Crear nuevo horario</h3>

        <div className="space-y-3 text-sm text-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Sucursal</span>
            <span className="font-medium">{branchCode}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">División</span>
            <span className="font-medium capitalize">{division}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Periodo</span>
            <span className="font-medium">{summary || 'Calculando...'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Nombre</span>
            <span className="font-medium">{suggestedName || '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Turnos</span>
            <span className="font-medium">T1 07:00–15:00 • T2 15:00–23:00 • T3 23:00–07:00</span>
          </div>
          {!hasEmployees && (
            <div className="mt-2 p-3 rounded-md bg-yellow-50 text-yellow-800">
              Debes agregar empleados antes de crear un horario.
            </div>
          )}
          {existingConflict && (
            <div className="mt-2 p-3 rounded-md bg-orange-50 text-orange-800">
              Ya existe un horario para esta quincena en esta sucursal/división. Se te pedirá confirmación para reemplazarlo.
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            className="btn btn-secondary"
            onClick={() => { if (!isSubmitting) onClose() }}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={isSubmitting || !hasEmployees || !suggestedStart}
          >
            {isSubmitting ? 'Creando…' : 'Crear horario'}
          </button>
        </div>
      </div>
    </div>
  )
}
