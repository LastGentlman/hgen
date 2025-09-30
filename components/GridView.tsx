'use client'

import { useState, useRef } from 'react'
import { Employee, Schedule, ShiftStatus } from '@/types'
import { storage } from '@/lib/storage'
import { formatTime } from '@/lib/utils'
import { Download, Grid3x3 } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface GridViewProps {
  schedule: Schedule | null
  employees: Employee[]
  onUpdate: () => void
}

const STATUS_CONFIG = {
  assigned: { label: 'X', bg: '#FFFFFF', color: '#000000', border: '#000000' },
  rest: { label: 'DESC', bg: '#8B4513', color: '#FFFFFF', border: '#000000' },
  vacation: { label: 'VAC', bg: '#4169E1', color: '#FFFFFF', border: '#000000' },
  sick: { label: 'INC', bg: '#DC143C', color: '#FFFFFF', border: '#000000' },
  absent: { label: 'AUS', bg: '#FF8C00', color: '#FFFFFF', border: '#000000' },
  empty: { label: '', bg: '#FFFFFF', color: '#000000', border: '#CCCCCC' }
}

const STATUS_ROTATION: ShiftStatus[] = ['assigned', 'rest', 'vacation', 'sick', 'absent', 'empty']

export default function GridView({ schedule, employees, onUpdate }: GridViewProps) {
  const [companyName, setCompanyName] = useState('MI EMPRESA')
  const [isEditingCompany, setIsEditingCompany] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)

  if (!schedule) {
    return (
      <div className="card text-center py-12">
        <Grid3x3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No schedule selected</h3>
        <p className="text-gray-600">Select a schedule to view in grid mode.</p>
      </div>
    )
  }

  const handleCellClick = (dayIndex: number, shiftIndex: number, employeeId: string) => {
    const updatedSchedule = { ...schedule }
    const shift = updatedSchedule.days[dayIndex].shifts[shiftIndex]

    // Only rotate if this shift belongs to this employee
    if (shift.employeeId !== employeeId) return

    // Get current status and rotate to next
    const currentStatusIndex = STATUS_ROTATION.indexOf(shift.status)
    const nextStatus = STATUS_ROTATION[(currentStatusIndex + 1) % STATUS_ROTATION.length]

    shift.status = nextStatus

    // Update isAssigned based on status
    shift.isAssigned = nextStatus === 'assigned'

    // If status is empty, clear the employee
    if (nextStatus === 'empty') {
      shift.employeeId = undefined
      shift.isAssigned = false
    }

    storage.updateSchedule(schedule.id, updatedSchedule)
    onUpdate()
  }

  const handleEmployeeCellClick = (dayIndex: number, shiftIndex: number, employeeId: string) => {
    const updatedSchedule = { ...schedule }
    const shift = updatedSchedule.days[dayIndex].shifts[shiftIndex]

    // If shift is already assigned to this employee, rotate status
    if (shift.employeeId === employeeId) {
      handleCellClick(dayIndex, shiftIndex, employeeId)
    } else {
      // Assign this employee to the shift
      shift.employeeId = employeeId
      shift.status = 'assigned'
      shift.isAssigned = true

      storage.updateSchedule(schedule.id, updatedSchedule)
      onUpdate()
    }
  }

  const exportToPDF = async () => {
    if (!tableRef.current) return

    try {
      const canvas = await html2canvas(tableRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })

      const imgWidth = 297 // A4 landscape width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
      pdf.save(`${schedule.name}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF. Please try again.')
    }
  }

  // Group shifts by time (same start/end time = same shift slot)
  const shiftSlots = Array.from(
    new Set(
      schedule.days[0]?.shifts.map(s => `${s.startTime}-${s.endTime}`) || []
    )
  ).map(timeSlot => {
    const [startTime, endTime] = timeSlot.split('-')
    return { startTime, endTime }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Grid View</h2>
        <button
          onClick={exportToPDF}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Download className="h-4 w-4" />
          <span>Export PDF</span>
        </button>
      </div>

      <div ref={tableRef} className="bg-white p-6">
        {/* Company Header */}
        <div className="mb-4" style={{ backgroundColor: '#654321', padding: '20px', textAlign: 'center' }}>
          {isEditingCompany ? (
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onBlur={() => setIsEditingCompany(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingCompany(false)}
              className="text-2xl font-bold text-white bg-transparent border-b-2 border-white text-center outline-none"
              autoFocus
            />
          ) : (
            <h1
              onClick={() => setIsEditingCompany(true)}
              className="text-2xl font-bold text-white cursor-pointer hover:opacity-80"
            >
              {companyName}
            </h1>
          )}
          <h2 className="text-lg text-white mt-2">
            ROL DE TURNOS: {new Date(schedule.startDate).toLocaleDateString('es-ES')} - {new Date(schedule.endDate).toLocaleDateString('es-ES')}
          </h2>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ border: '2px solid #000' }}>
            {/* Date Headers */}
            <thead>
              <tr style={{ backgroundColor: '#E0E0E0' }}>
                <th style={{ border: '1px solid #000', padding: '8px', minWidth: '150px' }}>
                  EMPLEADO
                </th>
                {schedule.days.map((day) => (
                  <th
                    key={day.date}
                    colSpan={shiftSlots.length}
                    style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}
                  >
                    <div className="font-bold">{new Date(day.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                    <div className="text-xs mt-1">{day.dayName.substring(0, 3).toUpperCase()}</div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Shift Time Headers */}
              <tr style={{ backgroundColor: '#FFEB9C' }}>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>
                  TURNO
                </td>
                {schedule.days.map((day) => (
                  shiftSlots.map((slot, idx) => (
                    <td
                      key={`${day.date}-${idx}`}
                      style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontSize: '11px' }}
                    >
                      {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                    </td>
                  ))
                ))}
              </tr>

              {/* Employee Rows */}
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#FFEB9C', fontWeight: 'bold' }}>
                    {employee.name}
                  </td>
                  {schedule.days.map((day, dayIndex) => (
                    shiftSlots.map((slot, slotIndex) => {
                      const shift = day.shifts.find(
                        s => s.startTime === slot.startTime && s.endTime === slot.endTime
                      )

                      const isAssignedToEmployee = shift?.employeeId === employee.id
                      const status = isAssignedToEmployee ? shift.status : 'empty'
                      const config = STATUS_CONFIG[status]

                      return (
                        <td
                          key={`${day.date}-${slotIndex}`}
                          onClick={() => shift && handleEmployeeCellClick(dayIndex, day.shifts.indexOf(shift), employee.id)}
                          style={{
                            border: `1px solid ${config.border}`,
                            backgroundColor: config.bg,
                            color: config.color,
                            padding: '8px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            userSelect: 'none'
                          }}
                        >
                          {config.label}
                        </td>
                      )
                    })
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 justify-center">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <div key={key} className="flex items-center space-x-2">
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  backgroundColor: config.bg,
                  border: `1px solid ${config.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: config.color,
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}
              >
                {config.label}
              </div>
              <span className="text-sm capitalize">{key === 'assigned' ? 'Trabajando' : key === 'rest' ? 'Descanso' : key === 'vacation' ? 'Vacaciones' : key === 'sick' ? 'Incapacidad' : key === 'absent' ? 'Ausente' : 'Vacío'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
