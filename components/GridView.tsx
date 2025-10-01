'use client'

import { useState, useRef, useEffect } from 'react'
import { Employee, Schedule, ShiftStatus, ShiftType, CoverageInfo, PositionType } from '@/types'
import { storage } from '@/lib/storage'
import { formatTime, generateWeeklySchedule, getDefaultShiftTemplates, parseLocalDate } from '@/lib/utils'
import { Download, Edit2, Check, Plus } from 'lucide-react'
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
  covering: { label: 'CUBRE', bg: '#FFB366', color: '#000000', border: '#000000' },
  empty: { label: '', bg: '#FFFFFF', color: '#000000', border: '#CCCCCC' }
}

const STATUS_ROTATION: ShiftStatus[] = ['assigned', 'rest', 'vacation', 'covering']

const SHIFT_LABELS = {
  morning: { label: 'TURNO 1 DE 07:00 A 15:00 HRS', time: '07:00-15:00', shortLabel: 'T1' },
  afternoon: { label: 'TURNO 2 DE 15:00 A 23:00 HRS', time: '15:00-23:00', shortLabel: 'T2' },
  night: { label: 'TURNO 3 DE 23:00 A 07:00 HRS', time: '23:00-07:00', shortLabel: 'T3' }
}

const ItemTypes = {
  EMPLOYEE_ROW: 'employee_row'
}

// Coverage Menu Component
interface CoverageMenuProps {
  isOpen: boolean
  position: { x: number; y: number }
  currentInfo: CoverageInfo | null
  onSelect: (coverageInfo: CoverageInfo) => void
  onClose: () => void
}

function CoverageMenu({ isOpen, position, currentInfo, onSelect, onClose }: CoverageMenuProps) {
  const [branchName, setBranchName] = useState('')
  const [showBranchInput, setShowBranchInput] = useState(false)

  if (!isOpen) return null

  const handleShiftSelect = (shiftType: string) => {
    onSelect({ type: 'shift', target: shiftType })
    onClose()
  }

  const handleBranchSubmit = () => {
    if (branchName.trim()) {
      onSelect({ type: 'branch', target: branchName.trim() })
      setBranchName('')
      setShowBranchInput(false)
      onClose()
    }
  }

  return (
    <>
      {/* Backdrop to close menu */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Menu */}
      <div
        className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[200px]"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      >
        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
          ¿Qué está cubriendo?
        </div>

        <button
          onClick={() => handleShiftSelect('morning')}
          className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${
            currentInfo?.type === 'shift' && currentInfo?.target === 'morning' ? 'bg-primary-50 text-primary-700' : ''
          }`}
        >
          <span className="font-medium">Turno 1</span>
          <span className="text-sm text-gray-500 ml-2">(7:00 - 15:00)</span>
        </button>

        <button
          onClick={() => handleShiftSelect('afternoon')}
          className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${
            currentInfo?.type === 'shift' && currentInfo?.target === 'afternoon' ? 'bg-primary-50 text-primary-700' : ''
          }`}
        >
          <span className="font-medium">Turno 2</span>
          <span className="text-sm text-gray-500 ml-2">(15:00 - 23:00)</span>
        </button>

        <button
          onClick={() => handleShiftSelect('night')}
          className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${
            currentInfo?.type === 'shift' && currentInfo?.target === 'night' ? 'bg-primary-50 text-primary-700' : ''
          }`}
        >
          <span className="font-medium">Turno 3</span>
          <span className="text-sm text-gray-500 ml-2">(23:00 - 7:00)</span>
        </button>

        <div className="border-t border-gray-200 my-2" />

        {!showBranchInput ? (
          <button
            onClick={() => setShowBranchInput(true)}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors"
          >
            <span className="font-medium">Sucursal...</span>
          </button>
        ) : (
          <div className="px-4 py-2">
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBranchSubmit()}
              placeholder="Nombre de sucursal"
              className="input text-sm w-full"
              autoFocus
            />
            <div className="flex space-x-2 mt-2">
              <button
                onClick={handleBranchSubmit}
                disabled={!branchName.trim()}
                className="btn btn-primary text-xs py-1"
              >
                Guardar
              </button>
              <button
                onClick={() => {
                  setBranchName('')
                  setShowBranchInput(false)
                }}
                className="btn btn-secondary text-xs py-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// Draggable Employee Row Component
interface DraggableEmployeeRowProps {
  employee: Employee
  shiftType: ShiftType
  schedule: Schedule
  employees: Employee[]
  onCellClick: (employeeId: string, dayIndex: number, shiftType: ShiftType) => void
  onContextMenu: (e: React.MouseEvent, employeeId: string, dayIndex: number, shiftType: ShiftType) => void
  onPositionChange: (employeeId: string, position: PositionType) => void
  getShiftForDay: (dayIndex: number, shiftType: ShiftType, employeeId?: string) => any
  isEditMode: boolean
  isCoveringRow?: boolean
  coveringDays?: number[]
}

function DraggableEmployeeRow({ employee, shiftType, schedule, employees, onCellClick, onContextMenu, onPositionChange, getShiftForDay, isEditMode, isCoveringRow = false, coveringDays = [] }: DraggableEmployeeRowProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.EMPLOYEE_ROW,
    item: { employee, fromShift: shiftType },
    canDrag: isEditMode && !isCoveringRow, // Can't drag covering rows
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging()
    })
  }), [employee, shiftType, isEditMode, isCoveringRow])

  // Get the position from the first shift (all shifts for this employee in this schedule have the same position)
  const firstShift = getShiftForDay(0, shiftType, employee.id)
  // Default position: C2 for night shift (no C1), C1 for other shifts
  const defaultPosition: PositionType = shiftType === 'night' ? 'C2' : 'C1'
  const currentPosition: PositionType = firstShift?.position || defaultPosition

  // Available positions - Turno 3 (night) does NOT have C1
  const positions: PositionType[] = shiftType === 'night'
    ? ['C2', 'C3', 'EXT']
    : ['C1', 'C2', 'C3', 'EXT']

  // Get all positions currently used by other employees in the SAME SHIFT (excluding current employee and EXT)
  const usedPositions = employees
    .filter(emp => emp.id !== employee.id && emp.assignedShift === shiftType)
    .map(emp => {
      const empShift = getShiftForDay(0, shiftType, emp.id)
      return empShift?.position
    })
    .filter(pos => pos && pos !== 'EXT')

  return (
    <tr ref={(isEditMode && !isCoveringRow) ? drag as any : null} style={{ opacity: isDragging ? 0.5 : 1 }}>
      <td style={{
        border: '1px solid #000',
        padding: '8px',
        backgroundColor: isCoveringRow ? '#E8F5E9' : '#FFEB9C',
        textAlign: 'left',
        cursor: isEditMode && !isCoveringRow ? 'move' : 'default',
        fontStyle: isCoveringRow ? 'italic' : 'normal',
        fontWeight: 'bold',
        whiteSpace: 'nowrap'
      }}>
        {!isCoveringRow ? (
          <>
            {employee.name} -{' '}
            <select
              value={currentPosition}
              onChange={(e) => onPositionChange(employee.id, e.target.value as PositionType)}
              style={{
                padding: '0',
                fontSize: 'inherit',
                border: 'none',
                backgroundColor: 'transparent',
                fontWeight: 'inherit',
                fontFamily: 'inherit',
                cursor: 'pointer',
                outline: 'none',
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {positions.map(pos => (
                <option
                  key={pos}
                  value={pos}
                >
                  {pos}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            {employee.name} <span style={{ fontWeight: 'normal', fontSize: '11px', color: '#666' }}>(cubriendo)</span>
          </>
        )}
      </td>
      {schedule.days.map((day, dayIndex) => {
        if (isCoveringRow) {
          // For covering rows, show X in days being covered, black box in days not covering
          const isCoveringThisDay = coveringDays.includes(dayIndex)

          return (
            <td
              key={dayIndex}
              style={{
                border: '1px solid #000',
                backgroundColor: isCoveringThisDay ? '#FFFFFF' : '#000000',
                color: isCoveringThisDay ? '#000000' : '#000000',
                padding: '8px',
                textAlign: 'center',
                cursor: 'default',
                fontWeight: 'bold',
                userSelect: 'none'
              }}
            >
              {isCoveringThisDay && 'X'}
            </td>
          )
        }

        // Normal row logic (for employee's assigned shift)
        // Get the shift specific to this employee
        const shift = getShiftForDay(dayIndex, shiftType, employee.id)

        // Default status is 'assigned' (working) for employees in their assigned shift
        const status: ShiftStatus = shift?.status || 'assigned'
        const config = STATUS_CONFIG[status]

        let cursor: string = status === 'covering' ? 'context-menu' : 'pointer'

        return (
          <td
            key={dayIndex}
            onClick={() => onCellClick(employee.id, dayIndex, shiftType)}
            onContextMenu={(e) => onContextMenu(e, employee.id, dayIndex, shiftType)}
            style={{
              border: `1px solid ${config.border}`,
              backgroundColor: config.bg,
              color: config.color,
              padding: '8px',
              textAlign: 'center',
              cursor,
              fontWeight: 'bold',
              userSelect: 'none'
            }}
          >
            {config.label}
          </td>
        )
      })}
    </tr>
  )
}

// Droppable Shift Row Container
interface ShiftRowContainerProps {
  shiftType: ShiftType
  children: React.ReactNode
  onDrop: (employeeId: string, targetShift: ShiftType) => void
  isEditMode: boolean
}

function ShiftRowContainer({ shiftType, children, onDrop, isEditMode }: ShiftRowContainerProps) {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ItemTypes.EMPLOYEE_ROW,
    drop: (item: { employee: Employee, fromShift: ShiftType }) => {
      if (item.fromShift !== shiftType) {
        onDrop(item.employee.id, shiftType)
      }
    },
    canDrop: (item: { employee: Employee, fromShift: ShiftType }) => {
      return isEditMode && item.fromShift !== shiftType
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop()
    })
  }), [shiftType, onDrop, isEditMode])

  const backgroundColor = isOver && canDrop ? '#FFF9C4' : 'transparent'

  return (
    <tbody ref={isEditMode ? drop as any : null} style={{ backgroundColor }}>
      {children}
    </tbody>
  )
}

export default function GridView({ schedule, employees, onUpdate }: GridViewProps) {
  const [companyName, setCompanyName] = useState('MI EMPRESA')
  const [isEditingCompany, setIsEditingCompany] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [coverageMenu, setCoverageMenu] = useState<{
    isOpen: boolean
    position: { x: number; y: number }
    shiftId: string
    employeeId: string
    dayIndex: number
    shiftType: ShiftType
    currentInfo: CoverageInfo | null
  } | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  // Auto-assign shifts and ensure unique positions per shift type (not globally)
  useEffect(() => {
    if (!schedule || employees.length === 0) return

    let hasChanges = false
    const updatedSchedule = { ...schedule }

    // Process each shift type separately
    const shiftTypes: ShiftType[] = ['morning', 'afternoon', 'night']

    shiftTypes.forEach(shiftType => {
      // Get all employees assigned to this shift
      const employeesInShift = employees.filter(emp => emp.assignedShift === shiftType)
      if (employeesInShift.length === 0) return

      // Available positions pool - Turno 3 (night) does NOT have C1
      const availablePositions: PositionType[] = shiftType === 'night'
        ? ['C2', 'C3']
        : ['C1', 'C2', 'C3']

      const shiftConfig = SHIFT_LABELS[shiftType as keyof typeof SHIFT_LABELS]
      if (!shiftConfig) return

      const [startTime, endTime] = shiftConfig.time.split('-')

      // Map to track current positions and detect duplicates WITHIN THIS SHIFT
      const employeePositions = new Map<string, PositionType>()

      // First pass: collect current positions for employees in this shift
      employeesInShift.forEach(employee => {
        // Find this employee's shift in the first day to get their current position
        const firstDayShift = updatedSchedule.days[0]?.shifts.find(s =>
          s.startTime === startTime &&
          s.endTime === endTime &&
          s.employeeId === employee.id
        )

        if (firstDayShift?.position) {
          employeePositions.set(employee.id, firstDayShift.position)
        }
      })

      // Detect duplicates (excluding EXT) WITHIN THIS SHIFT
      const positionCounts = new Map<PositionType, number>()
      employeePositions.forEach(pos => {
        if (pos !== 'EXT') {
          positionCounts.set(pos, (positionCounts.get(pos) || 0) + 1)
        }
      })

      // Reassign positions if there are duplicates or unassigned employees
      const usedPositions = new Set<PositionType>()
      const needsReassignment: string[] = []

      employeesInShift.forEach(employee => {
        const currentPos = employeePositions.get(employee.id)

        if (!currentPos) {
          // No position assigned
          needsReassignment.push(employee.id)
        } else if (currentPos !== 'EXT' && (positionCounts.get(currentPos) || 0) > 1) {
          // Duplicate position (not EXT) - only reassign if this is not the first occurrence
          const isFirstWithPosition = Array.from(employeePositions.entries())
            .find(([id, pos]) => pos === currentPos)?.[0] === employee.id

          if (!isFirstWithPosition) {
            needsReassignment.push(employee.id)
          } else {
            usedPositions.add(currentPos)
          }
        } else if (currentPos !== 'EXT') {
          // Valid unique position, mark as used
          usedPositions.add(currentPos)
        }
      })

      // Assign positions to employees that need reassignment
      needsReassignment.forEach(employeeId => {
        let newPosition: PositionType

        // Find first available position in this shift
        const available = availablePositions.find(p => !usedPositions.has(p))

        if (available) {
          newPosition = available
          usedPositions.add(newPosition)
        } else {
          newPosition = 'EXT'
        }

        employeePositions.set(employeeId, newPosition)
        hasChanges = true
      })

      // Apply positions to all days for each employee in this shift
      employeesInShift.forEach(employee => {
        const position = employeePositions.get(employee.id) || 'EXT'

        updatedSchedule.days.forEach(day => {
          // Find or create shift for this employee
          let shiftIndex = day.shifts.findIndex(s =>
            s.startTime === startTime &&
            s.endTime === endTime &&
            s.employeeId === employee.id
          )

          if (shiftIndex === -1) {
            // Create new shift for this employee
            const { generateId } = require('@/lib/utils')
            day.shifts.push({
              id: generateId(),
              startTime,
              endTime,
              date: day.date,
              employeeId: employee.id,
              isAssigned: true,
              status: 'assigned',
              position
            })
            hasChanges = true
          } else {
            // Update existing shift
            const shift = day.shifts[shiftIndex]
            if (shift.position !== position) {
              shift.position = position
              hasChanges = true
            }
            if (!shift.employeeId) {
              shift.employeeId = employee.id
              shift.status = 'assigned'
              shift.isAssigned = true
              hasChanges = true
            }
          }
        })
      })
    })

    // Save changes if any were made
    if (hasChanges) {
      storage.updateSchedule(schedule.id, updatedSchedule)
      onUpdate()
    }
  }, [schedule?.id, employees.length]) // Run when schedule changes or employee count changes

  if (!schedule) {
    return (
      <div className="card text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No schedule selected</h3>
        <p className="text-gray-600">Select a schedule to view in grid mode.</p>
      </div>
    )
  }

  // Get shift for a specific employee on a specific day and shift type
  const getShiftForDay = (dayIndex: number, shiftType: ShiftType, employeeId?: string): any => {
    const day = schedule.days[dayIndex]
    const shiftConfig = SHIFT_LABELS[shiftType as keyof typeof SHIFT_LABELS]
    if (!shiftConfig) return null

    const [startTime, endTime] = shiftConfig.time.split('-')

    // If employeeId provided, find shift assigned to that employee
    if (employeeId) {
      return day.shifts.find(s =>
        s.startTime === startTime &&
        s.endTime === endTime &&
        s.employeeId === employeeId
      )
    }

    // Otherwise find any shift with that time (backwards compatibility)
    return day.shifts.find(s => s.startTime === startTime && s.endTime === endTime)
  }

  const handleCellClick = (employeeId: string, dayIndex: number, shiftType: ShiftType) => {
    const updatedSchedule = { ...schedule }
    const day = updatedSchedule.days[dayIndex]
    const shiftConfig = SHIFT_LABELS[shiftType as keyof typeof SHIFT_LABELS]
    if (!shiftConfig) return

    const [startTime, endTime] = shiftConfig.time.split('-')

    // Find the shift for this specific employee
    let shiftIndex = day.shifts.findIndex(s =>
      s.startTime === startTime &&
      s.endTime === endTime &&
      s.employeeId === employeeId
    )

    // If shift doesn't exist for this employee, create it
    if (shiftIndex === -1) {
      const { generateId } = require('@/lib/utils')
      const newShift = {
        id: generateId(),
        startTime,
        endTime,
        date: day.date,
        employeeId,
        isAssigned: true,
        status: 'assigned' as ShiftStatus
      }
      day.shifts.push(newShift)
      shiftIndex = day.shifts.length - 1
    }

    const targetShift = day.shifts[shiftIndex]

    // Rotate status for this employee's shift
    const currentStatus = targetShift.status || 'assigned'
    const currentStatusIndex = STATUS_ROTATION.indexOf(currentStatus)
    const nextStatus = STATUS_ROTATION[(currentStatusIndex + 1) % STATUS_ROTATION.length]

    targetShift.status = nextStatus
    targetShift.isAssigned = nextStatus === 'assigned'

    // If switching to 'covering' status, set default coverage to night shift
    if (nextStatus === 'covering' && !targetShift.coverageInfo) {
      targetShift.coverageInfo = { type: 'shift', target: 'night' }
    }

    // If switching away from 'covering', clear coverage info
    if (currentStatus === 'covering' && nextStatus !== 'covering') {
      targetShift.coverageInfo = undefined
    }

    storage.updateSchedule(schedule.id, updatedSchedule)
    onUpdate()
  }

  const handleContextMenu = (
    e: React.MouseEvent,
    employeeId: string,
    dayIndex: number,
    shiftType: ShiftType
  ) => {
    const shift = getShiftForDay(dayIndex, shiftType, employeeId)
    if (!shift || shift.status !== 'covering' || shift.employeeId !== employeeId) {
      return // Only show menu for 'covering' status
    }

    e.preventDefault() // Prevent browser context menu

    setCoverageMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      shiftId: shift.id,
      employeeId,
      dayIndex,
      shiftType,
      currentInfo: shift.coverageInfo || null
    })
  }

  const handleCoverageSelect = (coverageInfo: CoverageInfo) => {
    if (!coverageMenu) return

    const updatedSchedule = { ...schedule }
    const shift = getShiftForDay(coverageMenu.dayIndex, coverageMenu.shiftType, coverageMenu.employeeId)

    if (shift) {
      const shiftIndex = updatedSchedule.days[coverageMenu.dayIndex].shifts.findIndex(s => s.id === shift.id)
      if (shiftIndex !== -1) {
        updatedSchedule.days[coverageMenu.dayIndex].shifts[shiftIndex].coverageInfo = coverageInfo
      }
    }

    storage.updateSchedule(schedule.id, updatedSchedule)
    onUpdate()
  }

  const handleEmployeeShiftChange = (employeeId: string, newShiftType: ShiftType) => {
    // Find the employee and update their shift
    const employee = employees.find(emp => emp.id === employeeId)
    if (!employee) return

    const oldShiftType = employee.assignedShift

    // If employee had a previous shift assigned, move their individual shifts to the new shift type
    if (oldShiftType && oldShiftType !== 'unassigned' && oldShiftType !== newShiftType) {
      const updatedSchedule = { ...schedule }
      const { generateId } = require('@/lib/utils')

      // For each day in the schedule
      updatedSchedule.days.forEach((day, dayIndex) => {
        // Find the old shift for this specific employee
        const oldShift = getShiftForDay(dayIndex, oldShiftType, employeeId)

        if (oldShift) {
          // Get the status from the old shift
          const status = oldShift.status || 'assigned'
          const coverageInfo = oldShift.coverageInfo

          // Get the new shift config
          const newShiftConfig = SHIFT_LABELS[newShiftType as keyof typeof SHIFT_LABELS]
          if (newShiftConfig) {
            const [startTime, endTime] = newShiftConfig.time.split('-')

            // Create a new shift for this employee in the new shift type
            const newShift = {
              id: generateId(),
              startTime,
              endTime,
              date: day.date,
              employeeId,
              isAssigned: status === 'assigned',
              status,
              coverageInfo
            }
            day.shifts.push(newShift)
          }

          // Remove the old shift for this employee
          const oldShiftIndex = day.shifts.findIndex(s => s.id === oldShift.id)
          if (oldShiftIndex !== -1) {
            day.shifts.splice(oldShiftIndex, 1)
          }
        }
      })

      // Save the updated schedule
      storage.updateSchedule(schedule.id, updatedSchedule)
    }

    // Update the employee's assigned shift
    const updatedEmployee = { ...employee, assignedShift: newShiftType }
    storage.updateEmployee(employeeId, updatedEmployee)

    // Trigger update in parent to refresh employee list
    onUpdate()
  }

  const handlePositionChange = (employeeId: string, position: PositionType) => {
    // Find the employee to get their shift type
    const employee = employees.find(emp => emp.id === employeeId)
    if (!employee || !employee.assignedShift) return

    // Validate: Turno 3 (night) cannot have C1
    if (employee.assignedShift === 'night' && position === 'C1') {
      alert('El Turno 3 no puede tener el puesto C1.')
      onUpdate() // Force re-render to reset select
      return
    }

    const updatedSchedule = { ...schedule }

    // Get current position of this employee
    const currentEmployeeShift = getShiftForDay(0, employee.assignedShift as ShiftType, employeeId)
    const currentPosition = currentEmployeeShift?.position

    // If trying to assign a non-EXT position, check if it's already in use in the SAME SHIFT
    if (position !== 'EXT') {
      // Find employee who currently has this position in the SAME shift
      const employeeWithPosition = employees.find(emp => {
        if (emp.id === employeeId || emp.assignedShift !== employee.assignedShift) return false

        const empShift = getShiftForDay(0, employee.assignedShift as ShiftType, emp.id)
        return empShift?.position === position
      })

      // If position is in use, swap positions
      if (employeeWithPosition) {
        // Swap: give the other employee the current employee's position
        updatedSchedule.days.forEach((day) => {
          day.shifts.forEach((shift) => {
            if (shift.employeeId === employeeWithPosition.id) {
              shift.position = currentPosition || 'EXT'
            }
          })
        })
      }
    }

    // Update position for all shifts belonging to this employee
    updatedSchedule.days.forEach((day) => {
      day.shifts.forEach((shift) => {
        if (shift.employeeId === employeeId) {
          shift.position = position
        }
      })
    })

    storage.updateSchedule(schedule.id, updatedSchedule)
    onUpdate()
  }

  const exportToPDF = async () => {
    if (!tableRef.current) return

    // Temporarily disable edit mode for export
    const wasEditMode = isEditMode
    if (wasEditMode) setIsEditMode(false)

    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 100))

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
    } finally {
      // Restore edit mode
      if (wasEditMode) setIsEditMode(true)
    }
  }

  const getEmployeesByShift = (shiftType: ShiftType) => {
    return employees.filter(emp => emp.assignedShift === shiftType)
  }

  const getEmployeesByShiftSorted = (shiftType: ShiftType) => {
    const filteredEmployees = employees.filter(emp => emp.assignedShift === shiftType)

    // Define position priority order
    const positionOrder: Record<PositionType, number> = {
      'C1': 1,
      'C2': 2,
      'C3': 3,
      'EXT': 4
    }

    // Sort employees by their position
    return filteredEmployees.sort((a, b) => {
      // Helper to get position for an employee
      const getEmployeePosition = (employeeId: string): PositionType => {
        if (!schedule || schedule.days.length === 0) return 'EXT'

        const day = schedule.days[0]
        const shiftConfig = SHIFT_LABELS[shiftType as keyof typeof SHIFT_LABELS]
        if (!shiftConfig) return 'EXT'

        const [startTime, endTime] = shiftConfig.time.split('-')
        const shift = day.shifts.find(s =>
          s.startTime === startTime &&
          s.endTime === endTime &&
          s.employeeId === employeeId
        )

        return shift?.position || 'EXT'
      }

      const aPosition = getEmployeePosition(a.id)
      const bPosition = getEmployeePosition(b.id)

      return positionOrder[aPosition] - positionOrder[bPosition]
    })
  }

  // Get employees from OTHER shifts who are covering THIS shift
  const getEmployeesCoveringThisShift = (targetShiftType: ShiftType): Array<{ employee: Employee; coveringDays: number[] }> => {
    const coveringEmployees: Array<{ employee: Employee; coveringDays: number[] }> = []

    employees.forEach(employee => {
      // Skip if employee is assigned to this shift (they're not covering, they belong here)
      if (employee.assignedShift === targetShiftType) return

      const coveringDays: number[] = []

      // Check each day to see if this employee is covering the target shift
      schedule.days.forEach((day, dayIndex) => {
        // Get the shift for this specific employee in their assigned shift type
        const employeeShift = getShiftForDay(dayIndex, employee.assignedShift as ShiftType, employee.id)

        // Check if they're covering the target shift on this day
        if (
          employeeShift &&
          employeeShift.employeeId === employee.id &&
          employeeShift.status === 'covering' &&
          employeeShift.coverageInfo?.type === 'shift' &&
          employeeShift.coverageInfo.target === targetShiftType
        ) {
          coveringDays.push(dayIndex)
        }
      })

      if (coveringDays.length > 0) {
        coveringEmployees.push({ employee, coveringDays })
      }
    })

    return coveringEmployees
  }

  // Get all employees with assigned shifts
  const allAssignedEmployees = employees.filter(emp =>
    emp.assignedShift && emp.assignedShift !== 'unassigned'
  )

  const handleCreateNextSchedule = () => {
    const scheduleEnd = new Date(schedule.endDate)
    scheduleEnd.setHours(0, 0, 0, 0)

    // Calculate next schedule start date (day after current schedule ends)
    const nextStartDate = new Date(scheduleEnd)
    nextStartDate.setDate(nextStartDate.getDate() + 1)

    const nextDay = nextStartDate.getDate()
    let scheduleName: string

    if (nextDay === 1) {
      // Next schedule starts on 1st, so it's first half
      scheduleName = `Horario ${nextStartDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })} - 1ra Quincena`
    } else if (nextDay === 16) {
      // Next schedule starts on 16th, so it's second half
      scheduleName = `Horario ${nextStartDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })} - 2da Quincena`
    } else {
      // Shouldn't happen, but handle it
      alert('Error: No se puede crear el siguiente horario desde esta fecha.')
      return
    }

    // Check if this schedule already exists
    const existingSchedules = storage.getSchedules()
    const exists = existingSchedules.some(s => s.startDate === nextStartDate.toISOString().split('T')[0])

    if (exists) {
      alert('Este horario ya existe en el historial.')
      return
    }

    const templates = getDefaultShiftTemplates()
    const newSchedule = generateWeeklySchedule(
      nextStartDate.toISOString().split('T')[0],
      scheduleName,
      templates
    )

    storage.addSchedule(newSchedule)
    onUpdate()
    alert(`✅ Horario creado: ${scheduleName}`)
  }

  return (
    <DndProvider backend={HTML5Backend}>
      {/* Coverage Menu */}
      {coverageMenu && (
        <CoverageMenu
          isOpen={coverageMenu.isOpen}
          position={coverageMenu.position}
          currentInfo={coverageMenu.currentInfo}
          onSelect={handleCoverageSelect}
          onClose={() => setCoverageMenu(null)}
        />
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Grid View</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCreateNextSchedule}
              className="btn btn-secondary flex items-center space-x-2"
              title="Crear siguiente quincena"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo Horario</span>
            </button>
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`btn ${isEditMode ? 'btn-primary' : 'btn-secondary'} flex items-center space-x-2`}
            >
              {isEditMode ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Finalizar Edición</span>
                </>
              ) : (
                <>
                  <Edit2 className="h-4 w-4" />
                  <span>Editar</span>
                </>
              )}
            </button>
            <button
              onClick={exportToPDF}
              className="btn btn-primary flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {isEditMode && allAssignedEmployees.length > 0 && (
          <div className="card bg-blue-50 border-blue-200">
            <p className="text-sm text-blue-700">
              🖱️ <strong>Modo edición activado:</strong> Arrastra las filas de empleados entre turnos para reasignarlos
            </p>
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
            ROL DE TURNOS DEL {parseLocalDate(schedule.startDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })} AL {parseLocalDate(schedule.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}
          </h2>
        </div>

        {/* Unified Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000' }}>
          <thead>
            <tr style={{ backgroundColor: '#E0E0E0' }}>
              <th style={{ border: '1px solid #000', padding: '8px', width: '150px', fontWeight: 'bold' }}>Nombre</th>
              {schedule.days.map((day, idx) => (
                <th key={idx} style={{ border: '1px solid #000', padding: '4px', fontSize: '11px' }}>
                  <div>{parseLocalDate(day.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                  <div style={{ fontSize: '10px' }}>{day.dayName.substring(0, 3).toUpperCase()}</div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Morning Shift */}
          <ShiftRowContainer
            shiftType="morning"
            onDrop={handleEmployeeShiftChange}
            isEditMode={isEditMode}
          >
            <tr style={{ backgroundColor: '#FFEB9C' }}>
              <td colSpan={schedule.days.length + 1} style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', textAlign: 'center' }}>
                {SHIFT_LABELS.morning.label}
              </td>
            </tr>
            {getEmployeesByShiftSorted('morning').length === 0 ? (
              <tr>
                <td colSpan={schedule.days.length + 1} style={{ border: '1px solid #000', padding: '12px', textAlign: 'center', color: '#999' }}>
                  No hay empleados asignados a este turno
                </td>
              </tr>
            ) : (
              <>
                {getEmployeesByShiftSorted('morning').map(employee => (
                  <DraggableEmployeeRow
                    key={employee.id}
                    employee={employee}
                    shiftType="morning"
                    schedule={schedule}
                    employees={employees}
                    onCellClick={handleCellClick}
                    onContextMenu={handleContextMenu}
                    onPositionChange={handlePositionChange}
                    getShiftForDay={getShiftForDay}
                    isEditMode={isEditMode}
                  />
                ))}
                {/* Covering employees from other shifts */}
                {getEmployeesCoveringThisShift('morning').map(({ employee, coveringDays }) => (
                  <DraggableEmployeeRow
                    key={`covering-${employee.id}`}
                    employee={employee}
                    shiftType="morning"
                    schedule={schedule}
                    employees={employees}
                    onCellClick={handleCellClick}
                    onContextMenu={handleContextMenu}
                    onPositionChange={handlePositionChange}
                    getShiftForDay={getShiftForDay}
                    isEditMode={isEditMode}
                    isCoveringRow={true}
                    coveringDays={coveringDays}
                  />
                ))}
              </>
            )}
          </ShiftRowContainer>

          {/* Afternoon Shift */}
          <ShiftRowContainer
            shiftType="afternoon"
            onDrop={handleEmployeeShiftChange}
            isEditMode={isEditMode}
          >
            <tr style={{ backgroundColor: '#FFEB9C' }}>
              <td colSpan={schedule.days.length + 1} style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', textAlign: 'center' }}>
                {SHIFT_LABELS.afternoon.label}
              </td>
            </tr>
            {getEmployeesByShiftSorted('afternoon').length === 0 ? (
              <tr>
                <td colSpan={schedule.days.length + 1} style={{ border: '1px solid #000', padding: '12px', textAlign: 'center', color: '#999' }}>
                  No hay empleados asignados a este turno
                </td>
              </tr>
            ) : (
              <>
                {getEmployeesByShiftSorted('afternoon').map(employee => (
                  <DraggableEmployeeRow
                    key={employee.id}
                    employee={employee}
                    shiftType="afternoon"
                    schedule={schedule}
                    employees={employees}
                    onCellClick={handleCellClick}
                    onContextMenu={handleContextMenu}
                    onPositionChange={handlePositionChange}
                    getShiftForDay={getShiftForDay}
                    isEditMode={isEditMode}
                  />
                ))}
                {/* Covering employees from other shifts */}
                {getEmployeesCoveringThisShift('afternoon').map(({ employee, coveringDays }) => (
                  <DraggableEmployeeRow
                    key={`covering-${employee.id}`}
                    employee={employee}
                    shiftType="afternoon"
                    schedule={schedule}
                    employees={employees}
                    onCellClick={handleCellClick}
                    onContextMenu={handleContextMenu}
                    onPositionChange={handlePositionChange}
                    getShiftForDay={getShiftForDay}
                    isEditMode={isEditMode}
                    isCoveringRow={true}
                    coveringDays={coveringDays}
                  />
                ))}
              </>
            )}
          </ShiftRowContainer>

          {/* Night Shift */}
          <ShiftRowContainer
            shiftType="night"
            onDrop={handleEmployeeShiftChange}
            isEditMode={isEditMode}
          >
            <tr style={{ backgroundColor: '#FFEB9C' }}>
              <td colSpan={schedule.days.length + 1} style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', textAlign: 'center' }}>
                {SHIFT_LABELS.night.label}
              </td>
            </tr>
            {getEmployeesByShiftSorted('night').length === 0 ? (
              <tr>
                <td colSpan={schedule.days.length + 1} style={{ border: '1px solid #000', padding: '12px', textAlign: 'center', color: '#999' }}>
                  No hay empleados asignados a este turno
                </td>
              </tr>
            ) : (
              <>
                {getEmployeesByShiftSorted('night').map(employee => (
                  <DraggableEmployeeRow
                    key={employee.id}
                    employee={employee}
                    shiftType="night"
                    schedule={schedule}
                    employees={employees}
                    onCellClick={handleCellClick}
                    onContextMenu={handleContextMenu}
                    onPositionChange={handlePositionChange}
                    getShiftForDay={getShiftForDay}
                    isEditMode={isEditMode}
                  />
                ))}
                {/* Covering employees from other shifts */}
                {getEmployeesCoveringThisShift('night').map(({ employee, coveringDays }) => (
                  <DraggableEmployeeRow
                    key={`covering-${employee.id}`}
                    employee={employee}
                    shiftType="night"
                    schedule={schedule}
                    employees={employees}
                    onCellClick={handleCellClick}
                    onContextMenu={handleContextMenu}
                    onPositionChange={handlePositionChange}
                    getShiftForDay={getShiftForDay}
                    isEditMode={isEditMode}
                    isCoveringRow={true}
                    coveringDays={coveringDays}
                  />
                ))}
              </>
            )}
          </ShiftRowContainer>
        </table>

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
                  {key === 'assigned' ? 'Trabajando' : key === 'rest' ? 'Descanso' : key === 'vacation' ? 'Vacaciones' : key === 'covering' ? 'Cubriendo (click derecho)' : ''}
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
