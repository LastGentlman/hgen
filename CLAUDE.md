# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HGen is a Next.js 14 work schedule generator for 24/7 operations that uses TypeScript, Tailwind CSS, and browser localStorage for data persistence. The application manages 15-day schedule cycles with 3 shifts per day (Morning, Afternoon, Night) and allows managers to assign employees, track availability, and export schedules to CSV/HTML formats.

## Development Commands

```bash
npm run dev      # Start development server on localhost:3000
npm run build    # Create production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture

### Data Flow Pattern
The app uses a centralized storage module (`lib/storage.ts`) that wraps localStorage operations. All data mutations flow through this module and trigger React state updates in the main page component (`app/page.tsx`).

Key pattern:
1. Component calls `storage.*` method
2. Storage updates localStorage
3. Component calls update handler
4. Update handler re-fetches from storage and updates state
5. State propagates to child components

### Core Type System

The application is built around four main types defined in `types/index.ts`:

- **Employee**: User data with availability constraints and max hours
- **Shift**: Individual work assignment with time, position, and optional employee assignment
- **ScheduleDay**: Container for all shifts on a specific date
- **Schedule**: Week-long schedule containing 7 ScheduleDay objects
- **ShiftTemplate**: Reusable shift pattern for schedule generation

### Component Architecture

The app uses a tabbed interface pattern with three main sections:

1. **EmployeeManager** (`components/EmployeeManager.tsx`): CRUD operations for employees with availability day selection
2. **ScheduleManager** (`components/ScheduleManager.tsx`): Creates weekly schedules from shift templates
3. **ScheduleView** (`components/ScheduleView.tsx`): Assigns employees to shifts, tracks completion progress, exports schedules

All components are client-side (`'use client'`) since the app requires browser localStorage access.

### Schedule Generation

Schedules are generated using `generateWeeklySchedule()` in `lib/utils.ts`:
- Takes a start date and generates 15 consecutive days
- Creates 15 ScheduleDay objects with dates
- Applies ShiftTemplate rules to create Shift objects for each day (3 shifts per day)
- Default templates defined in `getDefaultShiftTemplates()` (lib/utils.ts:111)
  - Morning Shift: 6:00 AM - 2:00 PM
  - Afternoon Shift: 2:00 PM - 10:00 PM
  - Night Shift: 10:00 PM - 6:00 AM (overnight shift)

### Data Persistence

All data is stored in browser localStorage under two keys:
- `hgen_employees`: Array of Employee objects
- `hgen_schedules`: Array of Schedule objects

SSR protection: All storage operations check `typeof window === 'undefined'` to prevent errors during Next.js server rendering.

## Customization

### Modifying Default Shift Templates
Edit `getDefaultShiftTemplates()` in `lib/utils.ts:111` to change the 24/7 shift schedule. Currently configured for 3 shifts per day across all 7 days of the week. Each template requires: `startTime`, `endTime`, `position`, `dayOfWeek`.

### Adding Export Formats
Export logic is in `lib/utils.ts`:
- `exportToCSV()`: Generates CSV from schedule data
- `downloadFile()`: Handles browser file downloads
- Add new export functions following these patterns

## Key Implementation Details

- **Employee Availability**: All employees are available all 7 days by default (24/7 operation)
- **15-Day Cycles**: Schedules span 15 consecutive days instead of 7-day weeks
- **3 Shifts Per Day**: Every day has Morning (6-2), Afternoon (2-10), and Night (10-6) shifts
- **Employee Filtering**: When assigning shifts, only employees with matching `availableDays` appear in dropdowns (ScheduleView.tsx)
- **Progress Tracking**: Completion percentage calculated as `(assignedShifts / totalShifts) * 100`
- **Time Formatting**: All time values stored as 24-hour strings (HH:MM), displayed as 12-hour with `formatTime()` utility
- **Overnight Shifts**: `calculateShiftDuration()` handles shifts crossing midnight by adding 24 hours when end < start (Night shift: 22:00-06:00)

## Deployment

Configured for Vercel deployment via `vercel.json`. No environment variables required for core functionality since the app uses client-side storage only.
