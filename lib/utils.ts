import { format, addDays } from 'date-fns'
import { Employee, Schedule, ScheduleDay, Shift, ShiftTemplate, DayOfWeek } from '@/types'

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
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
  const start = new Date(startDate)

  const days: ScheduleDay[] = []
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  for (let i = 0; i < 15; i++) {
    const currentDate = addDays(start, i)
    const dayName = dayNames[i % 7] // Cycle through day names
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
    endDate: format(addDays(start, 14), 'yyyy-MM-dd'),
    days,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}


export function getDefaultShiftTemplates(): ShiftTemplate[] {
  const shifts: ShiftTemplate[] = []
  const dayNames: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

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