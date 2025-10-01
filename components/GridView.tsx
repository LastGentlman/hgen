'use client'

import { useState, useRef } from 'react'
import { Employee, Schedule, ShiftStatus, ShiftType } from '@/types'
import { storage } from '@/lib/storage'
import { formatTime } from '@/lib/utils'
import { Download, Grid3x3, Users, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

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

const SHIFT_LABELS = {
  morning: { label: 'TURNO 1 DE 07:00 A 15:00 HRS', time: '07:00-15:00' },
  afternoon: { label: 'TURNO 2 DE 15:00 A 23:00 HRS', time: '15:00-23:00' },
  night: { label: 'TURNO 3 DE 23:00 A 07:00 HRS', time: '23:00-07:00' }
}

const ItemTypes = {
  EMPLOYEE: 'employee'
}

// Draggable Employee Card Component
interface DraggableEmployeeProps {
  employee: Employee
  onAssignShift: (employeeId: string, shiftType: ShiftType) => void
}

function DraggableEmployee({ employee, onAssignShift }: DraggableEmployeeProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.EMPLOYEE,
    item: { employee },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging()
    })
  }), [employee])

  return (
    <div
      ref={drag as any}
      className="flex items-center justify-between bg-white p-3 rounded border border-yellow-200 cursor-move hover:border-yellow-400 transition-all"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="flex items-center space-x-2">
        <GripVertical className="h-4 w-4 text-gray-400" />
        <span className="font-medium">{employee.name}</span>
      </div>
      <select
        value={employee.assignedShift || 'unassigned'}
        onChange={(e) => onAssignShift(employee.id, e.target.value as ShiftType)}
        onClick={(e) => e.stopPropagation()}
        className="text-sm border border-gray-300 rounded px-2 py-1"
      >
        <option value="unassigned">Sin asignar</option>
        <option value="morning">Turno 1 (7-15)</option>
        <option value="afternoon">Turno 2 (15-23)</option>
        <option value="night">Turno 3 (23-7)</option>
      </select>
    </div>
  )
}

// Droppable Shift Header Component
interface ShiftDropZoneProps {
  shiftType: ShiftType
  shiftLabel: string
  employeeCount: number
  isExpanded: boolean
  onToggle: () => void
  onDrop: (employeeId: string, shiftType: ShiftType) => void
}

function ShiftDropZone({ shiftType, shiftLabel, employeeCount, isExpanded, onToggle, onDrop }: ShiftDropZoneProps) {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ItemTypes.EMPLOYEE,
    drop: (item: { employee: Employee }) => {
      onDrop(item.employee.id, shiftType)
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop()
    })
  }), [shiftType, onDrop])

  const backgroundColor = isOver && canDrop ? '#FDD835' : '#FFEB9C'
  const borderColor = isOver && canDrop ? '#F57F17' : '#000'

  return (
    <button
      ref={drop as any}
      onClick={onToggle}
      className="w-full flex items-center justify-between transition-all"
      style={{
        backgroundColor,
        padding: '12px',
        fontWeight: 'bold',
        border: `2px solid ${borderColor}`,
        boxShadow: isOver && canDrop ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
      }}
    >
      <span>{shiftLabel}</span>
      <div className="flex items-center space-x-2">
        {isOver && canDrop && <span className="text-sm text-green-700">⬇️ Soltar aquí</span>}
        <span className="text-sm">({employeeCount} empleados)</span>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </div>
    </button>
  )
}

export default function GridView({ schedule, employees, onUpdate }: GridViewProps) {
  const [companyName, setCompanyName] = useState('MI EMPRESA')
  const [isEditingCompany, setIsEditingCompany] = useState(false)
  const [expandedShifts, setExpandedShifts] = useState<{[key: string]: boolean}>({
    morning: true,
    afternoon: true,
    night: true
  })
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

  // Get shift time for a specific day
  const getShiftForDay = (dayIndex: number, shiftType: ShiftType): any => {
    const day = schedule.days[dayIndex]
    const shiftConfig = SHIFT_LABELS[shiftType as keyof typeof SHIFT_LABELS]
    if (!shiftConfig) return null

    const [startTime, endTime] = shiftConfig.time.split('-')
    return day.shifts.find(s => s.startTime === startTime && s.endTime === endTime)
  }

  const handleCellClick = (employeeId: string, dayIndex: number, shiftType: ShiftType) => {
    const shift = getShiftForDay(dayIndex, shiftType)
    if (!shift) return

    const updatedSchedule = { ...schedule }
    const shiftIndex = updatedSchedule.days[dayIndex].shifts.findIndex(s => s.id === shift.id)
    const targetShift = updatedSchedule.days[dayIndex].shifts[shiftIndex]

    // If clicking on a shift assigned to this employee, rotate status
    if (targetShift.employeeId === employeeId) {
      const currentStatus = targetShift.status || 'assigned'
      const currentStatusIndex = STATUS_ROTATION.indexOf(currentStatus)
      const nextStatus = STATUS_ROTATION[(currentStatusIndex + 1) % STATUS_ROTATION.length]

      targetShift.status = nextStatus
      targetShift.isAssigned = nextStatus === 'assigned'

      if (nextStatus === 'empty') {
        targetShift.employeeId = undefined
      }
    } else {
      // Assign this employee to the shift
      targetShift.employeeId = employeeId
      targetShift.status = 'assigned'
      targetShift.isAssigned = true
    }

    storage.updateSchedule(schedule.id, updatedSchedule)
    onUpdate()
  }

  const handleEmployeeShiftChange = (employeeId: string, shiftType: ShiftType) => {
    // Find the employee and update their shift
    const employee = employees.find(emp => emp.id === employeeId)
    if (!employee) return

    const updatedEmployee = { ...employee, assignedShift: shiftType }

    // Update only this employee in storage
    storage.updateEmployee(employeeId, updatedEmployee)

    // Trigger update in parent to refresh employee list
    onUpdate()
  }

  const getEmployeesByShift = (shiftType: ShiftType) => {
    return employees.filter(emp => emp.assignedShift === shiftType)
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

      const imgWidth = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
      pdf.save(`${schedule.name}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF. Please try again.')
    }
  }

  const toggleShift = (shiftType: string) => {
    setExpandedShifts(prev => ({ ...prev, [shiftType]: !prev[shiftType] }))
  }

  const renderShiftSection = (shiftType: ShiftType) => {
    const shiftLabel = SHIFT_LABELS[shiftType as keyof typeof SHIFT_LABELS]
    if (!shiftLabel) return null

    const employeesInShift = getEmployeesByShift(shiftType)
    const isExpanded = expandedShifts[shiftType]

    return (
      <div key={shiftType} className="mb-8">
        {/* Shift Header - Droppable */}
        <ShiftDropZone
          shiftType={shiftType}
          shiftLabel={shiftLabel.label}
          employeeCount={employeesInShift.length}
          isExpanded={isExpanded}
          onToggle={() => toggleShift(shiftType)}
          onDrop={handleEmployeeShiftChange}
        />

        {isExpanded && (
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
            <thead>
              <tr style={{ backgroundColor: '#E0E0E0' }}>
                <th style={{ border: '1px solid #000', padding: '8px', width: '150px' }}>NOMBRE</th>
                {schedule.days.map((day, idx) => (
                  <th key={idx} style={{ border: '1px solid #000', padding: '4px', fontSize: '11px' }}>
                    <div>{new Date(day.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                    <div style={{ fontSize: '10px' }}>{day.dayName.substring(0, 3).toUpperCase()}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employeesInShift.length === 0 ? (
                <tr>
                  <td colSpan={schedule.days.length + 1} style={{ border: '1px solid #000', padding: '20px', textAlign: 'center', color: '#999' }}>
                    No hay empleados asignados a este turno
                  </td>
                </tr>
              ) : (
                employeesInShift.map(employee => (
                  <tr key={employee.id}>
                    <td style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#FFEB9C', fontWeight: 'bold', textAlign: 'left' }}>
                      {employee.name}
                    </td>
                    {schedule.days.map((day, dayIndex) => {
                      const shift = getShiftForDay(dayIndex, shiftType)
                      const isAssignedToEmployee = shift?.employeeId === employee.id
                      const status: ShiftStatus = isAssignedToEmployee ? (shift.status || 'assigned') : 'empty'
                      const config = STATUS_CONFIG[status]

                      return (
                        <td
                          key={dayIndex}
                          onClick={() => handleCellClick(employee.id, dayIndex, shiftType)}
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
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  // Unassigned employees section - only show if there are employees AND schedule exists
  const unassignedEmployees = schedule && employees.length > 0
    ? employees.filter(emp => !emp.assignedShift || emp.assignedShift === 'unassigned')
    : []

  return (
    <DndProvider backend={HTML5Backend}>
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

        {/* Unassigned Employees - Draggable */}
        {schedule && unassignedEmployees.length > 0 && (
          <div className="card bg-yellow-50 border-yellow-200">
            <div className="flex items-start space-x-3">
              <Users className="h-5 w-5 text-yellow-600 mt-1" />
              <div className="flex-1">
                <h3 className="font-medium text-yellow-800 mb-2">
                  Empleados sin turno asignado ({unassignedEmployees.length})
                </h3>
                <p className="text-sm text-yellow-700 mb-3">
                  🖱️ Arrastra cada empleado a un turno o usa el dropdown
                </p>
                <div className="space-y-2">
                  {unassignedEmployees.map(emp => (
                    <DraggableEmployee
                      key={emp.id}
                      employee={emp}
                      onAssignShift={handleEmployeeShiftChange}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

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
              className="text-2xl font-bold text-white bg-transparent border-b-2 border-white text-center outline-none w-full"
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
            ROL DE TURNOS DEL {new Date(schedule.startDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })} AL {new Date(schedule.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}
          </h2>
        </div>

        {/* Shift Sections */}
        {renderShiftSection('morning')}
        {renderShiftSection('afternoon')}
        {renderShiftSection('night')}

        {/* Legend */}
        <div className="mt-6 pt-4 border-t">
          <h3 className="font-bold mb-3 text-center">LEYENDA</h3>
          <div className="flex flex-wrap gap-4 justify-center">
            {Object.entries(STATUS_CONFIG).filter(([key]) => key !== 'empty').map(([key, config]) => (
              <div key={key} className="flex items-center space-x-2">
                <div
                  style={{
                    width: '40px',
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
                <span className="text-sm font-medium">
                  {key === 'assigned' ? 'Trabajando' : key === 'rest' ? 'Descanso' : key === 'vacation' ? 'Vacaciones' : key === 'sick' ? 'Incapacidad' : 'Ausente'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </DndProvider>
  )
}
