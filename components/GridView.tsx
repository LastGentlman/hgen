'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Employee, Schedule, ShiftStatus, ShiftType, CoverageInfo, PositionType, BranchCode, Division } from '@/types'
import { storage } from '@/lib/storage'
import { formatTime, generateWeeklySchedule, getDefaultShiftTemplates, parseLocalDate, generateId } from '@/lib/utils'
import { exportToPDF, exportToCSV, importFromCSV, importAllSchedulesFromCSV } from '@/lib/exportUtils'
import { Download, Plus, Upload, Calendar, FileSpreadsheet, MoreVertical } from 'lucide-react'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { showError, showWarning, showSuccess, showWarningHtml } from '@/lib/sweetalert'

interface GridViewProps {
  schedule: Schedule | null
  employees: Employee[]
  onUpdate: () => void
  branchCode?: BranchCode
  division?: Division
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

// Helper function to get coverage tooltip
function getCoverageTooltip(coverageInfo?: CoverageInfo): string {
  if (!coverageInfo) return 'Cubriendo'

  const shiftLabels: Record<string, string> = {
    'morning': 'Turno 1 (7:00-15:00)',
    'afternoon': 'Turno 2 (15:00-23:00)',
    'night': 'Turno 3 (23:00-7:00)'
  }

  // New format: branch + shift
  if (coverageInfo.type === 'branch' && coverageInfo.targetBranch && coverageInfo.targetShift) {
    const shiftLabel = shiftLabels[coverageInfo.targetShift] || 'Turno ?'
    return `Cubriendo Sucursal ${coverageInfo.targetBranch} - ${shiftLabel}`
  }

  // New format: shift only
  if (coverageInfo.type === 'shift' && coverageInfo.targetShift) {
    return shiftLabels[coverageInfo.targetShift] ? `Cubriendo ${shiftLabels[coverageInfo.targetShift]}` : 'Cubriendo'
  }

  // Legacy format: backward compatibility - shift
  if (coverageInfo.type === 'shift' && coverageInfo.target) {
    return shiftLabels[coverageInfo.target] ? `Cubriendo ${shiftLabels[coverageInfo.target]}` : 'Cubriendo'
  }

  // Legacy format: backward compatibility - branch
  if (coverageInfo.type === 'branch' && coverageInfo.target) {
    return `Cubriendo Sucursal ${coverageInfo.target}`
  }

  return 'Cubriendo'
}

// Employee Context Menu Component
interface EmployeeContextMenuProps {
  isOpen: boolean
  position: { x: number; y: number }
  employeeId: string
  currentBranchCode: BranchCode | undefined
  onTransfer: (employeeId: string, targetBranch: BranchCode) => void
  onDelete: (employeeId: string) => void
  onClose: () => void
}

function EmployeeContextMenu({ isOpen, position, employeeId, currentBranchCode, onTransfer, onDelete, onClose }: EmployeeContextMenuProps) {
  if (!isOpen) return null

  const branches: BranchCode[] = ['001', '002', '003']
  const otherBranches = branches.filter(b => b !== currentBranchCode)

  return (
    <>
      {/* Backdrop to close menu */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999
        }}
      />

      {/* Context Menu */}
      <div
        style={{
          position: 'fixed',
          top: position.y,
          left: position.x,
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          zIndex: 1000,
          minWidth: '200px'
        }}
      >
        <div style={{ padding: '8px 0' }}>
          <div style={{ padding: '4px 16px', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>
            Transferir a:
          </div>
          {otherBranches.map(branch => (
            <button
              key={branch}
              onClick={() => {
                onTransfer(employeeId, branch)
                onClose()
              }}
              style={{
                width: '100%',
                padding: '8px 16px',
                border: 'none',
                backgroundColor: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Sucursal {branch}
            </button>
          ))}
          <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
          <button
            onClick={() => {
              onDelete(employeeId)
              onClose()
            }}
            style={{
              width: '100%',
              padding: '8px 16px',
              border: 'none',
              backgroundColor: 'transparent',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#DC2626'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#FEE2E2'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            🗑️ Eliminar empleado
          </button>
        </div>
      </div>
    </>
  )
}

// Confirm Delete Dialog Component
interface ConfirmDeleteDialogProps {
  isOpen: boolean
  employeeName: string
  onDeleteFromSchedule: () => void
  onDeleteEmployee: () => void
  onClose: () => void
}

function ConfirmDeleteDialog({ isOpen, employeeName, onDeleteFromSchedule, onDeleteEmployee, onClose }: ConfirmDeleteDialogProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Dialog */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            maxWidth: '400px',
            width: '90%',
            padding: '24px'
          }}
        >
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 'bold', color: '#111' }}>
            ¿Cómo deseas eliminar a {employeeName}?
          </h3>
          <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#666' }}>
            Elige una opción:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Delete from schedule only */}
            <button
              onClick={() => {
                onDeleteFromSchedule()
                onClose()
              }}
              style={{
                padding: '12px 16px',
                border: '1px solid #3B82F6',
                backgroundColor: '#3B82F6',
                color: 'white',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563EB'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3B82F6'}
            >
              📅 Solo de este horario
            </button>

            {/* Delete employee permanently */}
            <button
              onClick={() => {
                onDeleteEmployee()
                onClose()
              }}
              style={{
                padding: '12px 16px',
                border: '1px solid #DC2626',
                backgroundColor: '#DC2626',
                color: 'white',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#B91C1C'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#DC2626'}
            >
              🗑️ Como empleado (permanente)
            </button>

            {/* Cancel */}
            <button
              onClick={onClose}
              style={{
                padding: '12px 16px',
                border: '1px solid #D1D5DB',
                backgroundColor: 'white',
                color: '#374151',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// Coverage Menu Component
interface CoverageMenuProps {
  isOpen: boolean
  position: { x: number; y: number }
  currentInfo: CoverageInfo | null
  onSelect: (coverageInfo: CoverageInfo) => void
  onClose: () => void
  currentBranchCode?: BranchCode
  currentShiftType?: ShiftType
}

function CoverageMenu({ isOpen, position, currentInfo, onSelect, onClose, currentBranchCode, currentShiftType }: CoverageMenuProps) {
  const [selectedBranch, setSelectedBranch] = useState<BranchCode | null>(null)

  // Reset selected branch when menu closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedBranch(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleClose = () => {
    setSelectedBranch(null)
    onClose()
  }

  const handleShiftSelect = (shiftType: string) => {
    onSelect({ type: 'shift', targetShift: shiftType })
    onClose()
  }

  const handleBranchClick = (branchCode: BranchCode) => {
    // Show shift selection sub-menu for this branch
    setSelectedBranch(branchCode)
  }

  const handleBranchShiftSelect = (branchCode: BranchCode, shiftType: string) => {
    onSelect({ type: 'branch', targetBranch: branchCode, targetShift: shiftType })
    onClose()
  }

  const handleBack = () => {
    setSelectedBranch(null)
  }

  // Filter out current shift - can't cover your own shift in same branch
  // When covering another branch (type='branch'), you CAN cover same shift
  // Also filter out night shift (T3) for branch 002
  const shiftOptions = [
    { type: 'morning', label: 'Turno 1', time: '7:00 - 15:00' },
    { type: 'afternoon', label: 'Turno 2', time: '15:00 - 23:00' },
    { type: 'night', label: 'Turno 3', time: '23:00 - 7:00' }
  ].filter(shift => {
    // Can't cover your own shift in your own branch (type='shift' selection)
    if (shift.type === currentShiftType) return false
    if (shift.type === 'night' && currentBranchCode === '002') return false // Branch 002 doesn't have T3
    return true
  })

  // Get shift options for a specific branch (filter out T3 for branch 002)
  const getBranchShiftOptions = (branchCode: BranchCode) => {
    return [
      { type: 'morning', label: 'Turno 1', time: '7:00 - 15:00' },
      { type: 'afternoon', label: 'Turno 2', time: '15:00 - 23:00' },
      { type: 'night', label: 'Turno 3', time: '23:00 - 7:00' }
    ].filter(shift => {
      if (shift.type === 'night' && branchCode === '002') return false // Branch 002 doesn't have T3
      return true
    })
  }

  // Filter out current branch - can't cover your own branch
  const branchOptions: BranchCode[] = (['001', '002', '003'] as BranchCode[]).filter(
    branch => branch !== currentBranchCode
  )

  return (
    <>
      {/* Backdrop to close menu */}
      <div
        className="fixed inset-0 z-40"
        onClick={handleClose}
      />

      {/* Menu */}
      <div
        className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[200px]"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      >
        {!selectedBranch ? (
          <>
            {/* Main Menu */}
            {shiftOptions.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                  ¿Qué está cubriendo?
                </div>

                {shiftOptions.map(shift => (
                  <button
                    key={shift.type}
                    onClick={() => handleShiftSelect(shift.type)}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${
                      currentInfo?.type === 'shift' && currentInfo?.targetShift === shift.type ? 'bg-primary-50 text-primary-700' : ''
                    }`}
                  >
                    <span className="font-medium">{shift.label}</span>
                    <span className="text-sm text-gray-500 ml-2">({shift.time})</span>
                  </button>
                ))}
              </>
            )}

            {branchOptions.length > 0 && (
              <>
                <div className="border-t border-gray-200 my-2" />

                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                  Sucursales
                </div>

                {branchOptions.map(branch => (
                  <button
                    key={branch}
                    onClick={() => handleBranchClick(branch)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors flex items-center justify-between"
                  >
                    <span className="font-medium">Sucursal {branch}</span>
                    <span className="text-gray-400">›</span>
                  </button>
                ))}
              </>
            )}
          </>
        ) : (
          <>
            {/* Branch Shift Selection Sub-Menu */}
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase flex items-center">
              <button
                onClick={handleBack}
                className="mr-2 text-gray-400 hover:text-gray-600"
              >
                ‹
              </button>
              Sucursal {selectedBranch} - Turno
            </div>

            {getBranchShiftOptions(selectedBranch).map(shift => (
              <button
                key={shift.type}
                onClick={() => handleBranchShiftSelect(selectedBranch, shift.type)}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${
                  currentInfo?.type === 'branch' &&
                  currentInfo?.targetBranch === selectedBranch &&
                  currentInfo?.targetShift === shift.type ? 'bg-primary-50 text-primary-700' : ''
                }`}
              >
                <span className="font-medium">{shift.label}</span>
                <span className="text-sm text-gray-500 ml-2">({shift.time})</span>
              </button>
            ))}
          </>
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
  onCellClick: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  onVacationDrop: (targetDayIndex: number) => void
  onCellMouseDown: (e: React.MouseEvent) => void
  onCellMouseEnter: () => void
  colSpan?: number
  isSelected?: boolean
  isMultiSelected?: boolean
  coverageInfo?: CoverageInfo
}

function DraggableVacationCell({ employee, dayIndex, shiftType, status, config, onCellClick, onContextMenu, onVacationDrop, onCellMouseDown, onCellMouseEnter, colSpan = 1, isSelected = false, isMultiSelected = false, coverageInfo }: DraggableVacationCellProps) {
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

  // Get dynamic label and tooltip for covering status
  const tooltip = status === 'covering' ? getCoverageTooltip(coverageInfo) : undefined

  // Get discrete coverage info
  const getCoverageInfo = () => {
    if (status !== 'covering' || !coverageInfo) return null

    const shiftLabels: Record<string, string> = {
      'morning': 'T1',
      'afternoon': 'T2',
      'night': 'T3'
    }

    // New format: branch + shift
    if (coverageInfo.type === 'branch' && coverageInfo.targetBranch && coverageInfo.targetShift) {
      const shiftLabel = shiftLabels[coverageInfo.targetShift] || 'T?'
      return `${coverageInfo.targetBranch} ${shiftLabel}`
    }

    // New format: shift only
    if (coverageInfo.type === 'shift' && coverageInfo.targetShift) {
      return shiftLabels[coverageInfo.targetShift] || 'T?'
    }

    // Legacy format: backward compatibility - shift
    if (coverageInfo.type === 'shift' && coverageInfo.target) {
      return shiftLabels[coverageInfo.target] || 'T?'
    }

    // Legacy format: backward compatibility - branch
    if (coverageInfo.type === 'branch' && coverageInfo.target) {
      return coverageInfo.target
    }

    return null
  }

  const coverageInfoText = getCoverageInfo()

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
      title={tooltip}
      style={{
        border: `1px solid ${config.border}`,
        backgroundColor: finalBackgroundColor,
        color: isMultiSelected ? '#1E3A8A' : config.color, // Dark blue text for multi-selection
        padding: coverageInfoText ? '4px 8px' : '8px',
        textAlign: 'center',
        cursor,
        fontWeight: 'bold',
        userSelect: 'none',
        opacity,
        outline: isSelected ? '3px solid #3B82F6' : isMultiSelected ? '2px solid #3B82F6' : 'none',
        outlineOffset: '-3px',
        position: 'relative',
        zIndex: isSelected ? 10 : isMultiSelected ? 5 : 1,
        minHeight: '40px',
        verticalAlign: 'middle'
      }}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: '1.2'
      }}>
        <div>{config.label}</div>
        {coverageInfoText && (
          <div style={{
            fontSize: '9px',
            fontWeight: 'normal',
            color: '#666',
            marginTop: '0px',
            lineHeight: '1'
          }}>
            ({coverageInfoText})
          </div>
        )}
      </div>
    </td>
  )
}

// Draggable Employee Row Component
interface DraggableEmployeeRowProps {
  employee: Employee
  shiftType: ShiftType
  schedule: Schedule
  employees: Employee[]
  onCellClick: (employeeId: string, dayIndex: number, shiftType: ShiftType, e?: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent, employeeId: string, dayIndex: number, shiftType: ShiftType) => void
  onEmployeeContextMenu: (e: React.MouseEvent, employeeId: string) => void
  onPositionChange: (employeeId: string, position: PositionType) => void
  getShiftForDay: (dayIndex: number, shiftType: ShiftType, employeeId?: string) => any
  onVacationDrop: (employeeId: string, dayIndex: number, shiftType: ShiftType) => void
  onCellMouseDown: (employeeId: string, dayIndex: number, shiftType: ShiftType, e: React.MouseEvent) => void
  onCellMouseEnter: (employeeId: string, dayIndex: number, shiftType: ShiftType) => void
  selectedCell: { employeeId: string; dayIndex: number; shiftType: ShiftType } | null
  selectedCells: Set<string>
  isCoveringRow?: boolean
  coveringDays?: number[]
  branchCode?: BranchCode
}

function DraggableEmployeeRow({ employee, shiftType, schedule, employees, onCellClick, onContextMenu, onEmployeeContextMenu, onPositionChange, getShiftForDay, onVacationDrop, onCellMouseDown, onCellMouseEnter, selectedCell, selectedCells, isCoveringRow = false, coveringDays = [], branchCode }: DraggableEmployeeRowProps) {
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
            onCellClick={(e) => onCellClick(employee.id, dayIndex, shiftType, e)}
            onContextMenu={(e) => onContextMenu(e, employee.id, dayIndex, shiftType)}
            onVacationDrop={(targetDayIndex) => onVacationDrop(employee.id, targetDayIndex, shiftType)}
            onCellMouseDown={(e) => onCellMouseDown(employee.id, dayIndex, shiftType, e)}
            onCellMouseEnter={() => onCellMouseEnter(employee.id, dayIndex, shiftType)}
            colSpan={vacationBlock.length}
            isSelected={selectedCell?.employeeId === employee.id && selectedCell?.dayIndex === dayIndex && selectedCell?.shiftType === shiftType}
            isMultiSelected={selectedCells.has(cellKey)}
            coverageInfo={shift?.coverageInfo}
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
            onCellClick={(e) => onCellClick(employee.id, dayIndex, shiftType, e)}
            onContextMenu={(e) => onContextMenu(e, employee.id, dayIndex, shiftType)}
            onVacationDrop={(targetDayIndex) => onVacationDrop(employee.id, targetDayIndex, shiftType)}
            onCellMouseDown={(e) => onCellMouseDown(employee.id, dayIndex, shiftType, e)}
            onCellMouseEnter={() => onCellMouseEnter(employee.id, dayIndex, shiftType)}
            isSelected={selectedCell?.employeeId === employee.id && selectedCell?.dayIndex === dayIndex && selectedCell?.shiftType === shiftType}
            isMultiSelected={selectedCells.has(cellKey)}
            coverageInfo={shift?.coverageInfo}
          />
        )
      }
    })

    return cells
  }

  return (
    <tr ref={!isCoveringRow ? drag as any : null} style={{ opacity: isDragging ? 0.5 : 1 }}>
      <td
        style={{
          border: '1px solid #000',
          padding: '8px',
          backgroundColor: '#FFFFFF',
          textAlign: 'left',
          cursor: !isCoveringRow ? 'move' : 'default',
          fontStyle: isCoveringRow ? 'italic' : 'normal',
          fontWeight: 'bold',
          whiteSpace: 'nowrap'
        }}
        onContextMenu={!isCoveringRow ? (e) => onEmployeeContextMenu(e, employee.id) : undefined}
      >
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
            {employee.name} <span style={{ fontWeight: 'normal', fontSize: '11px', color: '#666' }}>
              (cubriendo{employee.branchCode && employee.branchCode !== branchCode ? ` desde ${employee.branchCode}` : ''})
            </span>
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

export default function GridView({ schedule, employees, onUpdate, branchCode, division }: GridViewProps) {
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
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false)
  const [employeeContextMenu, setEmployeeContextMenu] = useState<{
    isOpen: boolean
    position: { x: number; y: number }
    employeeId: string
  } | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean
    employeeId: string
    employeeName: string
  } | null>(null)
  const [hiddenEmployees, setHiddenEmployees] = useState<Set<string>>(new Set())

  const tableRef = useRef<HTMLDivElement>(null)
  const csvFileInputRef = useRef<HTMLInputElement>(null)
  const actionsMenuRef = useRef<HTMLDivElement>(null)

  // Helper function to determine shift type from time
  const getShiftTypeFromTime = (startTime: string, endTime: string): ShiftType | null => {
    const time = `${startTime}-${endTime}`
    if (time === '07:00-15:00') return 'morning'
    if (time === '15:00-23:00') return 'afternoon'
    if (time === '23:00-07:00') return 'night'
    return null
  }

  // Calculate assigned shift dynamically for each employee based on THIS schedule
  const getEmployeeAssignedShift = (employeeId: string): ShiftType => {
    if (!schedule) return 'unassigned'

    // Count shifts by type in THIS schedule
    const shiftCounts = { morning: 0, afternoon: 0, night: 0 }

    schedule.days.forEach(day => {
      day.shifts.forEach(shift => {
        if (shift.employeeId === employeeId && shift.status !== 'empty') {
          const shiftType = getShiftTypeFromTime(shift.startTime, shift.endTime)
          if (shiftType && shiftType !== 'unassigned') {
            shiftCounts[shiftType]++
          }
        }
      })
    })

    // The shift with most occurrences is the assigned shift
    const maxCount = Math.max(shiftCounts.morning, shiftCounts.afternoon, shiftCounts.night)
    if (maxCount === 0) return 'unassigned'

    if (shiftCounts.morning === maxCount) return 'morning'
    if (shiftCounts.afternoon === maxCount) return 'afternoon'
    return 'night'
  }

  // Calculate assignedShift dynamically for each employee based on THIS schedule
  // This allows for rotating schedules where an employee can be in different shifts in different schedules
  const employeesWithShifts = useMemo(() => {
    if (!schedule) return employees

    return employees.map(emp => ({
      ...emp,
      assignedShift: getEmployeeAssignedShift(emp.id)
    }))
  }, [employees, schedule])

  // Update the visible title based on selected division/branch (e.g., SUPER 001)
  useEffect(() => {
    const divisionLabel = (division || 'super').toUpperCase()
    const branchLabel = branchCode || '001'
    setCompanyName(`${divisionLabel} ${branchLabel}`)
  }, [branchCode, division])

  // Clear hidden employees when schedule changes
  useEffect(() => {
    setHiddenEmployees(new Set())
  }, [schedule?.id])

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setIsActionsMenuOpen(false)
      }
    }

    if (isActionsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isActionsMenuOpen])

  // Auto-assign shifts and ensure unique positions per shift type (not globally)
  useEffect(() => {
    const autoAssignShifts = async () => {
      if (!schedule || employees.length === 0) return

      let hasChanges = false
      const updatedSchedule = { ...schedule }

      // Process each shift type separately
      const shiftTypes: ShiftType[] = ['morning', 'afternoon', 'night']

      shiftTypes.forEach(shiftType => {
        // Get all employees assigned to this shift
        const employeesInShift = employeesWithShifts.filter(emp => emp.assignedShift === shiftType)
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
        await storage.updateSchedule(schedule.id, updatedSchedule)
        onUpdate()
      }
    }

    autoAssignShifts()
  }, [schedule?.id, employeesWithShifts.length]) // Run when schedule changes or employee count changes

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

  const handleCellClick = (employeeId: string, dayIndex: number, shiftType: ShiftType, e?: React.MouseEvent) => {
    const cellKey = `${employeeId}-${dayIndex}-${shiftType}`

    // Ctrl+Click: Toggle cell in multi-selection
    if (e?.ctrlKey) {
      const newSelection = new Set(selectedCells)
      if (newSelection.has(cellKey)) {
        newSelection.delete(cellKey)
      } else {
        newSelection.add(cellKey)
      }
      setSelectedCells(newSelection)
      setSelectedCell(null)
      setSelectionStart(null)
      return
    }

    // Regular click: Clear multi-selection and set single cell
    setSelectedCells(new Set())
    setSelectionStart(null)
    setSelectedCell({ employeeId, dayIndex, shiftType })
  }

  const handleCellMouseDown = (employeeId: string, dayIndex: number, shiftType: ShiftType, e: React.MouseEvent) => {
    // Prevent text selection
    e.preventDefault()

    // Don't start brush selection if Ctrl is pressed (Ctrl+Click handles its own selection)
    if (e.ctrlKey) return

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
  const applyStatus = async (targetStatus: ShiftStatus, employeeId: string, dayIndex: number, shiftType: ShiftType) => {
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

      // If switching to 'covering', set default coverage (new format)
      if (targetStatus === 'covering' && !targetShift.coverageInfo) {
        targetShift.coverageInfo = { type: 'shift', targetShift: 'night' }
      }

      // If switching away from 'covering', clear coverage info
      if (targetShift.status !== 'covering') {
        targetShift.coverageInfo = undefined
      }
    })

    await storage.updateSchedule(schedule.id, updatedSchedule)
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

    // Smart default: if T3 from 001 → default to 003 T3, if T3 from 003 → default to 001 T3
    let defaultInfo: CoverageInfo | null = null
    if (!shift.coverageInfo && shiftType === 'night') {
      if (branchCode === '001') {
        defaultInfo = { type: 'branch', targetBranch: '003', targetShift: 'night' }
      } else if (branchCode === '003') {
        defaultInfo = { type: 'branch', targetBranch: '001', targetShift: 'night' }
      }
    }

    setCoverageMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      shiftId: shift.id,
      employeeId,
      dayIndex,
      shiftType,
      currentInfo: shift.coverageInfo || defaultInfo
    })
  }

  const handleCoverageSelect = async (coverageInfo: CoverageInfo) => {
    if (!coverageMenu || !schedule) return

    const updatedSchedule = { ...schedule }
    const shift = getShiftForDay(coverageMenu.dayIndex, coverageMenu.shiftType, coverageMenu.employeeId)

    if (shift) {
      const shiftIndex = updatedSchedule.days[coverageMenu.dayIndex].shifts.findIndex(s => s.id === shift.id)
      if (shiftIndex !== -1) {
        updatedSchedule.days[coverageMenu.dayIndex].shifts[shiftIndex].coverageInfo = coverageInfo
      }
    }

    await storage.updateSchedule(schedule.id, updatedSchedule)
    onUpdate()
  }

  const handleEmployeeContextMenu = (e: React.MouseEvent, employeeId: string) => {
    e.preventDefault()
    setEmployeeContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      employeeId
    })
  }

  const handleEmployeeTransfer = async (employeeId: string, targetBranch: BranchCode) => {
    const employee = employees.find(emp => emp.id === employeeId)
    if (!employee) return

    // Update employee's branch
    await storage.updateEmployee(employeeId, { branchCode: targetBranch })
    onUpdate()
  }

  const handleEmployeeDeleteClick = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId)
    if (!employee) return

    // Open confirmation dialog
    setDeleteDialog({
      isOpen: true,
      employeeId,
      employeeName: employee.name
    })
  }

  const handleDeleteFromScheduleOnly = async (employeeId: string) => {
    if (!schedule) return

    // Remove all shifts assigned to this employee in THIS schedule only
    const updatedSchedule = { ...schedule }
    updatedSchedule.days.forEach(day => {
      day.shifts.forEach(shift => {
        if (shift.employeeId === employeeId) {
          shift.employeeId = undefined
          shift.isAssigned = false
          shift.status = 'empty'
          shift.coverageInfo = undefined
        }
      })
    })

    await storage.updateSchedule(schedule.id, updatedSchedule)

    // Hide employee from grid
    setHiddenEmployees(prev => new Set(prev).add(employeeId))

    onUpdate()
  }

  const handleDeleteEmployeePermanently = async (employeeId: string) => {
    if (!schedule) return

    // Remove employee from storage (permanently)
    await storage.deleteEmployee(employeeId)

    // Remove all shifts assigned to this employee in THIS schedule
    const updatedSchedule = { ...schedule }
    updatedSchedule.days.forEach(day => {
      day.shifts.forEach(shift => {
        if (shift.employeeId === employeeId) {
          shift.employeeId = undefined
          shift.isAssigned = false
          shift.status = 'empty'
          shift.coverageInfo = undefined
        }
      })
    })

    await storage.updateSchedule(schedule.id, updatedSchedule)
    onUpdate()
  }

  const handleEmployeeShiftChange = async (employeeId: string, newShiftType: ShiftType) => {
    if (!schedule) return
    // Find the employee and update their shift
    const employee = employeesWithShifts.find(emp => emp.id === employeeId)
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
      employeesWithShifts.forEach(emp => {
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
      await storage.updateSchedule(schedule.id, updatedSchedule)
    }

    // Trigger update in parent to refresh employee list
    onUpdate()
  }

  const handlePositionChange = async (employeeId: string, position: PositionType) => {
    if (!schedule) return
    // Find the employee to get their shift type
    const employee = employeesWithShifts.find(emp => emp.id === employeeId)
    if (!employee || !employee.assignedShift) return

    // Validate: Turno 3 (night) cannot have C1
    if (employee.assignedShift === 'night' && position === 'C1') {
      showWarning('El Turno 3 no puede tener el puesto C1.')
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
      const employeeWithPosition = employeesWithShifts.find(emp => {
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

    await storage.updateSchedule(schedule.id, updatedSchedule)
    onUpdate()
  }

  const handleVacationDrop = async (employeeId: string, targetDayIndex: number, shiftType: ShiftType) => {
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

    await storage.updateSchedule(schedule.id, updatedSchedule)
    onUpdate()
  }

  const handleExportToPDF = async () => {
    if (!tableRef.current || !schedule) return

    try {
      await exportToPDF(tableRef.current, `${schedule.name}.pdf`)
    } catch (error) {
      showError('Error al generar el PDF. Por favor intenta de nuevo.')
    }
  }

  const handleExportToCSV = () => {
    if (!schedule) return

    try {
      exportToCSV(schedule, employees, `${schedule.name}.csv`)
    } catch (error) {
      showError('Error al exportar CSV. Por favor intenta de nuevo.')
    }
  }

  const handleImportFromCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) {
      console.log('[handleImportFromCSV] ❌ No files selected')
      return
    }

    console.log('[handleImportFromCSV] 📂 Files selected:', files.length)

    try {
      // Use ALL employees from storage, not just filtered ones
      const allEmployees = await storage.getEmployees()
      console.log('[handleImportFromCSV] 👥 Available employees:', allEmployees.length)

      if (allEmployees.length === 0) {
        showWarning('No hay empleados registrados. Crea empleados primero antes de importar horarios.')
        return
      }

      const isMultipleFiles = files.length > 1
      const silentMode = isMultipleFiles // Silent mode when importing multiple files
      let successCount = 0
      let failCount = 0
      const errors: string[] = []
      const importedScheduleNames: string[] = []

      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        console.log(`[handleImportFromCSV] 📄 Processing file ${i + 1}/${files.length}:`, file.name)

        try {
          // Detect if CSV has multi-schedule format (NombreHorario column)
          const fileContent = await file.text()
          const hasScheduleNameColumn = fileContent.toLowerCase().includes('nombrehorario')

          if (hasScheduleNameColumn) {
            // Multi-schedule CSV detected - import all schedules
            console.log('[handleImportFromCSV] 📋 Multi-schedule CSV detected')
            const importedSchedules = await importAllSchedulesFromCSV(file, allEmployees, silentMode)

            console.log('[handleImportFromCSV] ✓ Multiple schedules imported:', importedSchedules.length)

            // Save all imported schedules
            for (const importedSchedule of importedSchedules) {
              // Tag with current organizational context
              importedSchedule.branchCode = branchCode || '001'
              importedSchedule.division = division || 'super'

              console.log('[handleImportFromCSV] 💾 Creating schedule:', importedSchedule.name)
              await storage.addSchedule(importedSchedule)

              const savedSchedule = (await storage.getSchedules()).find(s => s.id === importedSchedule.id)
              console.log('[handleImportFromCSV] ✓ Schedule saved:', savedSchedule ? 'YES' : 'NO')

              importedScheduleNames.push(importedSchedule.name)
            }

            successCount += importedSchedules.length
          } else {
            // Single-schedule CSV - use regular import
            console.log('[handleImportFromCSV] 📄 Single-schedule CSV detected')
            const targetSchedule = isMultipleFiles ? null : schedule
            const updatedSchedule = await importFromCSV(file, targetSchedule, allEmployees, silentMode)

            console.log('[handleImportFromCSV] ✓ Schedule imported:', {
              id: updatedSchedule.id,
              name: updatedSchedule.name,
              days: updatedSchedule.days.length,
              totalShifts: updatedSchedule.days.reduce((sum, day) => sum + day.shifts.length, 0)
            })

            // Validate schedule has data
            const totalShifts = updatedSchedule.days.reduce((sum, day) => sum + day.shifts.length, 0)
            if (totalShifts === 0) {
              throw new Error('El horario importado no contiene turnos válidos')
            }

            if (targetSchedule && !isMultipleFiles) {
              // Update existing schedule (single file mode only)
              console.log('[handleImportFromCSV] 💾 Updating existing schedule:', targetSchedule.id)
              await storage.updateSchedule(targetSchedule.id, updatedSchedule)

              const savedSchedule = (await storage.getSchedules()).find(s => s.id === targetSchedule.id)
              console.log('[handleImportFromCSV] ✓ Schedule updated in storage:', savedSchedule ? 'YES' : 'NO')
            } else {
              // Create new schedule from CSV
              // Tag with current organizational context
              updatedSchedule.branchCode = branchCode || '001'
              updatedSchedule.division = division || 'super'

              console.log('[handleImportFromCSV] 💾 Creating new schedule:', updatedSchedule.name)
              await storage.addSchedule(updatedSchedule)

              const allSchedules = await storage.getSchedules()
              const savedSchedule = allSchedules.find(s => s.id === updatedSchedule.id)
              console.log('[handleImportFromCSV] ✓ Schedule saved in storage:', savedSchedule ? 'YES' : 'NO')
            }

            successCount++
          }
        } catch (fileError: any) {
          console.error(`[handleImportFromCSV] ❌ Error processing ${file.name}:`, fileError)
          failCount++
          errors.push(`${file.name}: ${fileError.message || 'Error desconocido'}`)
        }
      }

      console.log('[handleImportFromCSV] 🔄 Triggering update...')
      onUpdate()
      console.log('[handleImportFromCSV] ✓ Import completed:', { successCount, failCount })

      // Show summary
      if (isMultipleFiles) {
        if (successCount > 0 && failCount === 0) {
          if (importedScheduleNames.length > 0) {
            const schedulesList = importedScheduleNames.map((name, i) => `<li>${name}</li>`).join('')
            showSuccess(`Se importaron ${successCount} horario${successCount > 1 ? 's' : ''} correctamente:<br><br><ul style="text-align: left; margin: 10px 0;">${schedulesList}</ul>`, '¡Importación exitosa!')
          } else {
            showSuccess(`Se importaron ${successCount} horario${successCount > 1 ? 's' : ''} correctamente.`, '¡Importación exitosa!')
          }
        } else if (successCount > 0 && failCount > 0) {
          const errorsList = errors.map(err => `<li>${err}</li>`).join('')
          showWarningHtml(`<p>✅ ${successCount} horario${successCount > 1 ? 's' : ''} importado${successCount > 1 ? 's' : ''}</p><p>❌ ${failCount} falló${failCount > 1 ? ' fallaron' : ''}</p><br><strong>Errores:</strong><ul style="text-align: left; margin: 10px 0;">${errorsList}</ul>`)
        } else {
          const errorsList = errors.map(err => `<li>${err}</li>`).join('')
          showWarningHtml(`Todos los archivos fallaron:<br><br><ul style="text-align: left; margin: 10px 0;">${errorsList}</ul>`, '❌ Error de importación')
        }
      } else {
        // Single file mode
        if (importedScheduleNames.length > 1) {
          // Multi-schedule CSV in single file mode
          const schedulesList = importedScheduleNames.map((name, i) => `<li>${name}</li>`).join('')
          showSuccess(`Se importaron ${importedScheduleNames.length} horarios:<br><br><ul style="text-align: left; margin: 10px 0;">${schedulesList}</ul>`, '¡Importación exitosa!')
        } else if (importedScheduleNames.length === 1) {
          // Single schedule from multi-schedule CSV
          showSuccess(`Horario importado: ${importedScheduleNames[0]}`, '¡Importación exitosa!')
        } else {
          // Regular single schedule CSV
          const totalShifts = (await storage.getSchedules()).find(s => s.branchCode === branchCode)?.days.reduce((sum, day) => sum + day.shifts.length, 0) || 0
          if (schedule) {
            showSuccess(`Horario actualizado desde CSV. ${totalShifts} turnos procesados.`, '¡Importación exitosa!')
          } else {
            showSuccess('Horario creado desde CSV.', '¡Importación exitosa!')
          }
        }
      }
    } catch (error: any) {
      console.error('[handleImportFromCSV] ❌ Error:', error)
      showError(`Error al importar CSV: ${error.message || 'Error desconocido'}. Revisa la consola para más detalles.`)
    }

    // Reset input
    if (csvFileInputRef.current) {
      csvFileInputRef.current.value = ''
    }
  }

  const getEmployeesByShift = (shiftType: ShiftType) => {
    return employeesWithShifts.filter(emp => emp.assignedShift === shiftType && !hiddenEmployees.has(emp.id))
  }

  const getEmployeesByShiftSorted = (shiftType: ShiftType) => {
    const filteredEmployees = employeesWithShifts.filter(emp => emp.assignedShift === shiftType && !hiddenEmployees.has(emp.id))

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

    employeesWithShifts.forEach(employee => {
      // Skip if employee is hidden or assigned to this shift (they're not covering, they belong here)
      if (hiddenEmployees.has(employee.id) || employee.assignedShift === targetShiftType) return

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
          employeeShift.coverageInfo
        ) {
          // New format: covering shift in same branch
          if (
            employeeShift.coverageInfo.type === 'shift' &&
            employeeShift.coverageInfo.targetShift === targetShiftType
          ) {
            coveringDays.push(dayIndex)
          }
          // New format: covering THIS branch + THIS shift from another branch
          else if (
            employeeShift.coverageInfo.type === 'branch' &&
            employeeShift.coverageInfo.targetBranch === branchCode &&
            employeeShift.coverageInfo.targetShift === targetShiftType
          ) {
            coveringDays.push(dayIndex)
          }
          // Legacy format: backward compatibility
          else if (
            employeeShift.coverageInfo.type === 'shift' &&
            employeeShift.coverageInfo.target === targetShiftType &&
            !employeeShift.coverageInfo.targetShift // Only if new format doesn't exist
          ) {
            coveringDays.push(dayIndex)
          }
        }
      })

      if (coveringDays.length > 0) {
        coveringEmployees.push({ employee, coveringDays })
      }
    })

    return coveringEmployees
  }

  const handleCreateNextSchedule = async () => {
    let startDate: Date
    let scheduleName: string
    let targetBranchCode: BranchCode
    let targetDivision: Division

    // Helper function to get next biweekly period
    const getNextPeriod = (currentDate: Date): { startDate: Date; scheduleName: string } => {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const day = currentDate.getDate()

      if (day === 1) {
        // Start of first half
        return {
          startDate: new Date(year, month, 1),
          scheduleName: `Horario ${new Date(year, month, 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' })} - 1ra Quincena`
        }
      } else if (day === 16) {
        // Start of second half
        return {
          startDate: new Date(year, month, 16),
          scheduleName: `Horario ${new Date(year, month, 16).toLocaleString('es-ES', { month: 'long', year: 'numeric' })} - 2da Quincena`
        }
      } else if (day <= 15) {
        // Between 2-15: advance to second half of same month
        return {
          startDate: new Date(year, month, 16),
          scheduleName: `Horario ${new Date(year, month, 16).toLocaleString('es-ES', { month: 'long', year: 'numeric' })} - 2da Quincena`
        }
      } else {
        // Between 17-31: advance to first half of next month
        const nextMonth = new Date(year, month + 1, 1)
        return {
          startDate: nextMonth,
          scheduleName: `Horario ${nextMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })} - 1ra Quincena`
        }
      }
    }

    // Helper function to advance to next period
    const advancePeriod = (currentStart: Date): { startDate: Date; scheduleName: string } => {
      const day = currentStart.getDate()
      const year = currentStart.getFullYear()
      const month = currentStart.getMonth()

      if (day === 1) {
        // From first half -> second half same month
        return {
          startDate: new Date(year, month, 16),
          scheduleName: `Horario ${new Date(year, month, 16).toLocaleString('es-ES', { month: 'long', year: 'numeric' })} - 2da Quincena`
        }
      } else {
        // From second half -> first half next month
        const nextMonth = new Date(year, month + 1, 1)
        return {
          startDate: nextMonth,
          scheduleName: `Horario ${nextMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' })} - 1ra Quincena`
        }
      }
    }

    if (!schedule) {
      // No schedule exists - create one for current period
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const currentDay = today.getDate()

      if (currentDay <= 15) {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        scheduleName = `Horario ${today.toLocaleString('es-ES', { month: 'long', year: 'numeric' })} - 1ra Quincena`
      } else {
        startDate = new Date(today.getFullYear(), today.getMonth(), 16)
        scheduleName = `Horario ${today.toLocaleString('es-ES', { month: 'long', year: 'numeric' })} - 2da Quincena`
      }

      targetBranchCode = branchCode || '001'
      targetDivision = division || 'super'
    } else {
      // Schedule exists - find next available period
      const scheduleEnd = new Date(schedule.endDate)
      scheduleEnd.setHours(0, 0, 0, 0)

      // Calculate next day after schedule ends
      const nextDate = new Date(scheduleEnd)
      nextDate.setDate(nextDate.getDate() + 1)

      // Get the logical next period
      const nextPeriod = getNextPeriod(nextDate)
      startDate = nextPeriod.startDate
      scheduleName = nextPeriod.scheduleName

      targetBranchCode = schedule.branchCode || branchCode || '001'
      targetDivision = schedule.division || division || 'super'
    }

    // Find next available period (skip if already exists)
    const existingSchedules = await storage.getSchedules()
    let attempts = 0
    const maxAttempts = 24 // 12 months = 24 biweekly periods

    while (attempts < maxAttempts) {
      const exists = existingSchedules.some(s =>
        s.startDate === startDate.toISOString().split('T')[0] &&
        s.branchCode === targetBranchCode &&
        s.division === targetDivision
      )

      if (!exists) {
        // Found available period, create schedule
        break
      }

      // Period already exists, advance to next period
      const nextPeriod = advancePeriod(startDate)
      startDate = nextPeriod.startDate
      scheduleName = nextPeriod.scheduleName
      attempts++
    }

    if (attempts >= maxAttempts) {
      showWarning('No se pudo encontrar un período disponible. Por favor, revisa tus horarios existentes.')
      return
    }

    const templates = getDefaultShiftTemplates()
    const newSchedule = generateWeeklySchedule(
      startDate.toISOString().split('T')[0],
      scheduleName,
      templates
    )

    newSchedule.branchCode = targetBranchCode
    newSchedule.division = targetDivision

    // Apply rotation from previous schedule
    const previousSchedule = existingSchedules
      .filter(s => s.branchCode === targetBranchCode && s.division === targetDivision)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0]

    if (previousSchedule) {
      // Helper function to rotate shift and position
      const rotateShiftAndPosition = (currentShift: ShiftType, currentPosition: PositionType): { shift: ShiftType; position: PositionType } => {
        // EXT employees rotate shift but keep EXT position
        if (currentPosition === 'EXT') {
          const shiftRotation: Record<ShiftType, ShiftType> = {
            'morning': 'afternoon',
            'afternoon': 'night',
            'night': 'morning',
            'unassigned': 'unassigned'
          }
          return { shift: shiftRotation[currentShift], position: 'EXT' }
        }

        // Regular rotation with night shift special handling (only C2 and C3)
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

      // Helper function to advance rest day by one day of week
      const advanceRestDay = (dayName: string): string => {
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
        const currentIndex = days.indexOf(dayName)
        if (currentIndex === -1) return dayName
        const nextIndex = (currentIndex + 1) % days.length
        return days[nextIndex]
      }

      // Helper to get shift type from time
      const getShiftTypeFromTime = (startTime: string): ShiftType => {
        if (startTime === '07:00') return 'morning'
        if (startTime === '15:00') return 'afternoon'
        if (startTime === '23:00') return 'night'
        return 'unassigned'
      }

      // Clear empty shifts created by generateWeeklySchedule
      newSchedule.days.forEach(day => {
        day.shifts = []
      })

      // Step 1: Collect rest days per employee from previous schedule
      const employeeRestDays = new Map<string, string[]>()
      previousSchedule.days.forEach(day => {
        day.shifts.forEach(shift => {
          if (shift.employeeId && shift.status === 'rest') {
            if (!employeeRestDays.has(shift.employeeId)) {
              employeeRestDays.set(shift.employeeId, [])
            }
            if (!employeeRestDays.get(shift.employeeId)!.includes(day.dayName)) {
              employeeRestDays.get(shift.employeeId)!.push(day.dayName)
            }
          }
        })
      })

      // Step 2: Calculate advanced rest days (rotate by 1 day)
      const newRestDays = new Map<string, string[]>()
      employeeRestDays.forEach((restDays, employeeId) => {
        const advancedDays = restDays.map(day => advanceRestDay(day))
        newRestDays.set(employeeId, advancedDays)
      })

      // Step 3: Apply rotation to each day
      newSchedule.days.forEach(newDay => {
        // Find corresponding day in previous schedule (same dayName)
        const previousDay = previousSchedule.days.find(d => d.dayName === newDay.dayName)
        if (!previousDay) return

        // For each shift in previous day, apply rotation and create new shift
        previousDay.shifts.forEach(prevShift => {
          if (!prevShift.employeeId || !prevShift.isAssigned) return

          const currentShiftType = getShiftTypeFromTime(prevShift.startTime)
          const currentPosition = prevShift.position || 'EXT'

          // Check if this employee has rest on this day in new schedule
          const employeeNewRestDays = newRestDays.get(prevShift.employeeId) || []
          const isRestDay = employeeNewRestDays.includes(newDay.dayName)

          // Calculate rotated shift and position
          const { shift: newShiftType, position: newPosition } = rotateShiftAndPosition(currentShiftType, currentPosition)

          // Define shift times
          const shiftTimes: Record<ShiftType, { start: string; end: string }> = {
            'morning': { start: '07:00', end: '15:00' },
            'afternoon': { start: '15:00', end: '23:00' },
            'night': { start: '23:00', end: '07:00' },
            'unassigned': { start: '', end: '' }
          }

          const targetTime = shiftTimes[newShiftType]

          // Create new shift object for this employee
          const newShift = {
            id: generateId(),
            startTime: targetTime.start,
            endTime: targetTime.end,
            date: newDay.date,
            employeeId: prevShift.employeeId,
            isAssigned: true,
            position: newPosition,
            status: isRestDay ? ('rest' as ShiftStatus) : (prevShift.status === 'rest' ? 'assigned' as ShiftStatus : prevShift.status || 'assigned' as ShiftStatus),
            ...(prevShift.coverageInfo && !isRestDay && { coverageInfo: { ...prevShift.coverageInfo } })
          }

          // Add to day's shifts
          newDay.shifts.push(newShift)
        })
      })

      // Step 4: Update employee rotation counters
      const allEmployees = await storage.getEmployees()
      const updatedEmployees = allEmployees.map(emp => {
        // Check if this employee is in the new schedule
        const isInSchedule = newSchedule.days.some(day =>
          day.shifts.some(shift => shift.employeeId === emp.id)
        )

        if (isInSchedule && emp.branchCode === targetBranchCode && emp.division === targetDivision) {
          return {
            ...emp,
            shiftRotationCount: (emp.shiftRotationCount || 0) + 1
          }
        }
        return emp
      })

      // Update each employee individually
      for (const emp of updatedEmployees) {
        const original = allEmployees.find(e => e.id === emp.id)
        if (original && emp.shiftRotationCount !== original.shiftRotationCount) {
          await storage.updateEmployee(emp.id, { shiftRotationCount: emp.shiftRotationCount })
        }
      }
    }

    await storage.addSchedule(newSchedule)
    onUpdate()
    showSuccess(`Horario creado: ${scheduleName}`, '¡Horario creado!')
  }

  if (!schedule) {
    return (
      <div className="card text-center py-12">
        <div className="max-w-md mx-auto space-y-4">
          <Calendar className="h-16 w-16 text-gray-400 mx-auto" />
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay horario seleccionado</h3>
            <p className="text-gray-600 mb-4">
              Selecciona un horario desde el historial o crea uno nuevo para la quincena actual.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleCreateNextSchedule}
              className="btn btn-primary inline-flex items-center space-x-2 interactive"
            >
              <Plus className="h-5 w-5" />
              <span>Crear Nuevo Horario</span>
            </button>
            <button
              onClick={() => csvFileInputRef.current?.click()}
              className="btn btn-secondary inline-flex items-center space-x-2 interactive"
            >
              <Upload className="h-5 w-5" />
              <span>Importar CSV</span>
            </button>
            <input
              ref={csvFileInputRef}
              type="file"
              accept=".csv"
              multiple
              onChange={handleImportFromCSV}
              className="hidden"
            />
          </div>
          {/* Hidden global trigger so other components can open the file input */}
          <button id="global-import-csv-trigger" onClick={() => csvFileInputRef.current?.click()} className="hidden" aria-hidden="true" />
        </div>
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
          currentBranchCode={branchCode}
          currentShiftType={coverageMenu.shiftType}
        />
      )}

      {/* Employee Context Menu */}
      {employeeContextMenu && (
        <EmployeeContextMenu
          isOpen={employeeContextMenu.isOpen}
          position={employeeContextMenu.position}
          employeeId={employeeContextMenu.employeeId}
          currentBranchCode={branchCode}
          onTransfer={handleEmployeeTransfer}
          onDelete={handleEmployeeDeleteClick}
          onClose={() => setEmployeeContextMenu(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteDialog && (
        <ConfirmDeleteDialog
          isOpen={deleteDialog.isOpen}
          employeeName={deleteDialog.employeeName}
          onDeleteFromSchedule={() => handleDeleteFromScheduleOnly(deleteDialog.employeeId)}
          onDeleteEmployee={() => handleDeleteEmployeePermanently(deleteDialog.employeeId)}
          onClose={() => setDeleteDialog(null)}
        />
      )}

      <div className="space-y-4">
        {/* Header con acciones */}
        <div className="card">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4">
            <h2 className="text-2xl font-bold text-gray-900">Horario</h2>

            <div className="flex items-center gap-3">
              {/* Botón Nuevo horario (a la izquierda del menú) */}
              <button
                onClick={handleCreateNextSchedule}
                className="btn btn-primary inline-flex items-center space-x-2 interactive"
              >
                <Plus className="h-5 w-5" />
                <span>Nuevo horario</span>
              </button>

              {/* Menú desplegable */}
              <div className="relative" ref={actionsMenuRef}>
                <button
                  onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)}
                  className="p-2 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
                  title="Menú de opciones"
                  aria-label="Menú de opciones"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>

                {/* Dropdown menu */}
                {isActionsMenuOpen && (
                  <div className="absolute right-0 mt-2 w-44 bg-white rounded-md shadow-md border border-gray-200 z-50">
                    <div className="py-1">
                      {/* Exportar PDF */}
                      <button
                        onClick={() => {
                          handleExportToPDF()
                          setIsActionsMenuOpen(false)
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-sm"
                      >
                        <Download className="h-4 w-4 text-gray-600" />
                        <span className="text-gray-700">Exportar PDF</span>
                      </button>

                      <div className="border-t border-gray-100 my-1"></div>

                      {/* Exportar CSV */}
                      <button
                        onClick={() => {
                          handleExportToCSV()
                          setIsActionsMenuOpen(false)
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-sm"
                      >
                        <FileSpreadsheet className="h-4 w-4 text-gray-600" />
                        <span className="text-gray-700">Exportar CSV</span>
                      </button>

                      {/* Importar CSV */}
                      <button
                        onClick={() => {
                          csvFileInputRef.current?.click()
                          setIsActionsMenuOpen(false)
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-sm"
                      >
                        <Upload className="h-4 w-4 text-gray-600" />
                        <span className="text-gray-700">Importar CSV</span>
                      </button>

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
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Hotkeys moved to bottom legend */}

      <div ref={tableRef} className="bg-white p-6">
        {/* Schedule Context Header */}
        <div className="mb-4" style={{ backgroundColor: '#654321', padding: '20px', textAlign: 'center' }}>
          <h1 className="text-2xl font-bold text-white">
            {companyName}
          </h1>
          <h2 className="text-lg text-white mt-2">
            ROL DE TURNOS DEL {parseLocalDate(schedule.startDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })} AL {parseLocalDate(schedule.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}
          </h2>
        </div>

        {/* Unified Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000' }}>
          <thead>
            <tr style={{ backgroundColor: '#654321' }}>
              <th style={{ border: '1px solid #000', padding: '8px', width: '150px', fontWeight: 'bold', backgroundColor: '#FFFFFF' }}>Nombre</th>
              {schedule.days.map((day, idx) => (
                <th key={idx} style={{ border: '1px solid #000', padding: '4px', fontSize: '11px', color: '#FFFFFF', backgroundColor: '#654321' }}>
                  <div>{parseLocalDate(day.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                  <div style={{ fontSize: '10px' }}>{day.dayName.toUpperCase()}</div>
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
                    onEmployeeContextMenu={handleEmployeeContextMenu}
                    onPositionChange={handlePositionChange}
                    getShiftForDay={getShiftForDay}
                    onVacationDrop={handleVacationDrop}
                    onCellMouseDown={handleCellMouseDown}
                    onCellMouseEnter={handleCellMouseEnter}
                    selectedCell={selectedCell}
                    selectedCells={selectedCells}
                    branchCode={branchCode}
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
                    onEmployeeContextMenu={handleEmployeeContextMenu}
                    onPositionChange={handlePositionChange}
                    getShiftForDay={getShiftForDay}
                    onVacationDrop={handleVacationDrop}
                    onCellMouseDown={handleCellMouseDown}
                    onCellMouseEnter={handleCellMouseEnter}
                    selectedCell={selectedCell}
                    selectedCells={selectedCells}
                    isCoveringRow={true}
                    coveringDays={coveringDays}
                    branchCode={branchCode}
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
                    onEmployeeContextMenu={handleEmployeeContextMenu}
                    onPositionChange={handlePositionChange}
                    getShiftForDay={getShiftForDay}
                    onVacationDrop={handleVacationDrop}
                    onCellMouseDown={handleCellMouseDown}
                    onCellMouseEnter={handleCellMouseEnter}
                    selectedCell={selectedCell}
                    selectedCells={selectedCells}
                    branchCode={branchCode}
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
                    onEmployeeContextMenu={handleEmployeeContextMenu}
                    onPositionChange={handlePositionChange}
                    getShiftForDay={getShiftForDay}
                    onVacationDrop={handleVacationDrop}
                    onCellMouseDown={handleCellMouseDown}
                    onCellMouseEnter={handleCellMouseEnter}
                    selectedCell={selectedCell}
                    selectedCells={selectedCells}
                    isCoveringRow={true}
                    coveringDays={coveringDays}
                    branchCode={branchCode}
                  />
                ))}
              </>
            )}
          </ShiftRowContainer>

          {/* Night Shift - Only for branches 001 and 003, not 002 */}
          {branchCode !== '002' && (
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
                      onEmployeeContextMenu={handleEmployeeContextMenu}
                      onPositionChange={handlePositionChange}
                      getShiftForDay={getShiftForDay}
                      onVacationDrop={handleVacationDrop}
                      onCellMouseDown={handleCellMouseDown}
                      onCellMouseEnter={handleCellMouseEnter}
                      selectedCell={selectedCell}
                      selectedCells={selectedCells}
                      branchCode={branchCode}
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
                      onEmployeeContextMenu={handleEmployeeContextMenu}
                      onPositionChange={handlePositionChange}
                      getShiftForDay={getShiftForDay}
                      onVacationDrop={handleVacationDrop}
                      onCellMouseDown={handleCellMouseDown}
                      onCellMouseEnter={handleCellMouseEnter}
                      selectedCell={selectedCell}
                      selectedCells={selectedCells}
                      isCoveringRow={true}
                      coveringDays={coveringDays}
                      branchCode={branchCode}
                    />
                  ))}
                </>
              )}
            </ShiftRowContainer>
          )}
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
                  <kbd className="font-mono font-bold">Ctrl+Click</kbd> Selección múltiple
                </span>
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
