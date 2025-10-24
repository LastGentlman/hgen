-- HGen Database Schema for Supabase
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Tabla: employees
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  department TEXT,
  available_days TEXT[] NOT NULL DEFAULT '{}',
  email TEXT,
  phone TEXT,
  assigned_shift TEXT CHECK (assigned_shift IN ('morning', 'afternoon', 'night', 'unassigned')),
  branch_code TEXT CHECK (branch_code IN ('001', '002', '003')),
  division TEXT CHECK (division IN ('super', 'gasolinera', 'restaurant', 'limpieza')),
  shift_rotation_count INTEGER DEFAULT 0,
  -- Rotation/Audit fields
  night_eligible BOOLEAN DEFAULT true,
  last_night_quincena_start DATE,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Tabla: schedules
-- ============================================
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days JSONB NOT NULL DEFAULT '[]',
  branch_code TEXT CHECK (branch_code IN ('001', '002', '003')),
  division TEXT CHECK (division IN ('super', 'gasolinera', 'restaurant', 'limpieza')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Tabla: schedule_edits
-- Para trackear correcciones del usuario (ML futuro)
-- ============================================
CREATE TABLE IF NOT EXISTS schedule_edits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  shift_id TEXT NOT NULL,
  edit_type TEXT NOT NULL CHECK (edit_type IN ('assign', 'unassign', 'reassign', 'status_change', 'coverage_change')),
  original_value JSONB,
  new_value JSONB,
  edited_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Tabla: schedule_metrics
-- Para estadísticas de calidad de horarios
-- ============================================
CREATE TABLE IF NOT EXISTS schedule_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  total_shifts INTEGER NOT NULL,
  assigned_shifts INTEGER NOT NULL,
  edit_count INTEGER DEFAULT 0,
  completion_time_minutes INTEGER,
  user_satisfaction INTEGER CHECK (user_satisfaction BETWEEN 1 AND 5),
  -- Campos opcionales para telemetría de creación
  creation_source TEXT CHECK (creation_source IN ('rotation','ai','template')),
  shift_preset TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Índices para mejorar performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_employees_branch ON employees(branch_code);
CREATE INDEX IF NOT EXISTS idx_employees_division ON employees(division);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_night_eligible ON employees(night_eligible);
CREATE INDEX IF NOT EXISTS idx_schedules_dates ON schedules(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_schedules_branch ON schedules(branch_code);
CREATE INDEX IF NOT EXISTS idx_schedule_edits_schedule ON schedule_edits(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_metrics_schedule ON schedule_metrics(schedule_id);

-- ============================================
-- Función para actualizar updated_at automáticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Triggers para updated_at
-- ============================================
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Tabla: inactive_employees (soft delete archive)
-- ============================================
CREATE TABLE IF NOT EXISTS inactive_employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  department TEXT,
  available_days TEXT[] NOT NULL DEFAULT '{}',
  email TEXT,
  phone TEXT,
  assigned_shift TEXT CHECK (assigned_shift IN ('morning', 'afternoon', 'night', 'unassigned')),
  branch_code TEXT CHECK (branch_code IN ('001', '002', '003')),
  division TEXT CHECK (division IN ('super', 'gasolinera', 'restaurant', 'limpieza')),
  shift_rotation_count INTEGER DEFAULT 0,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inactive_employees_branch ON inactive_employees(branch_code);
CREATE INDEX IF NOT EXISTS idx_inactive_employees_division ON inactive_employees(division);
CREATE INDEX IF NOT EXISTS idx_inactive_employees_deleted ON inactive_employees(deleted_at);

CREATE TRIGGER update_inactive_employees_updated_at
  BEFORE UPDATE ON inactive_employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Tabla: employee_quincena_stats (rotation memory)
-- ============================================
CREATE TABLE IF NOT EXISTS employee_quincena_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  branch_code TEXT CHECK (branch_code IN ('001', '002', '003')),
  division TEXT CHECK (division IN ('super', 'gasolinera', 'restaurant', 'limpieza')),
  quincena_start DATE NOT NULL,
  quincena_end DATE NOT NULL,
  assigned_shift TEXT CHECK (assigned_shift IN ('morning', 'afternoon', 'night', 'unassigned')),
  pre_night_day_shift TEXT CHECK (pre_night_day_shift IN ('morning', 'afternoon')),
  rest_days INTEGER DEFAULT 0,
  total_night_shifts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, quincena_start)
);

CREATE INDEX IF NOT EXISTS idx_quincena_stats_employee ON employee_quincena_stats(employee_id);
CREATE INDEX IF NOT EXISTS idx_quincena_stats_quincena ON employee_quincena_stats(quincena_start);

-- ============================================
-- Row Level Security (RLS)
-- Por defecto, permitir todas las operaciones
-- Ajusta según tus necesidades de seguridad
-- ============================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE inactive_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_quincena_stats ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para desarrollo (ajustar en producción)
CREATE POLICY "Enable all operations for employees" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for schedules" ON schedules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for schedule_edits" ON schedule_edits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for schedule_metrics" ON schedule_metrics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for inactive_employees" ON inactive_employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for employee_quincena_stats" ON employee_quincena_stats FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Vista para análisis de ML (opcional)
-- ============================================
CREATE OR REPLACE VIEW schedule_analysis AS
SELECT
  s.id AS schedule_id,
  s.name,
  s.start_date,
  s.end_date,
  sm.total_shifts,
  sm.assigned_shifts,
  sm.edit_count,
  sm.completion_time_minutes,
  sm.user_satisfaction,
  COUNT(se.id) AS total_edits,
  jsonb_agg(DISTINCT se.edit_type) AS edit_types
FROM schedules s
LEFT JOIN schedule_metrics sm ON s.id = sm.schedule_id
LEFT JOIN schedule_edits se ON s.id = se.schedule_id
GROUP BY s.id, s.name, s.start_date, s.end_date, sm.total_shifts, sm.assigned_shifts,
         sm.edit_count, sm.completion_time_minutes, sm.user_satisfaction;
