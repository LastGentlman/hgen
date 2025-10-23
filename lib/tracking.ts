import { supabase, ScheduleEdit } from './supabase'
import { Shift } from '@/types'

/**
 * Sistema de tracking para ML futuro
 * Registra todas las ediciones que hace el usuario en los horarios
 * para aprender patrones y mejorar la generación automática
 */

export type EditType = 'assign' | 'unassign' | 'reassign' | 'status_change' | 'coverage_change'

/**
 * Registra una edición de shift en la base de datos
 */
export async function trackShiftEdit(
  scheduleId: string,
  shiftId: string,
  editType: EditType,
  originalValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null
): Promise<void> {
  try {
    const { error } = await supabase
      .from('schedule_edits')
      .insert([{
        schedule_id: scheduleId,
        shift_id: shiftId,
        edit_type: editType,
        original_value: originalValue,
        new_value: newValue,
      }])

    if (error) {
      console.error('Error tracking shift edit:', error)
    }
  } catch (error) {
    console.error('Exception tracking shift edit:', error)
  }
}

/**
 * Helper para trackear asignación de empleado a turno
 */
export async function trackEmployeeAssignment(
  scheduleId: string,
  shiftId: string,
  previousEmployeeId: string | undefined,
  newEmployeeId: string | undefined,
  shiftDetails?: Partial<Shift>
): Promise<void> {
  let editType: EditType

  if (!previousEmployeeId && newEmployeeId) {
    editType = 'assign'
  } else if (previousEmployeeId && !newEmployeeId) {
    editType = 'unassign'
  } else if (previousEmployeeId && newEmployeeId && previousEmployeeId !== newEmployeeId) {
    editType = 'reassign'
  } else {
    // No hay cambio real
    return
  }

  await trackShiftEdit(
    scheduleId,
    shiftId,
    editType,
    { employeeId: previousEmployeeId, ...shiftDetails },
    { employeeId: newEmployeeId, ...shiftDetails }
  )
}

/**
 * Helper para trackear cambio de estado de turno
 */
export async function trackStatusChange(
  scheduleId: string,
  shiftId: string,
  previousStatus: string | undefined,
  newStatus: string,
  employeeId?: string
): Promise<void> {
  await trackShiftEdit(
    scheduleId,
    shiftId,
    'status_change',
    { status: previousStatus, employeeId },
    { status: newStatus, employeeId }
  )
}

/**
 * Helper para trackear cambio de cobertura
 */
export async function trackCoverageChange(
  scheduleId: string,
  shiftId: string,
  previousCoverage: Record<string, unknown> | null,
  newCoverage: Record<string, unknown> | null
): Promise<void> {
  await trackShiftEdit(
    scheduleId,
    shiftId,
    'coverage_change',
    previousCoverage,
    newCoverage
  )
}

/**
 * Obtiene las ediciones de un schedule específico
 */
export async function getScheduleEdits(scheduleId: string): Promise<ScheduleEdit[]> {
  try {
    const { data, error } = await supabase
      .from('schedule_edits')
      .select('*')
      .eq('schedule_id', scheduleId)
      .order('edited_at', { ascending: true })

    if (error) {
      console.error('Error fetching schedule edits:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Exception fetching schedule edits:', error)
    return []
  }
}

/**
 * Obtiene estadísticas de ediciones para análisis ML
 */
export async function getEditStatistics(scheduleId: string) {
  const edits = await getScheduleEdits(scheduleId)

  return {
    totalEdits: edits.length,
    editsByType: {
      assign: edits.filter(e => e.edit_type === 'assign').length,
      unassign: edits.filter(e => e.edit_type === 'unassign').length,
      reassign: edits.filter(e => e.edit_type === 'reassign').length,
      statusChange: edits.filter(e => e.edit_type === 'status_change').length,
      coverageChange: edits.filter(e => e.edit_type === 'coverage_change').length,
    },
    mostEditedShifts: getMostEditedShifts(edits),
  }
}

function getMostEditedShifts(edits: ScheduleEdit[]): Array<{shiftId: string, count: number}> {
  const shiftCounts = new Map<string, number>()

  edits.forEach(edit => {
    const current = shiftCounts.get(edit.shift_id) || 0
    shiftCounts.set(edit.shift_id, current + 1)
  })

  return Array.from(shiftCounts.entries())
    .map(([shiftId, count]) => ({ shiftId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

/**
 * Registra métricas completas de un schedule al finalizarlo
 */
export async function recordScheduleMetrics(
  scheduleId: string,
  totalShifts: number,
  assignedShifts: number,
  completionTimeMinutes?: number,
  userSatisfaction?: number
): Promise<void> {
  try {
    const edits = await getScheduleEdits(scheduleId)

    const { error } = await supabase
      .from('schedule_metrics')
      .insert([{
        schedule_id: scheduleId,
        total_shifts: totalShifts,
        assigned_shifts: assignedShifts,
        edit_count: edits.length,
        completion_time_minutes: completionTimeMinutes,
        user_satisfaction: userSatisfaction,
      }])

    if (error) {
      console.error('Error recording schedule metrics:', error)
    }
  } catch (error) {
    console.error('Exception recording schedule metrics:', error)
  }
}

/**
 * Registra metadatos de creación de un horario.
 * No es crítico: si falla (por esquema desactualizado), se ignora.
 */
export async function recordScheduleCreationMeta(
  scheduleId: string,
  creationSource: 'rotation' | 'ai' | 'template',
  shiftPreset: string,
  totalShifts: number,
  assignedShifts: number
): Promise<void> {
  try {
    const { error } = await supabase
      .from('schedule_metrics')
      .insert([
        {
          schedule_id: scheduleId,
          total_shifts: totalShifts,
          assigned_shifts: assignedShifts,
          edit_count: 0,
          // Campos opcionales (pueden no existir aún en BD)
          creation_source: creationSource as any,
          shift_preset: shiftPreset as any,
        } as any,
      ])

    if (error) {
      // Silencioso: no bloquear flujo de creación por telemetría
      console.warn('recordScheduleCreationMeta failed:', error.message)
    }
  } catch (error) {
    console.warn('recordScheduleCreationMeta exception:', error)
  }
}
