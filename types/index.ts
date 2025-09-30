export interface Employee {
  id: string
  name: string
  department?: string
  availableDays: string[]
  email?: string
  phone?: string
}

export type ShiftStatus = 'assigned' | 'rest' | 'vacation' | 'sick' | 'absent' | 'empty'

export interface Shift {
  id: string
  startTime: string
  endTime: string
  employeeId?: string
  date: string
  isAssigned: boolean
  status?: ShiftStatus
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
  dayOfWeek: DayOfWeek
}