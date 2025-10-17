-- Migration: Create separate table for inactive employees
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. Create inactive_employees table
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

-- ============================================
-- 2. Create indexes for inactive_employees
-- ============================================
CREATE INDEX IF NOT EXISTS idx_inactive_employees_branch ON inactive_employees(branch_code);
CREATE INDEX IF NOT EXISTS idx_inactive_employees_division ON inactive_employees(division);
CREATE INDEX IF NOT EXISTS idx_inactive_employees_deleted ON inactive_employees(deleted_at);

-- ============================================
-- 3. Migrate existing inactive employees
-- ============================================
INSERT INTO inactive_employees (
  id, name, department, available_days, email, phone,
  assigned_shift, branch_code, division, shift_rotation_count,
  deleted_at, created_at, updated_at
)
SELECT
  id, name, department, available_days, email, phone,
  assigned_shift, branch_code, division, shift_rotation_count,
  COALESCE(deleted_at, NOW()), created_at, updated_at
FROM employees
WHERE is_active = false
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. Delete migrated employees from main table
-- ============================================
DELETE FROM employees WHERE is_active = false;

-- ============================================
-- 5. Optional: Remove is_active and deleted_at columns
--    (commented out for safety - uncomment if needed)
-- ============================================
-- ALTER TABLE employees DROP COLUMN IF EXISTS is_active;
-- ALTER TABLE employees DROP COLUMN IF EXISTS deleted_at;
-- DROP INDEX IF EXISTS idx_employees_active;

-- ============================================
-- 6. Enable RLS for inactive_employees
-- ============================================
ALTER TABLE inactive_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for inactive_employees"
  ON inactive_employees FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 7. Add trigger for updated_at
-- ============================================
CREATE TRIGGER update_inactive_employees_updated_at
  BEFORE UPDATE ON inactive_employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Verification query
-- ============================================
SELECT
  'employees' as table_name, COUNT(*) as count
FROM employees
UNION ALL
SELECT
  'inactive_employees' as table_name, COUNT(*) as count
FROM inactive_employees;
