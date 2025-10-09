'use client'

import React from 'react'
import { Schedule, ShiftStatus } from '@/types'
import { STATUS_PALETTE } from '@/lib/statusStyles'

interface SchedulePreviewSVGProps {
  schedule: Schedule
  className?: string
  height?: number
}

// Use the same palette as the grid styles
const STATUS_COLORS: Record<ShiftStatus, { fill: string; stroke: string }> = STATUS_PALETTE

/**
 * Renders a tiny SVG grid preview of the schedule: columns are days, rows are 3 shifts.
 */
export default function SchedulePreviewSVG({ schedule, className, height = 140 }: SchedulePreviewSVGProps) {
  const days = schedule.days
  const numDays = days.length
  const rows = 3 // morning, afternoon, night

  // Layout constants (SVG user units)
  const topPadding = 24
  const leftPadding = 36
  const rightPadding = 8
  const bottomPadding = 8
  const colWidth = 22
  const rowHeight = 30
  const gridWidth = numDays * colWidth
  const gridHeight = rows * rowHeight
  const totalWidth = leftPadding + gridWidth + rightPadding
  const totalHeight = topPadding + gridHeight + bottomPadding

  const getCellStatus = (dayIndex: number, shiftRow: number): ShiftStatus => {
    const shifts = days[dayIndex]?.shifts || []
    const shift = shifts[shiftRow]
    if (!shift) return 'empty'
    return (shift.status as ShiftStatus) || (shift.isAssigned ? 'assigned' : 'empty')
  }

  const dayLabel = (isoDate: string): string => {
    try {
      const d = new Date(isoDate)
      return d.getDate().toString()
    } catch {
      return ''
    }
  }

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      width="100%"
      height={height}
      className={className}
      role="img"
      aria-label={`Vista previa del horario ${schedule.name}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Title row with start-end dates */}
      <text x={leftPadding} y={14} fontSize={10} fill="#374151">
        {new Date(schedule.startDate).toLocaleDateString('es-ES')} – {new Date(schedule.endDate).toLocaleDateString('es-ES')}
      </text>

      {/* Column day labels */}
      {days.map((day, col) => (
        <text
          key={`label-${day.date}`}
          x={leftPadding + col * colWidth + colWidth / 2}
          y={topPadding - 4}
          textAnchor="middle"
          fontSize={9}
          fill="#6B7280"
        >
          {dayLabel(day.date)}
        </text>
      ))}

      {/* Row labels: T1/T2/T3 (turnos) */}
      {[0, 1, 2].map((row) => (
        <text
          key={`row-label-${row}`}
          x={leftPadding - 10}
          y={topPadding + row * rowHeight + rowHeight / 2 + 3}
          textAnchor="end"
          fontSize={9}
          fill="#6B7280"
        >
          {row === 0 ? 'T1' : row === 1 ? 'T2' : 'T3'}
        </text>
      ))}

      {/* Grid cells */}
      {Array.from({ length: rows }).map((_, row) => (
        <g key={`row-${row}`}>
          {days.map((_, col) => {
            const status = getCellStatus(col, row)
            const { fill, stroke } = STATUS_COLORS[status]
            const x = leftPadding + col * colWidth
            const y = topPadding + row * rowHeight

            return (
              <rect
                key={`cell-${row}-${col}`}
                x={x}
                y={y}
                width={colWidth - 4}
                height={rowHeight - 8}
                fill={fill}
                stroke={stroke}
                strokeWidth={0.75}
                rx={4}
                ry={4}
              />
            )
          })}
        </g>
      ))}

      {/* Border */}
      <rect
        x={0.5}
        y={0.5}
        width={totalWidth - 1}
        height={totalHeight - 1}
        fill="none"
        stroke="#E5E7EB"
        strokeWidth={1}
        rx={6}
        ry={6}
      />
    </svg>
  )
}
