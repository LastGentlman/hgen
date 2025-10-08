import { Employee, Schedule } from '@/types'
import { hybridEmployeeStorage, hybridScheduleStorage } from './hybrid-storage'

/**
 * Storage API con soporte híbrido offline/online
 *
 * Modo Híbrido:
 * - Todas las operaciones se guardan PRIMERO en localStorage (inmediato)
 * - Luego intenta sincronizar con Supabase (si hay conexión)
 * - Si no hay conexión, la operación se agrega a cola de pendientes
 * - Cuando vuelve conexión, se sincronizan automáticamente las operaciones pendientes
 *
 * ✅ Funciona 100% offline
 * ✅ Sincronización automática al volver online
 * ✅ Sin cambios en la API pública (drop-in replacement)
 */
export const storage = {
  // ==========================================
  // Employee operations
  // ==========================================

  async getEmployees(): Promise<Employee[]> {
    return await hybridEmployeeStorage.get()
  },

  async addEmployee(employee: Employee): Promise<void> {
    await hybridEmployeeStorage.add(employee)
  },

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<void> {
    await hybridEmployeeStorage.update(id, updates)
  },

  async deleteEmployee(id: string): Promise<void> {
    await hybridEmployeeStorage.delete(id)
  },

  // ==========================================
  // Schedule operations
  // ==========================================

  async getSchedules(): Promise<Schedule[]> {
    return await hybridScheduleStorage.get()
  },

  async addSchedule(schedule: Schedule): Promise<void> {
    await hybridScheduleStorage.add(schedule)
  },

  async updateSchedule(id: string, updates: Partial<Schedule>): Promise<void> {
    await hybridScheduleStorage.update(id, updates)
  },

  async deleteSchedule(id: string): Promise<void> {
    await hybridScheduleStorage.delete(id)
  },

  // ==========================================
  // Clear operations
  // ==========================================

  async clearAllSchedules(): Promise<void> {
    const schedules = await hybridScheduleStorage.get()

    // Eliminar todos de la caché
    if (typeof window !== 'undefined') {
      localStorage.setItem('hgen_schedules', JSON.stringify([]))
    }

    // Intentar eliminar de Supabase (sin agregar a cola si falla)
    try {
      const { supabase } = await import('./supabase')
      await supabase
        .from('schedules')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
    } catch (error) {
      console.error('Error clearing schedules from Supabase:', error)
    }
  },

  async clearAllData(): Promise<void> {
    // Eliminar todo del caché
    if (typeof window !== 'undefined') {
      localStorage.setItem('hgen_employees', JSON.stringify([]))
      localStorage.setItem('hgen_schedules', JSON.stringify([]))
    }

    // Intentar eliminar de Supabase (sin agregar a cola si falla)
    try {
      const { supabase } = await import('./supabase')

      await supabase
        .from('schedules')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      await supabase
        .from('employees')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
    } catch (error) {
      console.error('Error clearing data from Supabase:', error)
    }
  },

  // ==========================================
  // Export/Import
  // ==========================================

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
        for (const emp of data.employees) {
          await this.addEmployee(emp)
        }
      }

      if (data.schedules && Array.isArray(data.schedules)) {
        for (const sch of data.schedules) {
          await this.addSchedule(sch)
        }
      }

      return { success: true, message: 'Data imported successfully' }
    } catch (error) {
      console.error('Error parsing JSON:', error)
      return { success: false, message: 'Invalid JSON data' }
    }
  },

  // ==========================================
  // Sync operations (new)
  // ==========================================

  /**
   * Sincroniza datos desde Supabase hacia la caché local
   * Útil para refrescar datos después de reconectar
   */
  async syncFromServer(): Promise<void> {
    await Promise.all([
      hybridEmployeeStorage.syncFromServer(),
      hybridScheduleStorage.syncFromServer()
    ])
  }
}
