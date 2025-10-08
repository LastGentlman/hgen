import { syncQueue, notifySyncStatus, type QueuedOperation } from './sync-queue'
import { supabase } from './supabase'
import { Employee, Schedule } from '@/types'

/**
 * Mapeo de campos (igual que hybrid-storage)
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

/**
 * Procesa una operación pendiente
 */
async function processOperation(op: QueuedOperation): Promise<boolean> {
  try {
    switch (op.operation.type) {
      case 'add_employee': {
        const { error } = await supabase
          .from('employees')
          .insert([mapEmployeeToDb(op.operation.data)])
        return !error
      }

      case 'update_employee': {
        const { id, data } = op.operation
        const dbUpdates: any = {}

        if (data.name !== undefined) dbUpdates.name = data.name
        if (data.department !== undefined) dbUpdates.department = data.department
        if (data.availableDays !== undefined) dbUpdates.available_days = data.availableDays
        if (data.email !== undefined) dbUpdates.email = data.email
        if (data.phone !== undefined) dbUpdates.phone = data.phone
        if (data.assignedShift !== undefined) dbUpdates.assigned_shift = data.assignedShift
        if (data.branchCode !== undefined) dbUpdates.branch_code = data.branchCode
        if (data.division !== undefined) dbUpdates.division = data.division
        if (data.shiftRotationCount !== undefined) dbUpdates.shift_rotation_count = data.shiftRotationCount

        const { error } = await supabase
          .from('employees')
          .update(dbUpdates)
          .eq('id', id)
        return !error
      }

      case 'delete_employee': {
        const { error } = await supabase
          .from('employees')
          .delete()
          .eq('id', op.operation.id)
        return !error
      }

      case 'add_schedule': {
        const { error } = await supabase
          .from('schedules')
          .insert([mapScheduleToDb(op.operation.data)])
        return !error
      }

      case 'update_schedule': {
        const { id, data } = op.operation
        const dbUpdates: any = {}

        if (data.name !== undefined) dbUpdates.name = data.name
        if (data.startDate !== undefined) dbUpdates.start_date = data.startDate
        if (data.endDate !== undefined) dbUpdates.end_date = data.endDate
        if (data.days !== undefined) dbUpdates.days = data.days
        if (data.branchCode !== undefined) dbUpdates.branch_code = data.branchCode
        if (data.division !== undefined) dbUpdates.division = data.division
        dbUpdates.updated_at = new Date().toISOString()

        const { error } = await supabase
          .from('schedules')
          .update(dbUpdates)
          .eq('id', id)
        return !error
      }

      case 'delete_schedule': {
        const { error } = await supabase
          .from('schedules')
          .delete()
          .eq('id', op.operation.id)
        return !error
      }

      default:
        return false
    }
  } catch (error) {
    console.error('Error processing operation:', error)
    return false
  }
}

/**
 * Procesa toda la cola de sincronización
 */
export async function processSyncQueue(): Promise<void> {
  const queue = syncQueue.getAll()

  if (queue.length === 0) {
    notifySyncStatus('idle')
    return
  }

  console.log(`🔄 Procesando ${queue.length} operaciones pendientes...`)
  notifySyncStatus('syncing')

  let successCount = 0
  let failureCount = 0

  for (const op of queue) {
    const success = await processOperation(op)

    if (success) {
      syncQueue.dequeue(op.id)
      successCount++
      console.log(`✅ Operación sincronizada: ${op.operation.type}`)
    } else {
      syncQueue.incrementRetry(op.id)
      failureCount++
      console.error(`❌ Fallo en operación: ${op.operation.type} (intento ${op.retries + 1})`)
    }
  }

  // Limpiar operaciones que superaron el máximo de reintentos
  syncQueue.cleanupFailed()

  // Actualizar estado
  const remainingCount = syncQueue.size()

  if (remainingCount === 0) {
    notifySyncStatus('idle')
    console.log(`✅ Sincronización completa: ${successCount} operaciones`)
  } else {
    notifySyncStatus('error')
    console.warn(`⚠️ Sincronización parcial: ${successCount} exitosas, ${failureCount} fallidas, ${remainingCount} pendientes`)
  }
}
