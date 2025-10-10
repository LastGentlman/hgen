import { createClient } from '@supabase/supabase-js'

// Variables de entorno (pueden faltar en build)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Crear cliente sólo si hay credenciales; si no, exportar stub que lanza al usarse
let supabaseClient: ReturnType<typeof createClient> | null = null

if (supabaseUrl && supabaseAnonKey) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export const supabase = (supabaseClient ?? (new Proxy({}, {
  get() {
    throw new Error('Faltan las credenciales de Supabase. Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local')
  }
}) as any))

// Tipos para las tablas de Supabase (Database Types)
export type ScheduleEdit = {
  id: string
  schedule_id: string
  shift_id: string
  edit_type: 'assign' | 'unassign' | 'reassign' | 'status_change' | 'coverage_change'
  original_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  edited_at: string
}

export type ScheduleMetrics = {
  id: string
  schedule_id: string
  total_shifts: number
  assigned_shifts: number
  edit_count: number
  completion_time_minutes: number | null
  user_satisfaction: number | null
  created_at: string
}
