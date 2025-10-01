import { Employee, Schedule } from '@/types'

const EMPLOYEES_KEY = 'hgen_employees'
const SCHEDULES_KEY = 'hgen_schedules'

export const storage = {
  // Employee operations
  getEmployees(): Employee[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem(EMPLOYEES_KEY)
    return stored ? JSON.parse(stored) : []
  },

  saveEmployees(employees: Employee[]): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees))
  },

  addEmployee(employee: Employee): void {
    const employees = this.getEmployees()
    employees.push(employee)
    this.saveEmployees(employees)
  },

  updateEmployee(id: string, updates: Partial<Employee>): void {
    const employees = this.getEmployees()
    const index = employees.findIndex(emp => emp.id === id)
    if (index !== -1) {
      employees[index] = { ...employees[index], ...updates }
      this.saveEmployees(employees)
    }
  },

  deleteEmployee(id: string): void {
    const employees = this.getEmployees().filter(emp => emp.id !== id)
    this.saveEmployees(employees)
  },

  // Schedule operations
  getSchedules(): Schedule[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem(SCHEDULES_KEY)
    return stored ? JSON.parse(stored) : []
  },

  saveSchedules(schedules: Schedule[]): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedules))
  },

  addSchedule(schedule: Schedule): void {
    const schedules = this.getSchedules()
    schedules.push(schedule)
    this.saveSchedules(schedules)
  },

  updateSchedule(id: string, updates: Partial<Schedule>): void {
    const schedules = this.getSchedules()
    const index = schedules.findIndex(sch => sch.id === id)
    if (index !== -1) {
      schedules[index] = { ...schedules[index], ...updates, updatedAt: new Date().toISOString() }
      this.saveSchedules(schedules)
    }
  },

  deleteSchedule(id: string): void {
    const schedules = this.getSchedules().filter(sch => sch.id !== id)
    this.saveSchedules(schedules)
  },

  // Clear all data
  clearAllSchedules(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(SCHEDULES_KEY)
  },

  clearAllData(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(EMPLOYEES_KEY)
    localStorage.removeItem(SCHEDULES_KEY)
  },

  // Export/Import
  exportData(): string {
    return JSON.stringify({
      employees: this.getEmployees(),
      schedules: this.getSchedules(),
      exportDate: new Date().toISOString()
    }, null, 2)
  },

  importData(jsonData: string): { success: boolean; message: string } {
    try {
      const data = JSON.parse(jsonData)

      if (data.employees && Array.isArray(data.employees)) {
        this.saveEmployees(data.employees)
      }

      if (data.schedules && Array.isArray(data.schedules)) {
        this.saveSchedules(data.schedules)
      }

      return { success: true, message: 'Data imported successfully' }
    } catch (error) {
      return { success: false, message: 'Invalid JSON data' }
    }
  }
}