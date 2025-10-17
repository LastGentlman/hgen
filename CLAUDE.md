# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HGen is a Next.js 14 work schedule generator for 24/7 operations built with TypeScript, Tailwind CSS, and Supabase for data persistence. The application manages bi-weekly schedule cycles (15-day quincenas) with 3 shifts per day (Morning, Afternoon, Night), supporting multiple branches, divisions, and advanced features like shift coverage tracking and CSV import/export.

## Development Commands

```bash
npm run dev      # Start development server on localhost:3000
npm run build    # Create production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture

### Data Flow Pattern
The app uses async Supabase operations through a centralized storage module (`lib/storage.ts`). All data mutations are asynchronous and trigger React state updates in the main page component.

Key pattern:
1. Component calls async `storage.*` method (returns Promise)
2. Storage communicates with Supabase database via REST API
3. Component awaits response and calls update handler
4. Update handler re-fetches from storage and updates state
5. State propagates to child components via props

**IMPORTANT**: All storage operations are async. Use `await` when calling storage methods.

### Core Type System

Main types defined in `types/index.ts`:

- **Employee**: Contains id, name, availableDays, assignedShift (morning/afternoon/night), branchCode (001/002/003), division (super/gasolinera/restaurant/limpieza), and shiftRotationCount
- **Shift**: Individual work assignment with startTime, endTime, employeeId, date, status (assigned/rest/vacation/sick/absent/covering/empty), position (C1/C2/C3/EXT), and optional coverageInfo
- **ScheduleDay**: Container for all shifts on a specific date with date, dayName, and shifts array
- **Schedule**: Bi-weekly schedule containing id, name, startDate, endDate, days array, branchCode, division, and timestamps
- **ShiftTemplate**: Reusable shift pattern with startTime, endTime, dayOfWeek
- **ShiftStatus**: Union type for shift states - used extensively for visual indicators and business logic
- **CoverageInfo**: Tracks when employees cover other shifts/branches (type: 'shift' | 'branch', targetShift, targetBranch)

### Component Architecture

The app uses a tabbed interface with lazy-loaded components:

1. **EmployeeManager** (`components/EmployeeManager.tsx`): CRUD operations for employees filtered by branch/division context
2. **HistoryManager** (`components/HistoryManager.tsx`): Browse all schedules, create new schedules, import/export CSV
3. **GridView** (`components/GridView.tsx`): Main schedule editing interface with drag-and-drop, status management, and visual coverage indicators (desktop only)

All components are client-side (`'use client'`) and use dynamic imports with loading states for performance.

### Organizational Context

The app supports multi-branch, multi-division operations:

- **Branch Codes**: 001, 002, 003 (selected via dropdown in header)
- **Divisions**: super, gasolinera, restaurant, limpieza (note: branch 002 has no restaurant)
- **Context Filtering**: Employees and schedules are filtered by active branch/division context throughout the app
- **Shift Assignments**: Employees have a primary `assignedShift` that tracks their usual shift type

### Schedule Generation

Schedules are generated using `generateWeeklySchedule()` in `lib/utils.ts`:
- Creates either 15-day cycles (quincenas: days 1-15 or 16-end of month) based on start date
- If start date is 1st: creates days 1-15
- If start date is 16th: creates days 16 to last day of month
- Applies ShiftTemplate rules to create 3 shifts per day
- Default templates in `getDefaultShiftTemplates()`:
  - Morning Shift (TURNO 1): 07:00 - 15:00
  - Afternoon Shift (TURNO 2): 15:00 - 23:00
  - Night Shift (TURNO 3): 23:00 - 07:00

### Data Persistence

**Supabase Database** (PostgreSQL):
- Tables: `employees`, `schedules`, `schedule_edits`, `schedule_metrics`
- Schema defined in `supabase-schema.sql`
- Client configured in `lib/supabase.ts` with env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Migration Support**:
- One-time automatic migration from localStorage to Supabase via `storage.migrateFromLocalIfNeeded()` called in `app/page.tsx:42`
- Migration flag stored in localStorage to prevent re-runs

**Field Mapping**: TypeScript camelCase fields map to PostgreSQL snake_case columns (e.g., `availableDays` ↔ `available_days`, `branchCode` ↔ `branch_code`)

### CSV Import/Export

Robust CSV handling in `lib/exportUtils.ts` and `lib/csvParser.ts`:

**Export Format** (10 columns):
- Fecha, Día, Turno, Horario, Empleado, Posición, Estado, CoverageTipo, CoverageSucursal, CoverageTurno
- Coverage columns populated only when status = 'covering'
- Supports both single schedule and multi-schedule (with NombreHorario column) exports

**Import Features**:
- Automatic quincenal detection and splitting (e.g., schedules spanning days 1-31 are split into "1ra Quincena" and "2da Quincena")
- Flexible time parsing (handles "07:00-15:00", "7-15", "07.00-15.00", Unicode dashes)
- Position extraction from employee names (e.g., "KARLA 1" → name: "KARLA", position: "C1")
- Automatic `assignedShift` inference from employee's most common shift in imported schedule
- Coverage info reconstruction from CSV columns
- Validation of coverage (employees cannot cover their own shift)

## Key Implementation Details

### Shift Architecture
- **1 Shift = 1 Employee Assignment**: Each shift in the `shifts` array represents a single employee's assignment to a time slot
- Multiple employees can work the same time slot → multiple shift objects with same startTime/endTime but different employeeId
- CSV import creates NEW shifts for each row rather than updating existing ones

### Shift Status System
Seven status values with distinct visual indicators:
- `assigned`: Standard work assignment (green)
- `rest`: Scheduled day off (blue)
- `vacation`: Vacation time (purple)
- `sick`: Sick leave (yellow)
- `absent`: Absence (red)
- `covering`: Employee covering another shift/branch (orange, requires coverageInfo)
- `empty`: Unassigned shift (gray)

### Coverage Tracking
When status = 'covering', `coverageInfo` specifies:
- `type: 'shift'`: Covering another shift in same branch (targetShift: 'morning' | 'afternoon' | 'night')
- `type: 'branch'`: Covering a shift in another branch (targetBranch: '001' | '002' | '003', targetShift)

### Time Handling
- All times stored as 24-hour "HH:MM" strings
- Display uses `formatTime()` for 12-hour format with AM/PM
- Overnight shifts detected via `calculateShiftDuration()` (adds 24 hours when endTime < startTime)
- Time canonicalization in imports ensures consistency (aliases like "06:00-14:00" → "07:00-15:00")

### Performance Optimizations
- Lazy component loading with `next/dynamic` and custom loading states (app/page.tsx:12-25)
- Idle-time preloading via `requestIdleCallback` (app/page.tsx:100-117)
- Dynamic imports for heavy libraries (jsPDF, html2canvas) in `lib/exportUtils.ts:144`

## Customization

### Modifying Default Shift Templates
Edit `getDefaultShiftTemplates()` in `lib/utils.ts:131` to change the 24/7 shift schedule. Currently configured for 3 shifts per day across all 7 days of the week.

### Adding Export Formats
Export utilities in `lib/exportUtils.ts`:
- `exportToPDF()`: Lazy-loads html2canvas and jsPDF
- `exportToCSV()`: Generates CSV with UTF-8 BOM for Excel compatibility
- `exportAllSchedulesToCSV()`: Exports multiple schedules to single CSV
- `exportToJSON()`: JSON export for data backup

### Extending Shift Status
To add a new shift status:
1. Add to `ShiftStatus` union type in `types/index.ts:22`
2. Define color/style in `lib/statusStyles.ts`
3. Update UI components that render status (GridView, SchedulePreviewSVG)

## Deployment

Configured for Vercel deployment via `vercel.json`.

**Required Environment Variables** (in `.env.local` or Vercel dashboard):
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**Setup Instructions**: See `SUPABASE_SETUP.md` for complete Supabase configuration guide.
