import { createClient } from '@supabase/supabase-js'

// Validar que las variables de entorno estén configuradas
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan las credenciales de Supabase. Por favor configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en tu archivo .env.local'
  )
}

// Crear cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // No necesitamos autenticación por ahora
    autoRefreshToken: false,
  },
})

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
