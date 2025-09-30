export interface Employee {
  id: string
  name: string
  department?: string
  maxHoursPerWeek: number
  availableDays: string[]
  email?: string
  phone?: string
}

export interface Shift {
  id: string
  startTime: string
  endTime: string
  position: string
  employeeId?: string
  date: string
  isAssigned: boolean
}

export interface ScheduleDay {
  date: string
  dayName: string
  shifts: Shift[]
}

export interface Schedule {
  id: string
  name: string
  startDate: string
  endDate: string
  days: ScheduleDay[]
  createdAt: string
  updatedAt: string
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'

export interface ShiftTemplate {
  startTime: string
  endTime: string
  position: string
  dayOfWeek: DayOfWeek
}