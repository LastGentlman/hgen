import { Employee, Schedule } from '@/types'
import { supabase } from './supabase'
import { syncQueue, notifySyncStatus } from './sync-queue'

const EMPLOYEES_KEY = 'hgen_employees'
const SCHEDULES_KEY = 'hgen_schedules'
const LAST_SYNC_KEY = 'hgen_last_sync'

/**
 * Mapeo de campos TypeScript a columnas de la base de datos
 */
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

/**
 * Verifica si hay conexión intentando un ping rápido a Supabase
 */
async function checkConnection(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('employees')
      .select('id')
      .limit(1)
      .maybeSingle()

    return !error || error.code !== 'PGRST301' // PGRST301 = no connection
  } catch {
    return false
  }
}

/**
 * Lee de localStorage
 */
function readFromCache<T>(key: string): T[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error(`Error reading from cache (${key}):`, error)
    return []
  }
}

/**
 * Escribe en localStorage
 */
function writeToCache<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.error(`Error writing to cache (${key}):`, error)
  }
}

/**
 * Actualiza el timestamp de última sincronización
 */
function updateLastSync(): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
}

/**
 * Obtiene el timestamp de última sincronización
 */
export function getLastSync(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(LAST_SYNC_KEY)
}

/**
 * Storage híbrido para empleados
 */
export const hybridEmployeeStorage = {
  /**
   * Lee empleados (siempre desde caché)
   */
  async get(): Promise<Employee[]> {
    return readFromCache<Employee>(EMPLOYEES_KEY)
  },

  /**
   * Agrega un empleado
   */
  async add(employee: Employee): Promise<void> {
    // 1. Guardar en caché (inmediato)
    const cache = readFromCache<Employee>(EMPLOYEES_KEY)
    cache.push(employee)
    writeToCache(EMPLOYEES_KEY, cache)

    // 2. Intentar sincronizar con Supabase
    const isOnline = await checkConnection()

    if (isOnline) {
      try {
        const { error } = await supabase
          .from('employees')
          .insert([mapEmployeeToDb(employee)])

        if (error) throw error
        updateLastSync()
      } catch (error) {
        console.error('Error syncing employee to Supabase:', error)
        syncQueue.enqueue({ type: 'add_employee', data: employee })
        notifySyncStatus('offline')
      }
    } else {
      syncQueue.enqueue({ type: 'add_employee', data: employee })
      notifySyncStatus('offline')
    }
  },

  /**
   * Actualiza un empleado
   */
  async update(id: string, updates: Partial<Employee>): Promise<void> {
    // 1. Actualizar caché
    const cache = readFromCache<Employee>(EMPLOYEES_KEY)
    const index = cache.findIndex(emp => emp.id === id)

    if (index !== -1) {
      cache[index] = { ...cache[index], ...updates }
      writeToCache(EMPLOYEES_KEY, cache)
    }

    // 2. Intentar sincronizar
    const isOnline = await checkConnection()

    if (isOnline) {
      try {
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

        if (error) throw error
        updateLastSync()
      } catch (error) {
        console.error('Error syncing employee update to Supabase:', error)
        syncQueue.enqueue({ type: 'update_employee', id, data: updates })
        notifySyncStatus('offline')
      }
    } else {
      syncQueue.enqueue({ type: 'update_employee', id, data: updates })
      notifySyncStatus('offline')
    }
  },

  /**
   * Elimina un empleado
   */
  async delete(id: string): Promise<void> {
    // 1. Eliminar del caché
    const cache = readFromCache<Employee>(EMPLOYEES_KEY)
    const filtered = cache.filter(emp => emp.id !== id)
    writeToCache(EMPLOYEES_KEY, filtered)

    // 2. Intentar sincronizar
    const isOnline = await checkConnection()

    if (isOnline) {
      try {
        const { error } = await supabase
          .from('employees')
          .delete()
          .eq('id', id)

        if (error) throw error
        updateLastSync()
      } catch (error) {
        console.error('Error syncing employee deletion to Supabase:', error)
        syncQueue.enqueue({ type: 'delete_employee', id })
        notifySyncStatus('offline')
      }
    } else {
      syncQueue.enqueue({ type: 'delete_employee', id })
      notifySyncStatus('offline')
    }
  },

  /**
   * Sincroniza caché con Supabase (pull)
   */
  async syncFromServer(): Promise<void> {
    const isOnline = await checkConnection()
    if (!isOnline) return

    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error

      const employees = (data || []).map(mapEmployeeFromDb)
      writeToCache(EMPLOYEES_KEY, employees)
      updateLastSync()

      console.log(`✅ Sincronizados ${employees.length} empleados desde servidor`)
    } catch (error) {
      console.error('Error syncing employees from server:', error)
    }
  }
}

/**
 * Storage híbrido para horarios
 */
export const hybridScheduleStorage = {
  /**
   * Lee horarios (siempre desde caché)
   */
  async get(): Promise<Schedule[]> {
    return readFromCache<Schedule>(SCHEDULES_KEY)
  },

  /**
   * Agrega un horario
   */
  async add(schedule: Schedule): Promise<void> {
    // 1. Guardar en caché
    const cache = readFromCache<Schedule>(SCHEDULES_KEY)
    cache.push(schedule)
    writeToCache(SCHEDULES_KEY, cache)

    // 2. Intentar sincronizar
    const isOnline = await checkConnection()

    if (isOnline) {
      try {
        const { error } = await supabase
          .from('schedules')
          .insert([mapScheduleToDb(schedule)])

        if (error) throw error
        updateLastSync()
      } catch (error) {
        console.error('Error syncing schedule to Supabase:', error)
        syncQueue.enqueue({ type: 'add_schedule', data: schedule })
        notifySyncStatus('offline')
      }
    } else {
      syncQueue.enqueue({ type: 'add_schedule', data: schedule })
      notifySyncStatus('offline')
    }
  },

  /**
   * Actualiza un horario
   */
  async update(id: string, updates: Partial<Schedule>): Promise<void> {
    // 1. Actualizar caché
    const cache = readFromCache<Schedule>(SCHEDULES_KEY)
    const index = cache.findIndex(sch => sch.id === id)

    if (index !== -1) {
      cache[index] = { ...cache[index], ...updates, updatedAt: new Date().toISOString() }
      writeToCache(SCHEDULES_KEY, cache)
    }

    // 2. Intentar sincronizar
    const isOnline = await checkConnection()

    if (isOnline) {
      try {
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

        if (error) throw error
        updateLastSync()
      } catch (error) {
        console.error('Error syncing schedule update to Supabase:', error)
        syncQueue.enqueue({ type: 'update_schedule', id, data: updates })
        notifySyncStatus('offline')
      }
    } else {
      syncQueue.enqueue({ type: 'update_schedule', id, data: updates })
      notifySyncStatus('offline')
    }
  },

  /**
   * Elimina un horario
   */
  async delete(id: string): Promise<void> {
    // 1. Eliminar del caché
    const cache = readFromCache<Schedule>(SCHEDULES_KEY)
    const filtered = cache.filter(sch => sch.id !== id)
    writeToCache(SCHEDULES_KEY, filtered)

    // 2. Intentar sincronizar
    const isOnline = await checkConnection()

    if (isOnline) {
      try {
        const { error } = await supabase
          .from('schedules')
          .delete()
          .eq('id', id)

        if (error) throw error
        updateLastSync()
      } catch (error) {
        console.error('Error syncing schedule deletion to Supabase:', error)
        syncQueue.enqueue({ type: 'delete_schedule', id })
        notifySyncStatus('offline')
      }
    } else {
      syncQueue.enqueue({ type: 'delete_schedule', id })
      notifySyncStatus('offline')
    }
  },

  /**
   * Sincroniza caché con Supabase (pull)
   */
  async syncFromServer(): Promise<void> {
    const isOnline = await checkConnection()
    if (!isOnline) return

    try {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const schedules = (data || []).map(mapScheduleFromDb)
      writeToCache(SCHEDULES_KEY, schedules)
      updateLastSync()

      console.log(`✅ Sincronizados ${schedules.length} horarios desde servidor`)
    } catch (error) {
      console.error('Error syncing schedules from server:', error)
    }
  }
}
