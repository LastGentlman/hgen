export type ShiftType = 'morning' | 'afternoon' | 'night' | 'unassigned'

export type BranchCode = '001' | '002' | '003'

export type Division = 'super' | 'gasolinera' | 'restaurant' | 'limpieza'

export interface Employee {
  id: string
  name: string
  department?: string
  availableDays: string[]
  email?: string
  phone?: string
  assignedShift?: ShiftType
  // Organizational context (optional for backward compatibility)
  branchCode?: BranchCode
  division?: Division
}

export type ShiftStatus = 'assigned' | 'rest' | 'vacation' | 'sick' | 'absent' | 'covering' | 'empty'

export interface CoverageInfo {
  type: 'shift' | 'branch'
  target?: string  // DEPRECATED: kept for backward compatibility
  targetShift?: string  // 'morning' | 'afternoon' | 'night'
  targetBranch?: string // '001' | '002' | '003'
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
  // Organizational context (optional for backward compatibility)
  branchCode?: BranchCode
  division?: Division
}

export type DayOfWeek = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo'

export interface ShiftTemplate {
  startTime: string
  endTime: string
  dayOfWeek: DayOfWeek
}