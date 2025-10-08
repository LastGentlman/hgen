import { Employee, Schedule } from '@/types'
import { supabase } from './supabase'

// Mapeo de campos TypeScript a columnas de la base de datos
const mapEmployeeToDb = (employee: Employee) => ({
  id: employee.id,
  name: employee.name,
  department: employee.department || null,
  available_days: employee.availableDays,
  email: employee.email || null,
  phone: employee.phone || null,
  assigned_shift: employee.assignedShift || null,
  branch_code: employee.branchCode || null,
  division: employee.division || null,
  shift_rotation_count: employee.shiftRotationCount || 0,
})

const mapEmployeeFromDb = (row: any): Employee => ({
  id: row.id,
  name: row.name,
  department: row.department,
  availableDays: row.available_days,
  email: row.email,
  phone: row.phone,
  assignedShift: row.assigned_shift,
  branchCode: row.branch_code,
  division: row.division,
  shiftRotationCount: row.shift_rotation_count,
})

const mapScheduleToDb = (schedule: Schedule) => ({
  id: schedule.id,
  name: schedule.name,
  start_date: schedule.startDate,
  end_date: schedule.endDate,
  days: schedule.days,
  branch_code: schedule.branchCode || null,
  division: schedule.division || null,
  created_at: schedule.createdAt,
  updated_at: schedule.updatedAt,
})

const mapScheduleFromDb = (row: any): Schedule => ({
  id: row.id,
  name: row.name,
  startDate: row.start_date,
  endDate: row.end_date,
  days: row.days,
  branchCode: row.branch_code,
  division: row.division,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const storage = {
  // Employee operations
  async getEmployees(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching employees:', error)
      return []
    }

    return (data || []).map(mapEmployeeFromDb)
  },

  async addEmployee(employee: Employee): Promise<void> {
    const { error } = await supabase
      .from('employees')
      .insert([mapEmployeeToDb(employee)])

    if (error) {
      console.error('Error adding employee:', error)
      throw new Error('Failed to add employee')
    }
  },

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<void> {
    // Convertir las actualizaciones a formato de base de datos
    const dbUpdates: any = {}

    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.department !== undefined) dbUpdates.department = updates.department
    if (updates.availableDays !== undefined) dbUpdates.available_days = updates.availableDays
    if (updates.email !== undefined) dbUpdates.email = updates.email
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone
    if (updates.assignedShift !== undefined) dbUpdates.assigned_shift = updates.assignedShift
    if (updates.branchCode !== undefined) dbUpdates.branch_code = updates.branchCode
    if (updates.division !== undefined) dbUpdates.division = updates.division
    if (updates.shiftRotationCount !== undefined) dbUpdates.shift_rotation_count = updates.shiftRotationCount

    const { error } = await supabase
      .from('employees')
      .update(dbUpdates)
      .eq('id', id)

    if (error) {
      console.error('Error updating employee:', error)
      throw new Error('Failed to update employee')
    }
  },

  async deleteEmployee(id: string): Promise<void> {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting employee:', error)
      throw new Error('Failed to delete employee')
    }
  },

  // Schedule operations
  async getSchedules(): Promise<Schedule[]> {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching schedules:', error)
      return []
    }

    return (data || []).map(mapScheduleFromDb)
  },

  async addSchedule(schedule: Schedule): Promise<void> {
    const { error } = await supabase
      .from('schedules')
      .insert([mapScheduleToDb(schedule)])

    if (error) {
      console.error('Error adding schedule:', error)
      throw new Error('Failed to add schedule')
    }
  },

  async updateSchedule(id: string, updates: Partial<Schedule>): Promise<void> {
    // Convertir las actualizaciones a formato de base de datos
    const dbUpdates: any = {}

    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate
    if (updates.days !== undefined) dbUpdates.days = updates.days
    if (updates.branchCode !== undefined) dbUpdates.branch_code = updates.branchCode
    if (updates.division !== undefined) dbUpdates.division = updates.division

    // Siempre actualizar updated_at
    dbUpdates.updated_at = new Date().toISOString()

    const { error } = await supabase
      .from('schedules')
      .update(dbUpdates)
      .eq('id', id)

    if (error) {
      console.error('Error updating schedule:', error)
      throw new Error('Failed to update schedule')
    }
  },

  async deleteSchedule(id: string): Promise<void> {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting schedule:', error)
      throw new Error('Failed to delete schedule')
    }
  },

  // Clear operations
  async clearAllSchedules(): Promise<void> {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (error) {
      console.error('Error clearing schedules:', error)
      throw new Error('Failed to clear schedules')
    }
  },

  async clearAllData(): Promise<void> {
    // Eliminar todos los schedules (las edits y métricas se eliminan por CASCADE)
    const { error: schedulesError } = await supabase
      .from('schedules')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (schedulesError) {
      console.error('Error clearing schedules:', schedulesError)
    }

    // Eliminar todos los empleados
    const { error: employeesError } = await supabase
      .from('employees')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (employeesError) {
      console.error('Error clearing employees:', employeesError)
      throw new Error('Failed to clear all data')
    }
  },

  // Export/Import
  async exportData(): Promise<string> {
    const employees = await this.getEmployees()
    const schedules = await this.getSchedules()

    return JSON.stringify({
      employees,
      schedules,
      exportDate: new Date().toISOString()
    }, null, 2)
  },

  async importData(jsonData: string): Promise<{ success: boolean; message: string }> {
    try {
      const data = JSON.parse(jsonData)

      if (data.employees && Array.isArray(data.employees)) {
        // Insertar empleados
        const employeesToInsert = data.employees.map(mapEmployeeToDb)
        const { error: empError } = await supabase
          .from('employees')
          .insert(employeesToInsert)

        if (empError) {
          console.error('Error importing employees:', empError)
          return { success: false, message: 'Error importing employees' }
        }
      }

      if (data.schedules && Array.isArray(data.schedules)) {
        // Insertar schedules
        const schedulesToInsert = data.schedules.map(mapScheduleToDb)
        const { error: schError } = await supabase
          .from('schedules')
          .insert(schedulesToInsert)

        if (schError) {
          console.error('Error importing schedules:', schError)
          return { success: false, message: 'Error importing schedules' }
        }
      }

      return { success: true, message: 'Data imported successfully' }
    } catch (error) {
      console.error('Error parsing JSON:', error)
      return { success: false, message: 'Invalid JSON data' }
    }
  }
}
