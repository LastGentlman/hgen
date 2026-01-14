import { format, addDays } from 'date-fns'
import { Employee, Schedule, ScheduleDay, Shift, ShiftTemplate, DayOfWeek, ShiftType } from '@/types'

export function generateId(): string {
  // Prefer cryptographically strong UUID v4 when available
  try {
    // Browser and modern Node runtimes
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      return (crypto as any).randomUUID()
    }
  } catch {
    // ignore and fallback
  }
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function isUuid(value: string | undefined | null): boolean {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

// Parse date string in local timezone to avoid timezone issues
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatTime(time: string): string {
  try {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${period}`
  } catch {
    return time
  }
}

export function calculateShiftDuration(startTime: string, endTime: string): number {
  try {
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)

    const startMinutes = startHour * 60 + startMin
    let endMinutes = endHour * 60 + endMin

    // Handle overnight shifts
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60
    }

    return (endMinutes - startMinutes) / 60
  } catch {
    return 0
  }
}

// Helper function to determine shift type from time
export function getShiftTypeFromTime(startTime: string, endTime: string): ShiftType | null {
  const time = `${startTime}-${endTime}`
  if (time === '06:00-14:00') return 'morning'
  if (time === '14:00-22:00') return 'afternoon'
  if (time === '22:00-06:00') return 'night'
  // Tolerate legacy canonical times from older schedules
  if (time === '07:00-15:00') return 'morning'
  if (time === '15:00-23:00') return 'afternoon'
  if (time === '23:00-07:00') return 'night'
  return null
}

export function generateWeeklySchedule(
  startDate: string,
  name: string,
  templates: ShiftTemplate[]
): Schedule {
  // Parse date string manually to avoid timezone issues
  const [year, month, day] = startDate.split('-').map(Number)
  const start = new Date(year, month - 1, day) // month is 0-indexed
  const startDay = start.getDate()

  const days: ScheduleDay[] = []
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

  // Determine if this is first half (1-15) or second half (16-end)
  let numDays: number
  let endDate: Date

  if (startDay === 1) {
    // First half of month: days 1-15
    numDays = 15
    endDate = new Date(start.getFullYear(), start.getMonth(), 15)
  } else if (startDay === 16) {
    // Second half of month: day 16 to end of month
    const lastDayOfMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
    numDays = lastDayOfMonth - 15 // 13, 15, or 16 days depending on month
    endDate = new Date(start.getFullYear(), start.getMonth(), lastDayOfMonth)
  } else {
    // Default to 15 days for any other start date
    numDays = 15
    endDate = addDays(start, 14)
  }

  for (let i = 0; i < numDays; i++) {
    const currentDate = addDays(start, i)
    const dayIndex = currentDate.getDay()
    const dayName = dayNames[dayIndex]
    const dateStr = format(currentDate, 'yyyy-MM-dd')

    const dayTemplates = templates.filter(t => t.dayOfWeek === dayName)
    const shifts: Shift[] = dayTemplates.map(template => ({
      id: generateId(),
      startTime: template.startTime,
      endTime: template.endTime,
      date: dateStr,
      isAssigned: false,
      status: 'empty' as const
    }))

    days.push({
      date: dateStr,
      dayName,
      shifts
    })
  }

  return {
    id: generateId(),
    name,
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
    days,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}


export function getDefaultShiftTemplates(): ShiftTemplate[] {
  const shifts: ShiftTemplate[] = []
  const dayNames: DayOfWeek[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

  // Create 3 shifts for each day (24/7 operation)
  dayNames.forEach(day => {
    shifts.push(
      { startTime: '06:00', endTime: '14:00', dayOfWeek: day },
      { startTime: '14:00', endTime: '22:00', dayOfWeek: day },
      { startTime: '22:00', endTime: '06:00', dayOfWeek: day }
    )
  })

  return shifts
}