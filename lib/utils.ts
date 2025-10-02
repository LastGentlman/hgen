import { format, addDays } from 'date-fns'
import { Employee, Schedule, ScheduleDay, Shift, ShiftTemplate, DayOfWeek } from '@/types'

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
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
      { startTime: '07:00', endTime: '15:00', dayOfWeek: day },
      { startTime: '15:00', endTime: '23:00', dayOfWeek: day },
      { startTime: '23:00', endTime: '07:00', dayOfWeek: day }
    )
  })

  return shifts
}