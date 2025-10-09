'use client'

import { ShiftStatus } from '@/types'

// Shared CSS classes used by ScheduleView
export const STATUS_CONFIG: Record<
  ShiftStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  assigned: { label: 'Asignado', bg: 'bg-white', text: 'text-gray-900', border: 'border-gray-300' },
  rest: { label: 'DESC', bg: 'bg-amber-700', text: 'text-white', border: 'border-amber-800' },
  vacation: { label: 'VAC', bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-700' },
  sick: { label: 'ENF', bg: 'bg-red-600', text: 'text-white', border: 'border-red-700' },
  absent: { label: 'AUS', bg: 'bg-orange-600', text: 'text-white', border: 'border-orange-700' },
  covering: { label: 'COB', bg: 'bg-orange-400', text: 'text-white', border: 'border-orange-500' },
  empty: { label: 'Vacío', bg: 'bg-gray-50', text: 'text-gray-400', border: 'border-gray-200' }
}

// Hex palette to mirror STATUS_CONFIG for non-CSS contexts (e.g., SVG preview)
export const STATUS_PALETTE: Record<ShiftStatus, { fill: string; stroke: string }> = {
  // Mirror GridView hex palette for visual consistency
  assigned: { fill: '#FFFFFF', stroke: '#000000' },
  rest: { fill: '#8B4513', stroke: '#000000' },
  vacation: { fill: '#000000', stroke: '#000000' },
  sick: { fill: '#DC2626', stroke: '#000000' },
  absent: { fill: '#EA580C', stroke: '#000000' },
  covering: { fill: '#FFB366', stroke: '#000000' },
  empty: { fill: '#FFFFFF', stroke: '#CCCCCC' }
}
