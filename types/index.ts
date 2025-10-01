export type ShiftType = 'morning' | 'afternoon' | 'night' | 'unassigned'

export interface Employee {
  id: string
  name: string
  department?: string
  availableDays: string[]
  email?: string
  phone?: string
  assignedShift?: ShiftType
}

export type ShiftStatus = 'assigned' | 'rest' | 'vacation' | 'covering' | 'empty'

export interface CoverageInfo {
  type: 'shift' | 'branch'
  target: string  // 'morning' | 'afternoon' | 'night' or branch name
}

export type PositionType = 'C1' | 'C2' | 'C3' | 'EXT'

export interface Shift {
  id: string
  startTime: string
  endTime: string
  employeeId?: string
  date: string
  isAssigned: boolean
  status?: ShiftStatus
  coverageInfo?: CoverageInfo
  position?: PositionType
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