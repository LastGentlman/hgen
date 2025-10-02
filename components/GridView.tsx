'use client'

import { useState, useRef, useEffect } from 'react'
import { Employee, Schedule, ShiftStatus, ShiftType, CoverageInfo, PositionType } from '@/types'
import { storage } from '@/lib/storage'
import { formatTime, generateWeeklySchedule, getDefaultShiftTemplates, parseLocalDate } from '@/lib/utils'
import { Download, Plus } from 'lucide-react'
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
  vacation: { label: 'VACACIONES', bg: '#000000', color: '#FFFFFF', border: '#000000' },
  sick: { label: 'ENF', bg: '#DC2626', color: '#FFFFFF', border: '#000000' },
  absent: { label: 'AUS', bg: '#EA580C', color: '#FFFFFF', border: '#000000' },
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
  EMPLOYEE_ROW: 'employee_row',
  VACATION_CELL: 'vacation_cell'
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

// Draggable Vacation Cell Component
interface DraggableVacationCellProps {
  employee: Employee
  dayIndex: number
  shiftType: ShiftType
  status: ShiftStatus
  config: { label: string; bg: string; color: string; border: string }
  onCellClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onVacationDrop: (targetDayIndex: number) => void
  onCellMouseDown: (e: React.MouseEvent) => void
  onCellMouseEnter: () => void
  colSpan?: number
  isSelected?: boolean
  isMultiSelected?: boolean
}

function DraggableVacationCell({ employee, dayIndex, shiftType, status, config, onCellClick, onContextMenu, onVacationDrop, onCellMouseDown, onCellMouseEnter, colSpan = 1, isSelected = false, isMultiSelected = false }: DraggableVacationCellProps) {
  // Make vacation cells draggable
  const [{ isDragging }, drag] = useDrag<
    { employeeId: string; shiftType: ShiftType; sourceDayIndex: number },
    unknown,
    { isDragging: boolean }
  >(() => ({
    type: ItemTypes.VACATION_CELL,
    item: { employeeId: employee.id, shiftType, sourceDayIndex: dayIndex },
    canDrag: status === 'vacation',
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging()
    })
  }), [employee.id, shiftType, dayIndex, status])

  // Make all cells of this employee droppable for vacation
  const [{ isOver, canDrop }, drop] = useDrop<
    { employeeId: string; shiftType: ShiftType; sourceDayIndex: number },
    unknown,
    { isOver: boolean; canDrop: boolean }
  >(() => ({
    accept: ItemTypes.VACATION_CELL,
    canDrop: (item: { employeeId: string; shiftType: ShiftType }) => {
      // Can only drop on same employee and same shift
      return item.employeeId === employee.id && item.shiftType === shiftType
    },
    drop: (item: { employeeId: string; shiftType: ShiftType; sourceDayIndex: number }) => {
      onVacationDrop(dayIndex)
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop()
    })
  }), [employee.id, shiftType, dayIndex])

  const cursor = status === 'covering' ? 'context-menu' : status === 'vacation' ? 'grab' : 'pointer'

  // Multi-selection has priority over drop highlighting
  let finalBackgroundColor = config.bg
  if (isMultiSelected) {
    finalBackgroundColor = '#BFDBFE' // Light blue for multi-selection
  } else if (isOver && canDrop) {
    finalBackgroundColor = '#555555'
  }

  const opacity = isDragging ? 0.5 : 1

  return (
    <td
      ref={(node) => {
        drag(node)
        drop(node)
      }}
      onClick={onCellClick}
      onContextMenu={onContextMenu}
      onMouseDown={onCellMouseDown}
      onMouseEnter={onCellMouseEnter}
      colSpan={colSpan}
      style={{
        border: `1px solid ${config.border}`,
        backgroundColor: finalBackgroundColor,
        color: isMultiSelected ? '#1E3A8A' : config.color, // Dark blue text for multi-selection
        padding: '8px',
        textAlign: 'center',
        cursor,
        fontWeight: 'bold',
        userSelect: 'none',
        opacity,
        outline: isSelected ? '3px solid #3B82F6' : isMultiSelected ? '2px solid #3B82F6' : 'none',
        outlineOffset: '-3px',
        position: 'relative',
        zIndex: isSelected ? 10 : isMultiSelected ? 5 : 1
      }}
    >
      {config.label}
    </td>
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
  onVacationDrop: (employeeId: string, dayIndex: number, shiftType: ShiftType) => void
  onCellMouseDown: (employeeId: string, dayIndex: number, shiftType: ShiftType, e: React.MouseEvent) => void
  onCellMouseEnter: (employeeId: string, dayIndex: number, shiftType: ShiftType) => void
  selectedCell: { employeeId: string; dayIndex: number; shiftType: ShiftType } | null
  selectedCells: Set<string>
  isCoveringRow?: boolean
  coveringDays?: number[]
}

function DraggableEmployeeRow({ employee, shiftType, schedule, employees, onCellClick, onContextMenu, onPositionChange, getShiftForDay, onVacationDrop, onCellMouseDown, onCellMouseEnter, selectedCell, selectedCells, isCoveringRow = false, coveringDays = [] }: DraggableEmployeeRowProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.EMPLOYEE_ROW,
    item: { employee, fromShift: shiftType },
    canDrag: !isCoveringRow, // Can't drag covering rows
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging()
    })
  }), [employee, shiftType, isCoveringRow])

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

  // Detect vacation blocks for cell merging
  const detectVacationBlocks = () => {
    const blocks: Array<{ startDay: number; length: number; dayIndices: number[] }> = []
    let currentBlock: { startDay: number; dayIndices: number[] } | null = null

    schedule.days.forEach((day, dayIndex) => {
      const shift = getShiftForDay(dayIndex, shiftType, employee.id)
      const status: ShiftStatus = shift?.status || 'assigned'

      if (status === 'vacation') {
        if (!currentBlock) {
          // Start new vacation block
          currentBlock = { startDay: dayIndex, dayIndices: [dayIndex] }
        } else {
          // Continue current block
          currentBlock.dayIndices.push(dayIndex)
        }
      } else {
        if (currentBlock) {
          // End current block
          blocks.push({
            startDay: currentBlock.startDay,
            length: currentBlock.dayIndices.length,
            dayIndices: currentBlock.dayIndices
          })
          currentBlock = null
        }
      }
    })

    // Don't forget last block if schedule ends with vacation
    if (currentBlock) {
      const typedBlock = currentBlock as { startDay: number; dayIndices: number[] }
      blocks.push({
        startDay: typedBlock.startDay,
        length: typedBlock.dayIndices.length,
        dayIndices: typedBlock.dayIndices
      })
    }

    return blocks
  }

  const vacationBlocks = detectVacationBlocks()
  const skipDays = new Set<number>() // Track which days are already rendered as part of merged cells

  // Mark days that are part of merged vacation blocks (except the first day)
  vacationBlocks.forEach(block => {
    for (let i = 1; i < block.length; i++) {
      skipDays.add(block.dayIndices[i])
    }
  })

  const renderCells = () => {
    const cells: JSX.Element[] = []

    schedule.days.forEach((day, dayIndex) => {
      if (isCoveringRow) {
        // For covering rows, show X in days being covered, black box in days not covering
        const isCoveringThisDay = coveringDays.includes(dayIndex)

        cells.push(
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
        return
      }

      // Skip days that are part of a merged vacation block (except first day)
      if (skipDays.has(dayIndex)) {
        return
      }

      // Check if this day is the start of a vacation block
      const vacationBlock = vacationBlocks.find(block => block.startDay === dayIndex)
      const shift = getShiftForDay(dayIndex, shiftType, employee.id)
      const status: ShiftStatus = shift?.status || 'assigned'

      if (vacationBlock) {
        // Render merged vacation cell
        const label = vacationBlock.length <= 2 ? 'VAC' : 'VACACIONES'
        const config = STATUS_CONFIG['vacation']

        const cellKey = `${employee.id}-${dayIndex}-${shiftType}`
        cells.push(
          <DraggableVacationCell
            key={dayIndex}
            employee={employee}
            dayIndex={dayIndex}
            shiftType={shiftType}
            status={status}
            config={{ ...config, label }}
            onCellClick={() => onCellClick(employee.id, dayIndex, shiftType)}
            onContextMenu={(e) => onContextMenu(e, employee.id, dayIndex, shiftType)}
            onVacationDrop={(targetDayIndex) => onVacationDrop(employee.id, targetDayIndex, shiftType)}
            onCellMouseDown={(e) => onCellMouseDown(employee.id, dayIndex, shiftType, e)}
            onCellMouseEnter={() => onCellMouseEnter(employee.id, dayIndex, shiftType)}
            colSpan={vacationBlock.length}
            isSelected={selectedCell?.employeeId === employee.id && selectedCell?.dayIndex === dayIndex && selectedCell?.shiftType === shiftType}
            isMultiSelected={selectedCells.has(cellKey)}
          />
        )
      } else {
        // Render normal cell
        const config = STATUS_CONFIG[status]

        const cellKey = `${employee.id}-${dayIndex}-${shiftType}`
        cells.push(
          <DraggableVacationCell
            key={dayIndex}
            employee={employee}
            dayIndex={dayIndex}
            shiftType={shiftType}
            status={status}
            config={config}
            onCellClick={() => onCellClick(employee.id, dayIndex, shiftType)}
            onContextMenu={(e) => onContextMenu(e, employee.id, dayIndex, shiftType)}
            onVacationDrop={(targetDayIndex) => onVacationDrop(employee.id, targetDayIndex, shiftType)}
            onCellMouseDown={(e) => onCellMouseDown(employee.id, dayIndex, shiftType, e)}
            onCellMouseEnter={() => onCellMouseEnter(employee.id, dayIndex, shiftType)}
            isSelected={selectedCell?.employeeId === employee.id && selectedCell?.dayIndex === dayIndex && selectedCell?.shiftType === shiftType}
            isMultiSelected={selectedCells.has(cellKey)}
          />
        )
      }
    })

    return cells
  }

  return (
    <tr ref={!isCoveringRow ? drag as any : null} style={{ opacity: isDragging ? 0.5 : 1 }}>
      <td style={{
        border: '1px solid #000',
        padding: '8px',
        backgroundColor: '#FFFFFF',
        textAlign: 'left',
        cursor: !isCoveringRow ? 'move' : 'default',
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
      {renderCells()}
    </tr>
  )
}

// Droppable Shift Row Container
interface ShiftRowContainerProps {
  shiftType: ShiftType
  children: React.ReactNode
  onDrop: (employeeId: string, targetShift: ShiftType) => void
}

function ShiftRowContainer({ shiftType, children, onDrop }: ShiftRowContainerProps) {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ItemTypes.EMPLOYEE_ROW,
    drop: (item: { employee: Employee, fromShift: ShiftType }) => {
      if (item.fromShift !== shiftType) {
        onDrop(item.employee.id, shiftType)
      }
    },
    canDrop: (item: { employee: Employee, fromShift: ShiftType }) => {
      return item.fromShift !== shiftType
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop()
    })
  }), [shiftType, onDrop])

  const backgroundColor = isOver && canDrop ? '#FFF9C4' : 'transparent'

  return (
    <tbody ref={drop as any} style={{ backgroundColor }}>
      {children}
    </tbody>
  )
}

export default function GridView({ schedule, employees, onUpdate }: GridViewProps) {
  const [companyName, setCompanyName] = useState('MI EMPRESA')
  const [isEditingCompany, setIsEditingCompany] = useState(false)
  const [coverageMenu, setCoverageMenu] = useState<{
    isOpen: boolean
    position: { x: number; y: number }
    shiftId: string
    employeeId: string
    dayIndex: number
    shiftType: ShiftType
    currentInfo: CoverageInfo | null
  } | null>(null)
  const [selectedCell, setSelectedCell] = useState<{
    employeeId: string
    dayIndex: number
    shiftType: ShiftType
  } | null>(null)

  // Multi-selection state for brush selection
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<{
    employeeId: string
    dayIndex: number
    shiftType: ShiftType
  } | null>(null)
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())

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

  // Hotkey handler for quick status assignment (single or multi-selection)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      const key = e.key.toLowerCase()

      // Handle Escape - clear all selections
      if (key === 'escape') {
        setSelectedCell(null)
        setSelectedCells(new Set())
        setSelectionStart(null)
        e.preventDefault()
        return
      }

      // Handle multi-selection
      if (selectedCells.size > 0) {
        let targetStatus: ShiftStatus | null = null

        switch (key) {
          case 'v':
            targetStatus = 'vacation'
            break
          case 'd':
            targetStatus = 'rest'
            break
          case 'c':
            targetStatus = 'covering'
            break
          case 'delete':
          case 'backspace':
            targetStatus = 'assigned'
            break
          default:
            return
        }

        if (targetStatus) {
          // Apply status to all selected cells
          selectedCells.forEach(cellKey => {
            const [employeeId, dayIndexStr, shiftType] = cellKey.split('-')
            const dayIndex = parseInt(dayIndexStr)
            applyStatus(targetStatus!, employeeId, dayIndex, shiftType as ShiftType)
          })
          // Clear selection after applying
          setSelectedCells(new Set())
          setSelectionStart(null)
          e.preventDefault()
        }
        return
      }

      // Handle single cell selection
      if (!selectedCell) return

      const { employeeId, dayIndex, shiftType } = selectedCell

      switch (key) {
        case 'v':
          applyStatus('vacation', employeeId, dayIndex, shiftType)
          break
        case 'd':
          applyStatus('rest', employeeId, dayIndex, shiftType)
          break
        case 'c':
          applyStatus('covering', employeeId, dayIndex, shiftType)
          break
        case 'delete':
        case 'backspace':
          applyStatus('assigned', employeeId, dayIndex, shiftType)
          break
        default:
          return
      }

      e.preventDefault()
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [selectedCell, selectedCells, schedule, employees])

  // Handle global mouseup to stop selection
  useEffect(() => {
    const handleMouseUp = () => {
      if (isSelecting) {
        setIsSelecting(false)
      }
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [isSelecting])

  // Get shift for a specific employee on a specific day and shift type
  const getShiftForDay = (dayIndex: number, shiftType: ShiftType, employeeId?: string): any => {
    if (!schedule) return null
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
    // Clear multi-selection and set single cell
    setSelectedCells(new Set())
    setSelectionStart(null)
    setSelectedCell({ employeeId, dayIndex, shiftType })
  }

  const handleCellMouseDown = (employeeId: string, dayIndex: number, shiftType: ShiftType, e: React.MouseEvent) => {
    // Prevent text selection
    e.preventDefault()

    // Start multi-selection
    setIsSelecting(true)
    setSelectionStart({ employeeId, dayIndex, shiftType })
    setSelectedCell(null) // Clear single selection

    // Initialize selection with this cell
    const cellKey = `${employeeId}-${dayIndex}-${shiftType}`
    setSelectedCells(new Set([cellKey]))
  }

  const handleCellMouseEnter = (employeeId: string, dayIndex: number, shiftType: ShiftType) => {
    if (!isSelecting || !selectionStart) return

    // Only select cells from the same employee and same shift
    if (employeeId !== selectionStart.employeeId || shiftType !== selectionStart.shiftType) return

    // Calculate range of days to select
    const minDay = Math.min(selectionStart.dayIndex, dayIndex)
    const maxDay = Math.max(selectionStart.dayIndex, dayIndex)

    const newSelection = new Set<string>()
    for (let i = minDay; i <= maxDay; i++) {
      const cellKey = `${employeeId}-${i}-${shiftType}`
      newSelection.add(cellKey)
    }

    setSelectedCells(newSelection)
  }

  // Apply status directly via hotkey (no rotation)
  const applyStatus = (targetStatus: ShiftStatus, employeeId: string, dayIndex: number, shiftType: ShiftType) => {
    if (!schedule) return

    const updatedSchedule = { ...schedule }
    const shiftConfig = SHIFT_LABELS[shiftType as keyof typeof SHIFT_LABELS]
    if (!shiftConfig) return

    const [startTime, endTime] = shiftConfig.time.split('-')

    // If applying vacation, use auto-merge logic
    let daysToUpdate: number[] = [dayIndex]

    // If clearing a vacation (setting to assigned), find and clear the entire vacation block
    if (targetStatus === 'assigned') {
      const currentShift = updatedSchedule.days[dayIndex].shifts.find(s =>
        s.startTime === startTime &&
        s.endTime === endTime &&
        s.employeeId === employeeId
      )

      if (currentShift?.status === 'vacation') {
        // Find all consecutive vacation days for this employee/shift
        const vacationDays: number[] = []

        // Scan backwards from dayIndex
        for (let i = dayIndex; i >= 0; i--) {
          const shift = updatedSchedule.days[i].shifts.find(s =>
            s.startTime === startTime &&
            s.endTime === endTime &&
            s.employeeId === employeeId &&
            s.status === 'vacation'
          )
          if (shift) {
            vacationDays.unshift(i)
          } else {
            break
          }
        }

        // Scan forward from dayIndex+1
        for (let i = dayIndex + 1; i < updatedSchedule.days.length; i++) {
          const shift = updatedSchedule.days[i].shifts.find(s =>
            s.startTime === startTime &&
            s.endTime === endTime &&
            s.employeeId === employeeId &&
            s.status === 'vacation'
          )
          if (shift) {
            vacationDays.push(i)
          } else {
            break
          }
        }

        daysToUpdate = vacationDays
      }
    } else if (targetStatus === 'vacation') {
      // Find all existing vacation days for this employee/shift
      const existingVacationDays: number[] = []
      updatedSchedule.days.forEach((day, di) => {
        const shift = day.shifts.find(s =>
          s.startTime === startTime &&
          s.endTime === endTime &&
          s.employeeId === employeeId &&
          s.status === 'vacation'
        )
        if (shift) {
          existingVacationDays.push(di)
        }
      })

      // Add the target day
      if (!existingVacationDays.includes(dayIndex)) {
        existingVacationDays.push(dayIndex)
      }

      // Fill intermediate days (only assigned/empty/rest)
      if (existingVacationDays.length > 0) {
        existingVacationDays.sort((a, b) => a - b)
        const minDay = existingVacationDays[0]
        const maxDay = existingVacationDays[existingVacationDays.length - 1]

        daysToUpdate = []
        for (let i = minDay; i <= maxDay; i++) {
          const dayShift = updatedSchedule.days[i].shifts.find(s =>
            s.startTime === startTime &&
            s.endTime === endTime &&
            s.employeeId === employeeId
          )

          const currentDayStatus = dayShift?.status || 'assigned'

          // Include if: assigned, empty, rest, or already vacation
          if (currentDayStatus === 'assigned' ||
              currentDayStatus === 'empty' ||
              currentDayStatus === 'rest' ||
              currentDayStatus === 'vacation') {
            daysToUpdate.push(i)
          } else {
            if (i <= dayIndex) {
              continue
            } else {
              break
            }
          }
        }
      }
    }

    // Apply status to days
    daysToUpdate.forEach(di => {
      const day = updatedSchedule.days[di]
      let shiftIndex = day.shifts.findIndex(s =>
        s.startTime === startTime &&
        s.endTime === endTime &&
        s.employeeId === employeeId
      )

      if (shiftIndex === -1) {
        const { generateId } = require('@/lib/utils')
        day.shifts.push({
          id: generateId(),
          startTime,
          endTime,
          date: day.date,
          employeeId,
          isAssigned: targetStatus === 'assigned',
          status: targetStatus
        })
        shiftIndex = day.shifts.length - 1
      }

      const targetShift = day.shifts[shiftIndex]
      targetShift.status = targetStatus
      targetShift.isAssigned = targetStatus === 'assigned'

      // If switching to 'covering', set default coverage
      if (targetStatus === 'covering' && !targetShift.coverageInfo) {
        targetShift.coverageInfo = { type: 'shift', target: 'night' }
      }

      // If switching away from 'covering', clear coverage info
      if (targetShift.status !== 'covering') {
        targetShift.coverageInfo = undefined
      }
    })

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
    if (!coverageMenu || !schedule) return

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
    if (!schedule) return
    // Find the employee and update their shift
    const employee = employees.find(emp => emp.id === employeeId)
    if (!employee) return

    const oldShiftType = employee.assignedShift

    // If employee had a previous shift assigned, move their individual shifts to the new shift type
    if (oldShiftType && oldShiftType !== 'unassigned' && oldShiftType !== newShiftType) {
      const updatedSchedule = { ...schedule }
      const { generateId } = require('@/lib/utils')

      // Determine available position for the new shift
      // Available positions pool - Turno 3 (night) does NOT have C1
      const availablePositions: PositionType[] = newShiftType === 'night'
        ? ['C2', 'C3']
        : ['C1', 'C2', 'C3']

      // Get current position of this employee
      const oldShift = getShiftForDay(0, oldShiftType, employeeId)
      const currentPosition = oldShift?.position

      // Get positions already used in the NEW shift by other employees
      const usedPositionsInNewShift = new Set<PositionType>()
      employees.forEach(emp => {
        if (emp.assignedShift === newShiftType && emp.id !== employeeId) {
          const empShift = getShiftForDay(0, newShiftType, emp.id)
          if (empShift?.position && empShift.position !== 'EXT') {
            usedPositionsInNewShift.add(empShift.position)
          }
        }
      })

      // Determine the position to assign
      let assignedPosition: PositionType

      // Try to keep current position if available in new shift
      if (currentPosition && currentPosition !== 'EXT' &&
          availablePositions.includes(currentPosition) &&
          !usedPositionsInNewShift.has(currentPosition)) {
        assignedPosition = currentPosition
      } else {
        // Find first available position
        const availablePos = availablePositions.find(p => !usedPositionsInNewShift.has(p))
        assignedPosition = availablePos || 'EXT'
      }

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
              coverageInfo,
              position: assignedPosition
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
    if (!schedule) return
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

  const handleVacationDrop = (employeeId: string, targetDayIndex: number, shiftType: ShiftType) => {
    if (!schedule) return

    const updatedSchedule = { ...schedule }
    const shiftConfig = SHIFT_LABELS[shiftType as keyof typeof SHIFT_LABELS]
    if (!shiftConfig) return
    const [startTime, endTime] = shiftConfig.time.split('-')

    // Find all existing vacation days for this employee/shift
    const existingVacationDays: number[] = []
    updatedSchedule.days.forEach((day, di) => {
      const shift = day.shifts.find(s =>
        s.startTime === startTime &&
        s.endTime === endTime &&
        s.employeeId === employeeId &&
        s.status === 'vacation'
      )
      if (shift) {
        existingVacationDays.push(di)
      }
    })

    // Add the target day
    if (!existingVacationDays.includes(targetDayIndex)) {
      existingVacationDays.push(targetDayIndex)
    }

    // Fill intermediate days BUT only if they're assigned/empty (don't overwrite rest, covering, etc.)
    existingVacationDays.sort((a, b) => a - b)
    const minDay = existingVacationDays[0]
    const maxDay = existingVacationDays[existingVacationDays.length - 1]

    const daysToUpdate: number[] = []
    for (let i = minDay; i <= maxDay; i++) {
      const dayShift = updatedSchedule.days[i].shifts.find(s =>
        s.startTime === startTime &&
        s.endTime === endTime &&
        s.employeeId === employeeId
      )

      const currentDayStatus = dayShift?.status || 'assigned'

      // Only include this day if it's assigned, empty, or already vacation
      if (currentDayStatus === 'assigned' || currentDayStatus === 'empty' || currentDayStatus === 'vacation') {
        daysToUpdate.push(i)
      } else {
        // If we hit a day with rest/covering/sick/absent, don't merge across it
        if (i <= targetDayIndex) {
          continue
        } else {
          break
        }
      }
    }

    // Apply vacation status to all days in the merged block
    daysToUpdate.forEach(di => {
      const day = updatedSchedule.days[di]
      let shiftIndex = day.shifts.findIndex(s =>
        s.employeeId === employeeId &&
        s.startTime === startTime &&
        s.endTime === endTime
      )

      if (shiftIndex === -1) {
        const { generateId } = require('@/lib/utils')
        day.shifts.push({
          id: generateId(),
          startTime,
          endTime,
          date: day.date,
          employeeId,
          isAssigned: false,
          status: 'vacation'
        })
      } else {
        day.shifts[shiftIndex].status = 'vacation'
        day.shifts[shiftIndex].isAssigned = false
      }
    })

    storage.updateSchedule(schedule.id, updatedSchedule)
    onUpdate()
  }

  const exportToPDF = async () => {
    if (!tableRef.current || !schedule) return

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
    if (!schedule) return []
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

  const handleCreateNextSchedule = () => {
    if (!schedule) return
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

    // Preserve organizational context
    newSchedule.branchCode = schedule.branchCode
    newSchedule.division = schedule.division

    storage.addSchedule(newSchedule)
    onUpdate()
    alert(`✅ Horario creado: ${scheduleName}`)
  }

  if (!schedule) {
    return (
      <div className="card text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No schedule selected</h3>
        <p className="text-gray-600">Select a schedule to view in grid mode.</p>
      </div>
    )
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
              onClick={exportToPDF}
              className="btn btn-primary flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Hotkeys moved to bottom legend */}

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
                    onVacationDrop={handleVacationDrop}
                    onCellMouseDown={handleCellMouseDown}
                    onCellMouseEnter={handleCellMouseEnter}
                    selectedCell={selectedCell}
                    selectedCells={selectedCells}
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
                    onVacationDrop={handleVacationDrop}
                    onCellMouseDown={handleCellMouseDown}
                    onCellMouseEnter={handleCellMouseEnter}
                    selectedCell={selectedCell}
                    selectedCells={selectedCells}
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
                    onVacationDrop={handleVacationDrop}
                    onCellMouseDown={handleCellMouseDown}
                    onCellMouseEnter={handleCellMouseEnter}
                    selectedCell={selectedCell}
                    selectedCells={selectedCells}
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
                    onVacationDrop={handleVacationDrop}
                    onCellMouseDown={handleCellMouseDown}
                    onCellMouseEnter={handleCellMouseEnter}
                    selectedCell={selectedCell}
                    selectedCells={selectedCells}
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
                    onVacationDrop={handleVacationDrop}
                    onCellMouseDown={handleCellMouseDown}
                    onCellMouseEnter={handleCellMouseEnter}
                    selectedCell={selectedCell}
                    selectedCells={selectedCells}
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
                    onVacationDrop={handleVacationDrop}
                    onCellMouseDown={handleCellMouseDown}
                    onCellMouseEnter={handleCellMouseEnter}
                    selectedCell={selectedCell}
                    selectedCells={selectedCells}
                    isCoveringRow={true}
                    coveringDays={coveringDays}
                  />
                ))}
              </>
            )}
          </ShiftRowContainer>
        </table>

        {/* Legend + Hotkeys (merged at bottom) */}
        <div className="mt-6 pt-4 border-t">
          <h3 className="font-bold mb-4 text-center">LEYENDA</h3>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Status legend (only used statuses) */}
            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
              {Object.entries(STATUS_CONFIG)
                .filter(([key]) => ['assigned', 'rest', 'vacation', 'covering'].includes(key))
                .map(([key, config]) => (
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
                      {key === 'vacation' ? 'VAC' : config.label}
                    </div>
                    <span className="text-sm font-medium">
                      {key === 'assigned'
                        ? 'Trabajando'
                        : key === 'rest'
                        ? 'Descanso'
                        : key === 'vacation'
                        ? 'Vacaciones'
                        : 'Cubriendo (click derecho)'}
                    </span>
                  </div>
                ))}
            </div>

            {/* Hotkeys */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Atajos de teclado</div>
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="bg-white px-2 py-1 rounded border border-gray-300">
                  <kbd className="font-mono font-bold">V</kbd> Vacaciones
                </span>
                <span className="bg-white px-2 py-1 rounded border border-gray-300">
                  <kbd className="font-mono font-bold">D</kbd> Descanso
                </span>
                <span className="bg-white px-2 py-1 rounded border border-gray-300">
                  <kbd className="font-mono font-bold">C</kbd> Cubriendo
                </span>
                <span className="bg-white px-2 py-1 rounded border border-gray-300">
                  <kbd className="font-mono font-bold">Del</kbd> Limpiar
                </span>
                <span className="bg-white px-2 py-1 rounded border border-gray-300">
                  <kbd className="font-mono font-bold">Esc</kbd> Deseleccionar
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </DndProvider>
  )
}
