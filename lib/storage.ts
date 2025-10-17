import { Employee, Schedule } from '@/types'
import { supabase } from './supabase'
import { isUuid } from '@/lib/utils'

// Mapeo de campos TypeScript a columnas de la base de datos
const mapEmployeeToDb = (employee: Employee) => {
  const base = {
    name: employee.name,
    department: employee.department || null,
    available_days: employee.availableDays,
    email: employee.email || null,
    phone: employee.phone || null,
    assigned_shift: employee.assignedShift || null,
    branch_code: employee.branchCode || null,
    division: employee.division || null,
    shift_rotation_count: employee.shiftRotationCount || 0,
    is_active: employee.isActive !== undefined ? employee.isActive : true,
    deleted_at: employee.deletedAt || null,
  }
  return isUuid(employee.id) ? { id: employee.id, ...base } : base
}

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
  isActive: row.is_active !== undefined ? row.is_active : true,
  deletedAt: row.deleted_at,
})

const mapScheduleToDb = (schedule: Schedule) => {
  const base = {
    name: schedule.name,
    start_date: schedule.startDate,
    end_date: schedule.endDate,
    days: schedule.days,
    branch_code: schedule.branchCode || null,
    division: schedule.division || null,
    created_at: schedule.createdAt,
    updated_at: schedule.updatedAt,
  }
  return isUuid(schedule.id) ? { id: schedule.id, ...base } : base
}

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
  // Employee operations (Supabase = fuente de verdad)
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

    // Actualizar timestamp de última sincronización
    if (typeof window !== 'undefined') {
      localStorage.setItem('hgen_last_sync', new Date().toISOString())
    }
  },

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<void> {
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

    // Actualizar timestamp de última sincronización
    if (typeof window !== 'undefined') {
      localStorage.setItem('hgen_last_sync', new Date().toISOString())
    }
  },

  async deleteEmployee(id: string): Promise<void> {
    // Soft-delete: move employee to inactive_employees table

    // 1. Get employee from employees table
    const { data: employee, error: fetchError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !employee) {
      console.error('Error fetching employee for deletion:', fetchError)
      throw new Error('Failed to find employee')
    }

    // 2. Prepare data for inactive_employees (exclude is_active if present)
    const { is_active, ...employeeData } = employee
    const inactiveEmployee = {
      ...employeeData,
      deleted_at: new Date().toISOString()
    }

    // 3. Insert into inactive_employees table
    const { error: insertError } = await supabase
      .from('inactive_employees')
      .insert([inactiveEmployee])

    if (insertError) {
      console.error('Error moving employee to inactive:', insertError)
      throw new Error('Failed to archive employee')
    }

    // 4. Delete from employees table
    const { error: deleteError } = await supabase
      .from('employees')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting employee from active table:', deleteError)
      throw new Error('Failed to delete employee')
    }

    // Actualizar timestamp de última sincronización
    if (typeof window !== 'undefined') {
      localStorage.setItem('hgen_last_sync', new Date().toISOString())
    }
  },

  async getInactiveEmployees(): Promise<Employee[]> {
    const { data, error} = await supabase
      .from('inactive_employees')
      .select('*')
      .order('deleted_at', { ascending: false })

    if (error) {
      console.error('Error fetching inactive employees:', error)
      return []
    }

    return (data || []).map(mapEmployeeFromDb)
  },

  async restoreEmployee(id: string): Promise<void> {
    // Restore employee: move from inactive_employees back to employees table

    // 1. Get employee from inactive_employees table
    const { data: inactiveEmployee, error: fetchError } = await supabase
      .from('inactive_employees')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !inactiveEmployee) {
      console.error('Error fetching inactive employee for restore:', fetchError)
      throw new Error('Failed to find inactive employee')
    }

    // 2. Prepare employee data (remove deleted_at)
    const { deleted_at, ...employeeData } = inactiveEmployee

    // 3. Insert into employees table
    const { error: insertError } = await supabase
      .from('employees')
      .insert([employeeData])

    if (insertError) {
      console.error('Error restoring employee to active table:', insertError)
      throw new Error('Failed to restore employee')
    }

    // 4. Delete from inactive_employees table
    const { error: deleteError } = await supabase
      .from('inactive_employees')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting from inactive table:', deleteError)
      throw new Error('Failed to remove from inactive table')
    }

    // Actualizar timestamp de última sincronización
    if (typeof window !== 'undefined') {
      localStorage.setItem('hgen_last_sync', new Date().toISOString())
    }
  },

  async hardDeleteEmployee(id: string): Promise<void> {
    // Permanent deletion - cannot be recovered
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error permanently deleting employee:', error)
      throw new Error('Failed to permanently delete employee')
    }

    // Actualizar timestamp de última sincronización
    if (typeof window !== 'undefined') {
      localStorage.setItem('hgen_last_sync', new Date().toISOString())
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

    // Actualizar timestamp de última sincronización
    if (typeof window !== 'undefined') {
      localStorage.setItem('hgen_last_sync', new Date().toISOString())
    }
  },

  async updateSchedule(id: string, updates: Partial<Schedule>): Promise<void> {
    const dbUpdates: any = {}
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate
    if (updates.days !== undefined) dbUpdates.days = updates.days
    if (updates.branchCode !== undefined) dbUpdates.branch_code = updates.branchCode
    if (updates.division !== undefined) dbUpdates.division = updates.division
    dbUpdates.updated_at = new Date().toISOString()

    const { error } = await supabase
      .from('schedules')
      .update(dbUpdates)
      .eq('id', id)

    if (error) {
      console.error('Error updating schedule:', error)
      throw new Error('Failed to update schedule')
    }

    // Actualizar timestamp de última sincronización
    if (typeof window !== 'undefined') {
      localStorage.setItem('hgen_last_sync', new Date().toISOString())
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

    // Actualizar timestamp de última sincronización
    if (typeof window !== 'undefined') {
      localStorage.setItem('hgen_last_sync', new Date().toISOString())
    }
  },

  // Clear operations
  async clearAllSchedules(): Promise<void> {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (error) {
      console.error('Error clearing schedules:', error)
      throw new Error('Failed to clear schedules')
    }
  },

  async clearAllData(): Promise<void> {
    const { error: schedulesError } = await supabase
      .from('schedules')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (schedulesError) {
      console.error('Error clearing schedules:', schedulesError)
    }

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
  },

  /**
   * Migra datos existentes desde localStorage hacia Supabase una sola vez.
   * Se salta si ya se migró o si Supabase ya tiene datos.
   */
  async migrateFromLocalIfNeeded(): Promise<{ employeesMigrated: number; schedulesMigrated: number }> {
    if (typeof window === 'undefined') return { employeesMigrated: 0, schedulesMigrated: 0 }

    const MIGRATION_FLAG = 'hgen_migrated_to_supabase'
    if (localStorage.getItem(MIGRATION_FLAG) === '1') {
      return { employeesMigrated: 0, schedulesMigrated: 0 }
    }

    try {
      // Verificar si Supabase ya tiene datos
      const [{ data: empProbe, error: empErr }, { data: schProbe, error: schErr }] = await Promise.all([
        supabase.from('employees').select('id').limit(1),
        supabase.from('schedules').select('id').limit(1),
      ])

      if (empErr || schErr) {
        console.warn('Skip migration: probe failed', empErr || schErr)
      }

      const hasServerData = (empProbe && empProbe.length > 0) || (schProbe && schProbe.length > 0)
      if (hasServerData) {
        localStorage.setItem(MIGRATION_FLAG, '1')
        return { employeesMigrated: 0, schedulesMigrated: 0 }
      }

      // Leer de localStorage
      const localEmployeesRaw = localStorage.getItem('hgen_employees')
      const localSchedulesRaw = localStorage.getItem('hgen_schedules')
      const localEmployees: Employee[] = localEmployeesRaw ? JSON.parse(localEmployeesRaw) : []
      const localSchedules: Schedule[] = localSchedulesRaw ? JSON.parse(localSchedulesRaw) : []

      let employeesMigrated = 0
      let schedulesMigrated = 0

      if (localEmployees.length > 0) {
        const { error } = await supabase
          .from('employees')
          .insert(localEmployees.map(mapEmployeeToDb))
        if (error) {
          console.error('Employee migration failed:', error)
        } else {
          employeesMigrated = localEmployees.length
        }
      }

      if (localSchedules.length > 0) {
        const { error } = await supabase
          .from('schedules')
          .insert(localSchedules.map(mapScheduleToDb))
        if (error) {
          console.error('Schedule migration failed:', error)
        } else {
          schedulesMigrated = localSchedules.length
        }
      }

      localStorage.setItem(MIGRATION_FLAG, '1')
      return { employeesMigrated, schedulesMigrated }
    } catch (e) {
      console.error('Migration error:', e)
      return { employeesMigrated: 0, schedulesMigrated: 0 }
    }
  },

  /**
   * Fuerza recarga de todos los datos desde Supabase.
   * Útil para solucionar problemas de sincronización.
   */
  async refreshFromSupabase(): Promise<{ employees: Employee[]; schedules: Schedule[] }> {
    console.log('🔄 Refrescando datos desde Supabase...')

    const employees = await this.getEmployees()
    const schedules = await this.getSchedules()

    // Actualizar timestamp de última sincronización
    if (typeof window !== 'undefined') {
      localStorage.setItem('hgen_last_sync', new Date().toISOString())
    }

    console.log(`✓ Datos refrescados: ${employees.length} empleados, ${schedules.length} horarios`)

    return { employees, schedules }
  },

  /**
   * Obtiene información de diagnóstico sobre la conexión y datos.
   */
  async getDiagnostics(): Promise<{
    supabaseUrl: string;
    isConnected: boolean;
    supabaseEmployees: number;
    supabaseSchedules: number;
    localEmployees: number;
    localSchedules: number;
    migrationFlag: boolean;
    lastSync: string | null;
  }> {
    if (typeof window === 'undefined') {
      return {
        supabaseUrl: 'N/A (SSR)',
        isConnected: false,
        supabaseEmployees: 0,
        supabaseSchedules: 0,
        localEmployees: 0,
        localSchedules: 0,
        migrationFlag: false,
        lastSync: null
      }
    }

    const MIGRATION_FLAG = 'hgen_migrated_to_supabase'
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'No configurada'

    // Obtener datos de Supabase (solo empleados activos)
    let supabaseEmployees = 0
    let supabaseSchedules = 0
    let isConnected = true

    try {
      const [empResult, schResult] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('schedules').select('id', { count: 'exact', head: true })
      ])

      supabaseEmployees = empResult.count || 0
      supabaseSchedules = schResult.count || 0
    } catch (error) {
      console.error('Error obteniendo diagnóstico de Supabase:', error)
      isConnected = false
    }

    // Obtener datos de localStorage
    const localEmployeesRaw = localStorage.getItem('hgen_employees')
    const localSchedulesRaw = localStorage.getItem('hgen_schedules')
    const localEmployees = localEmployeesRaw ? JSON.parse(localEmployeesRaw).length : 0
    const localSchedules = localSchedulesRaw ? JSON.parse(localSchedulesRaw).length : 0

    // Flag de migración
    const migrationFlag = localStorage.getItem(MIGRATION_FLAG) === '1'

    // Última sincronización
    const lastSync = localStorage.getItem('hgen_last_sync')

    return {
      supabaseUrl,
      isConnected,
      supabaseEmployees,
      supabaseSchedules,
      localEmployees,
      localSchedules,
      migrationFlag,
      lastSync
    }
  }
}
