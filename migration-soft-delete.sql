-- Migration: Add soft-delete support to employees table
-- Run this in your Supabase SQL Editor

-- Add new columns for soft-delete
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create index for better performance on queries
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);

-- Update existing employees to be active (backward compatibility)
UPDATE employees
SET is_active = true
WHERE is_active IS NULL;

-- Verify changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'employees'
  AND column_name IN ('is_active', 'deleted_at');
