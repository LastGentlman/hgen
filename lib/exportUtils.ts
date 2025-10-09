/**
 * Export utilities with lazy-loaded heavy dependencies
 * This module uses dynamic imports to avoid bundling jsPDF and html2canvas in the main chunk
 */

import type { Schedule, Employee, Shift, PositionType } from '@/types'
import type { ParsedCSVData } from '@/lib/csvParser'
import { showWarningHtml } from '@/lib/sweetalert'

/**
 * Map shift times to shiftType
 * Examples:
 *   "07:00", "15:00" -> "morning"
 *   "15:00", "23:00" -> "afternoon"
 *   "23:00", "07:00" -> "night"
 */
function getShiftTypeFromTime(startTime: string, endTime: string): 'morning' | 'afternoon' | 'night' | null {
  const normalized = `${startTime}-${endTime}`

  if (normalized === '07:00-15:00') return 'morning'
  if (normalized === '15:00-23:00') return 'afternoon'
  if (normalized === '23:00-07:00') return 'night'

  // Handle potential variations
  if (startTime.startsWith('07:') && endTime.startsWith('15:')) return 'morning'
  if (startTime.startsWith('15:') && endTime.startsWith('23:')) return 'afternoon'
  if (startTime.startsWith('23:') && endTime.startsWith('07:')) return 'night'

  return null
}

/**
 * Extract position from employee name suffix
 * Examples:
 *   "KARLA 1" -> { baseName: "KARLA", position: "C1" }
 *   "ISABEL EXT" -> { baseName: "ISABEL", position: "EXT" }
 *   "KARLA" -> { baseName: "KARLA", position: undefined }
 */
function extractPositionFromName(fullName: string): { baseName: string; position: PositionType | undefined } {
  const trimmed = fullName.trim()

  // Check for " EXT" suffix
  if (trimmed.endsWith(' EXT')) {
    return {
      baseName: trimmed.slice(0, -4).trim(),
      position: 'EXT'
    }
  }

  // Check for " 1", " 2", " 3" suffix
  if (trimmed.endsWith(' 1')) {
    return {
      baseName: trimmed.slice(0, -2).trim(),
      position: 'C1'
    }
  }

  if (trimmed.endsWith(' 2')) {
    return {
      baseName: trimmed.slice(0, -2).trim(),
      position: 'C2'
    }
  }

  if (trimmed.endsWith(' 3')) {
    return {
      baseName: trimmed.slice(0, -2).trim(),
      position: 'C3'
    }
  }

  // No position suffix found
  return {
    baseName: trimmed,
    position: undefined
  }
}

export async function exportToPDF(
  element: HTMLElement,
  filename: string
): Promise<void> {
  try {
    // Dynamically import heavy libraries only when needed
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf')
    ])

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })

    const imgWidth = 297
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
    pdf.save(filename)
  } catch (error) {
    console.error('Error al generar el PDF:', error)
    throw new Error('Error al generar el PDF. Por favor intenta de nuevo.')
  }
}

export function exportToJSON(data: any, filename: string): void {
  try {
    const jsonData = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error al exportar JSON:', error)
    throw new Error('Error al exportar JSON. Por favor intenta de nuevo.')
  }
}

/**
 * Export schedule to CSV format
 *
 * CSV Format (NEW - includes coverage info):
 * Fecha,Día,Turno,Horario,Empleado,Posición,Estado,CoverageTipo,CoverageSucursal,CoverageTurno
 * 2025-01-01,Lunes,TURNO 1,07:00-15:00,Juan Perez,C1,assigned,,,
 * 2025-01-01,Lunes,TURNO 2,15:00-23:00,Pedro Lopez,C2,covering,branch,003,night
 *
 * Notes:
 * - UTF-8 BOM included for Excel compatibility
 * - Values with commas are quoted
 * - Coverage columns only filled when status = 'covering'
 * - Backward compatible: old CSVs (7 columns) can still be imported
 */
export function exportToCSV(
  schedule: Schedule,
  employees: Employee[],
  filename: string
): void {
  try {
    console.log('[exportToCSV] 📤 Starting export:', filename)

    // CSV Headers - MUST match import parser expectations
    const headers = ['Fecha', 'Día', 'Turno', 'Horario', 'Empleado', 'Posición', 'Estado', 'CoverageTipo', 'CoverageSucursal', 'CoverageTurno']

    // Build CSV rows
    const rows: string[] = [headers.join(',')]

    schedule.days.forEach(day => {
      day.shifts.forEach(shift => {
        // Find employee name
        const employee = employees.find(emp => emp.id === shift.employeeId)
        const employeeName = employee?.name || ''

        // Determine shift name
        let shiftName = ''
        if (shift.startTime === '07:00' && shift.endTime === '15:00') {
          shiftName = 'TURNO 1'
        } else if (shift.startTime === '15:00' && shift.endTime === '23:00') {
          shiftName = 'TURNO 2'
        } else if (shift.startTime === '23:00' && shift.endTime === '07:00') {
          shiftName = 'TURNO 3'
        } else {
          shiftName = `${shift.startTime}-${shift.endTime}`
        }

        // Extract coverage info if status is 'covering'
        let coverageType = ''
        let coverageBranch = ''
        let coverageShift = ''

        if (shift.status === 'covering' && shift.coverageInfo) {
          coverageType = shift.coverageInfo.type || ''
          coverageBranch = shift.coverageInfo.targetBranch || ''
          coverageShift = shift.coverageInfo.targetShift || ''
        }

        const row = [
          shift.date,
          day.dayName,
          shiftName,
          `${shift.startTime}-${shift.endTime}`,
          employeeName,
          shift.position || '',
          shift.status || 'empty',
          coverageType,
          coverageBranch,
          coverageShift
        ]

        // Escape commas in values by quoting them
        const escapedRow = row.map(value =>
          value.includes(',') ? `"${value}"` : value
        )

        rows.push(escapedRow.join(','))
      })
    })

    console.log('[exportToCSV] ✓ Generated', rows.length - 1, 'rows (excluding header)')

    const csvContent = rows.join('\n')

    // Add UTF-8 BOM for Excel compatibility
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    console.log('[exportToCSV] ✓ File downloaded:', filename)
  } catch (error) {
    console.error('[exportToCSV] ❌ Error:', error)
    throw new Error('Error al exportar CSV. Por favor intenta de nuevo.')
  }
}

/**
 * Export all schedules to a single CSV file
 * Combines multiple schedules into one CSV with all shifts from all schedules
 */
export function exportAllSchedulesToCSV(
  schedules: Schedule[],
  employees: Employee[],
  filename: string
): void {
  try {
    console.log('[exportAllSchedulesToCSV] 📤 Starting export of', schedules.length, 'schedules')

    if (schedules.length === 0) {
      throw new Error('No hay horarios para exportar')
    }

    // CSV Headers
    const headers = ['Fecha', 'Día', 'Turno', 'Horario', 'Empleado', 'Posición', 'Estado', 'CoverageTipo', 'CoverageSucursal', 'CoverageTurno', 'NombreHorario']
    const rows: string[] = [headers.join(',')]

    // Process each schedule
    schedules.forEach(schedule => {
      schedule.days.forEach(day => {
        day.shifts.forEach(shift => {
          // Find employee name
          const employee = employees.find(emp => emp.id === shift.employeeId)
          const employeeName = employee?.name || ''

          // Determine shift name
          let shiftName = ''
          if (shift.startTime === '07:00' && shift.endTime === '15:00') {
            shiftName = 'TURNO 1'
          } else if (shift.startTime === '15:00' && shift.endTime === '23:00') {
            shiftName = 'TURNO 2'
          } else if (shift.startTime === '23:00' && shift.endTime === '07:00') {
            shiftName = 'TURNO 3'
          } else {
            shiftName = `${shift.startTime}-${shift.endTime}`
          }

          // Extract coverage info if status is 'covering'
          let coverageType = ''
          let coverageBranch = ''
          let coverageShift = ''

          if (shift.status === 'covering' && shift.coverageInfo) {
            coverageType = shift.coverageInfo.type || ''
            coverageBranch = shift.coverageInfo.targetBranch || ''
            coverageShift = shift.coverageInfo.targetShift || ''
          }

          const row = [
            shift.date,
            day.dayName,
            shiftName,
            `${shift.startTime}-${shift.endTime}`,
            employeeName,
            shift.position || '',
            shift.status || 'empty',
            coverageType,
            coverageBranch,
            coverageShift,
            schedule.name // Add schedule name to identify which schedule this shift belongs to
          ]

          // Escape commas in values by quoting them
          const escapedRow = row.map(value =>
            value.includes(',') ? `"${value}"` : value
          )

          rows.push(escapedRow.join(','))
        })
      })
    })

    console.log('[exportAllSchedulesToCSV] ✓ Generated', rows.length - 1, 'rows (excluding header)')

    const csvContent = rows.join('\n')

    // Add UTF-8 BOM for Excel compatibility
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    console.log('[exportAllSchedulesToCSV] ✓ File downloaded:', filename)
  } catch (error) {
    console.error('[exportAllSchedulesToCSV] ❌ Error:', error)
    throw new Error('Error al exportar CSV. Por favor intenta de nuevo.')
  }
}

/**
 * Analyze date range of shifts and determine if it's first or second half of month
 * Returns suffix to add to schedule name, or empty string if full month
 */
function analyzeScheduleDateRange(dates: string[]): string {
  if (dates.length === 0) return ''

  // Parse dates and get day numbers
  const days = dates.map(dateStr => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.getDate()
  })

  const minDay = Math.min(...days)
  const maxDay = Math.max(...days)

  // Determine if it's a quincenal (15-day) period
  // 1ra Quincena: days 1-15
  // 2da Quincena: days 16-31

  // Check if all dates fall within first half (1-15)
  if (minDay >= 1 && maxDay <= 15) {
    return ' - 1ra Quincena'
  }

  // Check if all dates fall within second half (16-31)
  if (minDay >= 16 && maxDay <= 31) {
    return ' - 2da Quincena'
  }

  // If dates span across both halves, it's likely a full month - no suffix
  return ''
}

/**
 * Import multiple schedules from a single CSV file
 * Detects if CSV has "NombreHorario" column and groups rows by schedule name
 * Returns array of schedules (one per unique schedule name found)
 */
export function importAllSchedulesFromCSV(
  file: File,
  employees: Employee[],
  silentMode: boolean = false
): Promise<Schedule[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        console.log('[importAllSchedulesFromCSV] 📁 File loaded, size:', content.length)

        // Use CSVParser for robust parsing
        const { CSVParser } = require('@/lib/csvParser')
        const parser = new CSVParser(true) // Debug mode enabled

        // Validate CSV structure first
        const validation = parser.validateCSVStructure(content)
        if (!validation.valid) {
          throw new Error(validation.error || 'CSV inválido')
        }

        // Parse CSV content
        const parsedData = parser.parseCSVContent(content) as ParsedCSVData
        console.log('[importAllSchedulesFromCSV] 📊 Parsed data:', {
          rows: parsedData.rows.length,
          dates: parsedData.dates.length,
          errors: parsedData.errors.length
        })

        if (parsedData.rows.length === 0) {
          throw new Error('No se pudieron parsear datos del CSV')
        }

        if (parsedData.errors.length > 0) {
          console.warn('[importAllSchedulesFromCSV] ⚠️ Parsing errors:', parsedData.errors)
        }

        // Check if CSV has scheduleName column (multi-schedule format)
        const hasScheduleNames = parsedData.rows.some(row => row.scheduleName)

        if (!hasScheduleNames) {
          console.log('[importAllSchedulesFromCSV] ℹ️ No scheduleName column found, treating as single schedule')
          // If no schedule names, use regular import and wrap in array
          return importFromCSV(file, null, employees, silentMode)
            .then(schedule => resolve([schedule]))
            .catch(reject)
        }

        console.log('[importAllSchedulesFromCSV] 📋 Multi-schedule CSV detected')

        // Group rows by schedule name
        const scheduleGroups = new Map<string, typeof parsedData.rows>()
        parsedData.rows.forEach(row => {
          const scheduleName = row.scheduleName || 'Horario sin nombre'
          if (!scheduleGroups.has(scheduleName)) {
            scheduleGroups.set(scheduleName, [])
            console.log(`[importAllSchedulesFromCSV] 🆕 New schedule detected: "${scheduleName}"`)
          }
          scheduleGroups.get(scheduleName)!.push(row)
        })

        console.log('[importAllSchedulesFromCSV] 📊 Found', scheduleGroups.size, 'unique schedule(s):', Array.from(scheduleGroups.keys()))

        // Show summary of what was found
        scheduleGroups.forEach((rows, name) => {
          const dates = Array.from(new Set(rows.map(r => r.date))).sort()
          console.log(`  - "${name}": ${rows.length} shifts across ${dates.length} days (${dates[0]} to ${dates[dates.length - 1]})`)
        })

        console.log('[importAllSchedulesFromCSV] 🔍 Starting quincenal analysis...')

        // Auto-detect and split schedules by quincenal periods if needed
        // This handles cases where multiple quincenal schedules share the same base name
        const improvedScheduleGroups = new Map<string, typeof parsedData.rows>()

        scheduleGroups.forEach((rows, originalName) => {
          console.log(`[importAllSchedulesFromCSV] 🔍 Analyzing "${originalName}"...`)

          const dates = Array.from(new Set(rows.map(r => r.date))).sort()
          console.log(`  📅 Unique dates: ${dates.length} (${dates[0]} to ${dates[dates.length - 1]})`)

          // Check if the name already includes quincenal information
          if (originalName.includes('Quincena')) {
            // Already has quincenal info, keep as is
            console.log(`  ℹ️ Already has quincenal info, keeping as is`)
            improvedScheduleGroups.set(originalName, rows)
            return
          }

          // Get day numbers from dates
          const days = dates.map(dateStr => {
            const date = new Date(dateStr + 'T00:00:00')
            return date.getDate()
          })

          const minDay = Math.min(...days)
          const maxDay = Math.max(...days)
          console.log(`  📊 Day range: ${minDay} to ${maxDay}`)

          // Count days in each half
          const firstHalfDays = days.filter(d => d <= 15).length
          const secondHalfDays = days.filter(d => d >= 16).length
          console.log(`  📊 Distribution: ${firstHalfDays} days in 1st half (1-15), ${secondHalfDays} days in 2nd half (16-31)`)

          // Check if dates span across both halves of the month (full month or mixed)
          const hasFirstHalf = minDay <= 15
          const hasSecondHalf = maxDay >= 16
          console.log(`  🔍 hasFirstHalf: ${hasFirstHalf}, hasSecondHalf: ${hasSecondHalf}`)

          if (hasFirstHalf && hasSecondHalf) {
            // Dates span both halves - split into two schedules
            console.log(`[importAllSchedulesFromCSV] 🔀 Splitting "${originalName}" into quincenal periods (days ${minDay}-${maxDay})`)

            // Split rows into two groups
            const firstHalfRows = rows.filter(row => {
              const date = new Date(row.date + 'T00:00:00')
              return date.getDate() <= 15
            })

            const secondHalfRows = rows.filter(row => {
              const date = new Date(row.date + 'T00:00:00')
              return date.getDate() >= 16
            })

            console.log(`  📊 Split results: ${firstHalfRows.length} rows in 1st half, ${secondHalfRows.length} rows in 2nd half`)

            if (firstHalfRows.length > 0) {
              const firstName = originalName + ' - 1ra Quincena'
              console.log(`  ✓ Created "${firstName}" with ${firstHalfRows.length} shifts`)
              improvedScheduleGroups.set(firstName, firstHalfRows)
            }

            if (secondHalfRows.length > 0) {
              const secondName = originalName + ' - 2da Quincena'
              console.log(`  ✓ Created "${secondName}" with ${secondHalfRows.length} shifts`)
              improvedScheduleGroups.set(secondName, secondHalfRows)
            }
          } else {
            // Dates only in one half - add appropriate suffix
            console.log(`  ℹ️ Dates only in one half, analyzing for suffix...`)
            const suffix = analyzeScheduleDateRange(dates)

            if (suffix) {
              const improvedName = originalName + suffix
              console.log(`[importAllSchedulesFromCSV] 📅 Auto-detected quincenal period: "${originalName}" → "${improvedName}"`)
              improvedScheduleGroups.set(improvedName, rows)
            } else {
              // Keep original name
              console.log(`  ℹ️ No suffix needed, keeping original name`)
              improvedScheduleGroups.set(originalName, rows)
            }
          }
        })

        console.log('[importAllSchedulesFromCSV] 📊 After quincenal analysis:', improvedScheduleGroups.size, 'schedule(s):', Array.from(improvedScheduleGroups.keys()))

        const { generateId } = require('@/lib/utils')
        const createdSchedules: Schedule[] = []
        const employeesNotFound: Set<string> = new Set()

        // Create a schedule for each group
        improvedScheduleGroups.forEach((rows, scheduleName) => {
          console.log(`[importAllSchedulesFromCSV] 🔨 Creating schedule "${scheduleName}" with ${rows.length} shifts`)

          // Extract unique dates for this schedule
          const scheduleDates = Array.from(new Set(rows.map(r => r.date))).sort()

          if (scheduleDates.length === 0) {
            console.warn(`[importAllSchedulesFromCSV] ⚠️ No valid dates for schedule "${scheduleName}", skipping`)
            return
          }

          const startDate = scheduleDates[0]
          const endDate = scheduleDates[scheduleDates.length - 1]

          // Create schedule structure
          const schedule: Schedule = {
            id: generateId(),
            name: scheduleName,
            startDate,
            endDate,
            days: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }

          // Create days for each unique date
          scheduleDates.forEach((date: string) => {
            const dateObj = new Date(date + 'T00:00:00')
            const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'long' })

            schedule.days.push({
              date,
              dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1),
              shifts: []
            })
          })

          // Process shifts for this schedule
          let shiftsCreated = 0
          let coverageInfoRestored = 0

          rows.forEach(row => {
            const day = schedule.days.find(d => d.date === row.date)
            if (!day) {
              console.warn(`[importAllSchedulesFromCSV] ⚠️ Day not found for date: ${row.date}`)
              return
            }

            // Parse horario
            const [startTime, endTime] = row.horario.split('-').map(t => t.trim())
            if (!startTime || !endTime) {
              console.warn(`[importAllSchedulesFromCSV] ⚠️ Invalid horario: ${row.horario}`)
              return
            }

            // Extract position from employee name
            const nameInfo = extractPositionFromName(row.employeeName)
            const baseName = nameInfo.baseName
            const extractedPosition = nameInfo.position

            // Find employee
            let employee = employees.find(emp => emp.name === baseName)
            if (!employee && baseName) {
              employee = employees.find(emp =>
                emp.name.toLowerCase() === baseName.toLowerCase()
              )
            }
            if (!employee && baseName) {
              const trimmedBaseName = baseName.trim()
              employee = employees.find(emp =>
                emp.name.trim().toLowerCase() === trimmedBaseName.toLowerCase()
              )
            }
            if (!employee && row.employeeName) {
              employee = employees.find(emp =>
                emp.name.trim().toLowerCase() === row.employeeName.trim().toLowerCase()
              )
            }

            // Reconstruct coverageInfo
            let coverageInfo = undefined
            if (row.status === 'covering') {
              const rowShiftType = getShiftTypeFromTime(startTime, endTime)

              if (row.coverageType && row.coverageShift) {
                if (row.coverageShift === rowShiftType) {
                  console.warn(`[importAllSchedulesFromCSV] ⚠️ Invalid coverage: ${row.employeeName} in ${rowShiftType} cannot cover ${rowShiftType}. Using default T3.`)
                  coverageInfo = {
                    type: 'shift' as const,
                    targetShift: 'night'
                  }
                } else {
                  coverageInfo = {
                    type: row.coverageType as 'shift' | 'branch',
                    targetBranch: row.coverageBranch || undefined,
                    targetShift: row.coverageShift || undefined
                  }
                  coverageInfoRestored++
                }
              } else {
                coverageInfo = {
                  type: 'shift' as const,
                  targetShift: 'night'
                }
              }
            }

            const finalPosition = extractedPosition || (row.position as PositionType) || undefined

            // Create shift
            const shift = {
              id: generateId(),
              startTime,
              endTime,
              date: row.date,
              employeeId: employee?.id,
              isAssigned: !!employee,
              position: finalPosition,
              status: row.status as any || 'empty',
              coverageInfo
            }

            if (row.employeeName && !employee) {
              employeesNotFound.add(row.employeeName)
            }

            day.shifts.push(shift)
            shiftsCreated++
          })

          console.log(`[importAllSchedulesFromCSV] ✓ Schedule "${scheduleName}": ${shiftsCreated} shifts created`)
          if (coverageInfoRestored > 0) {
            console.log(`[importAllSchedulesFromCSV] ✓ Coverage info restored: ${coverageInfoRestored} shifts`)
          }

          createdSchedules.push(schedule)
        })

        if (employeesNotFound.size > 0) {
          const notFoundList = Array.from(employeesNotFound).join(', ')
          console.warn('[importAllSchedulesFromCSV] ⚠️ Empleados no encontrados:', notFoundList)
          if (!silentMode) {
            const employeesList = Array.from(employeesNotFound).map(name => `<li>${name}</li>`).join('')
            showWarningHtml(`Los siguientes empleados del CSV no se encontraron en tu lista:<br><br><ul style="text-align: left; margin: 10px 0;">${employeesList}</ul><br>Sus turnos se importaron pero sin empleado asignado.`, '⚠️ Empleados no encontrados')
          }
        }

        // Update assignedShift for each employee based on all imported schedules
        const employeeShiftCounts = new Map<string, Map<string, number>>()

        createdSchedules.forEach(schedule => {
          schedule.days.forEach(day => {
            day.shifts.forEach(shift => {
              if (shift.employeeId && shift.status !== 'empty') {
                const shiftType = getShiftTypeFromTime(shift.startTime, shift.endTime)
                if (shiftType) {
                  if (!employeeShiftCounts.has(shift.employeeId)) {
                    employeeShiftCounts.set(shift.employeeId, new Map())
                  }
                  const counts = employeeShiftCounts.get(shift.employeeId)!
                  counts.set(shiftType, (counts.get(shiftType) || 0) + 1)
                }
              }
            })
          })
        })

        // Update each employee's assignedShift
        let employeesUpdated = 0
        employeeShiftCounts.forEach((shiftCounts, employeeId) => {
          let maxCount = 0
          let primaryShift = 'morning'

          shiftCounts.forEach((count, shiftType) => {
            if (count > maxCount) {
              maxCount = count
              primaryShift = shiftType
            }
          })

          const employee = employees.find(e => e.id === employeeId)
          if (employee && employee.assignedShift !== primaryShift) {
            const { storage } = require('@/lib/storage')
            storage.updateEmployee(employeeId, { ...employee, assignedShift: primaryShift as any })
            employeesUpdated++
            console.log(`[importAllSchedulesFromCSV] ✓ Updated ${employee.name} assignedShift to ${primaryShift}`)
          }
        })

        if (employeesUpdated > 0) {
          console.log(`[importAllSchedulesFromCSV] ✓ Updated assignedShift for ${employeesUpdated} employees`)
        }

        console.log('[importAllSchedulesFromCSV] ✓ Import complete:', {
          schedules: createdSchedules.length,
          totalShifts: createdSchedules.reduce((sum, s) => sum + s.days.reduce((d, day) => d + day.shifts.length, 0), 0),
          scheduleNames: createdSchedules.map(s => s.name)
        })

        console.log('[importAllSchedulesFromCSV] 📋 Final schedule list:')
        createdSchedules.forEach((s, i) => {
          console.log(`  ${i + 1}. "${s.name}" (${s.days.length} days, ${s.days.reduce((sum, day) => sum + day.shifts.length, 0)} shifts)`)
        })

        resolve(createdSchedules)
      } catch (error) {
        console.error('[importAllSchedulesFromCSV] ❌ Error:', error)
        reject(error instanceof Error ? error : new Error('Error al procesar el archivo CSV. Verifica el formato.'))
      }
    }

    reader.onerror = () => {
      console.error('[importAllSchedulesFromCSV] ❌ FileReader error')
      reject(new Error('Error al leer el archivo CSV'))
    }

    reader.readAsText(file, 'utf-8')
  })
}

export function importFromCSV(
  file: File,
  currentSchedule: Schedule | null,
  employees: Employee[],
  silentMode: boolean = false
): Promise<Schedule> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        console.log('[importFromCSV] 📁 File loaded, size:', content.length)

        // Use CSVParser for robust parsing
        const { CSVParser } = require('@/lib/csvParser')
        const parser = new CSVParser(true) // Debug mode enabled

        // Validate CSV structure first
        const validation = parser.validateCSVStructure(content)
        if (!validation.valid) {
          throw new Error(validation.error || 'CSV inválido')
        }

        // Parse CSV content
        const parsedData = parser.parseCSVContent(content) as ParsedCSVData
        console.log('[importFromCSV] 📊 Parsed data:', {
          rows: parsedData.rows.length,
          dates: parsedData.dates.length,
          errors: parsedData.errors.length
        })

        if (parsedData.rows.length === 0) {
          throw new Error('No se pudieron parsear datos del CSV')
        }

        if (parsedData.errors.length > 0) {
          console.warn('[importFromCSV] ⚠️ Parsing errors:', parsedData.errors)
        }

        const { generateId } = require('@/lib/utils')
        let updatedSchedule: Schedule

        if (currentSchedule) {
          // Clone existing schedule
          console.log('[importFromCSV] 🔄 Updating existing schedule:', currentSchedule.id)
          updatedSchedule = JSON.parse(JSON.stringify(currentSchedule))
        } else {
          // Create new schedule from CSV data
          console.log('[importFromCSV] 🆕 Creating new schedule from CSV')

          if (parsedData.dates.length === 0) {
            throw new Error('No se encontraron fechas válidas en el CSV')
          }

          const startDate = parsedData.dates[0]
          const endDate = parsedData.dates[parsedData.dates.length - 1]

          console.log('[importFromCSV] 📅 Date range:', startDate, 'to', endDate)

          // Determine schedule name based on dates
          const startDateObj = new Date(startDate + 'T00:00:00')
          const scheduleName = `Horario ${startDateObj.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}`

          // Create new schedule structure with ALL required fields
          updatedSchedule = {
            id: generateId(),
            name: scheduleName,
            startDate,
            endDate,
            days: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }

          console.log('[importFromCSV] ✓ Schedule created:', updatedSchedule.name)

          // Create days for each unique date in CSV
          parsedData.dates.forEach((date: string) => {
            const dateObj = new Date(date + 'T00:00:00')
            const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'long' })

            updatedSchedule.days.push({
              date,
              dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1),
              shifts: []
            })
          })

          console.log('[importFromCSV] ✓ Created', updatedSchedule.days.length, 'days')
        }

        // Process each row and create shifts
        // NOTE: Each CSV row creates a NEW shift (1 shift = 1 employee assignment)
        let shiftsCreated = 0
        let coverageInfoRestored = 0
        let employeesNotFound: Set<string> = new Set()

        parsedData.rows.forEach(row => {
          // Find the day
          const day = updatedSchedule.days.find(d => d.date === row.date)
          if (!day) {
            console.warn(`[importFromCSV] ⚠️ Day not found for date: ${row.date}`)
            return
          }

          // Parse horario (e.g., "07:00-15:00")
          const [startTime, endTime] = row.horario.split('-').map(t => t.trim())
          if (!startTime || !endTime) {
            console.warn(`[importFromCSV] ⚠️ Invalid horario: ${row.horario}`)
            return
          }

          // Extract position from employee name (e.g., "KARLA 1" -> baseName: "KARLA", position: "C1")
          const nameInfo = extractPositionFromName(row.employeeName)
          const baseName = nameInfo.baseName
          const extractedPosition = nameInfo.position

          if (extractedPosition) {
            console.log(`[importFromCSV] 📍 Extracted position ${extractedPosition} from name "${row.employeeName}" -> base name "${baseName}"`)
          }

          // Find employee by base name with flexible matching
          // 1. Try exact match with base name
          let employee = employees.find(emp => emp.name === baseName)

          // 2. Try case-insensitive match
          if (!employee && baseName) {
            employee = employees.find(emp =>
              emp.name.toLowerCase() === baseName.toLowerCase()
            )
          }

          // 3. Try trimmed match
          if (!employee && baseName) {
            const trimmedBaseName = baseName.trim()
            employee = employees.find(emp =>
              emp.name.trim().toLowerCase() === trimmedBaseName.toLowerCase()
            )
          }

          // 4. If still not found, try matching with full original name (backward compatibility)
          if (!employee && row.employeeName) {
            employee = employees.find(emp =>
              emp.name.trim().toLowerCase() === row.employeeName.trim().toLowerCase()
            )
          }

          // Reconstruct coverageInfo from CSV columns if status is 'covering'
          let coverageInfo = undefined
          if (row.status === 'covering') {
            // Determine what shift this row belongs to
            const rowShiftType = getShiftTypeFromTime(startTime, endTime)

            if (row.coverageType && row.coverageShift) {
              // Validate: employee cannot cover their own shift
              if (row.coverageShift === rowShiftType) {
                console.warn(`[importFromCSV] ⚠️ Invalid coverage: ${row.employeeName} in ${rowShiftType} cannot cover ${rowShiftType}. Using default T3.`)
                coverageInfo = {
                  type: 'shift' as const,
                  targetShift: 'night'
                }
              } else {
                // Use coverage info from CSV
                coverageInfo = {
                  type: row.coverageType as 'shift' | 'branch',
                  targetBranch: row.coverageBranch || undefined,
                  targetShift: row.coverageShift || undefined
                }
                coverageInfoRestored++
              }
            } else {
              // Default: covering T3 (night shift) if not specified
              coverageInfo = {
                type: 'shift' as const,
                targetShift: 'night'
              }
              console.log(`[importFromCSV] 📍 Default coverage T3 applied for ${row.employeeName} on ${row.date}`)
            }
          }

          // Determine final position: prioritize extracted position from name, fallback to CSV position column
          const finalPosition = extractedPosition || (row.position as PositionType) || undefined

          // Create NEW shift for each CSV row (don't search for existing)
          // This respects the architecture: 1 shift = 1 employee assignment
          const shift = {
            id: generateId(),
            startTime,
            endTime,
            date: row.date,
            employeeId: employee?.id,
            isAssigned: !!employee,
            position: finalPosition,
            status: row.status as any || 'empty',
            coverageInfo
          }

          // Track employees not found
          if (row.employeeName && !employee) {
            employeesNotFound.add(row.employeeName)
          }

          day.shifts.push(shift)
          shiftsCreated++
        })

        console.log('[importFromCSV] ✓ Shifts created:', shiftsCreated)

        if (coverageInfoRestored > 0) {
          console.log('[importFromCSV] ✓ Coverage info restored:', coverageInfoRestored, 'shifts')
        }

        if (employeesNotFound.size > 0) {
          const notFoundList = Array.from(employeesNotFound).join(', ')
          console.warn('[importFromCSV] ⚠️ Empleados no encontrados:', notFoundList)
          if (!silentMode) {
            const employeesList = Array.from(employeesNotFound).map(name => `<li>${name}</li>`).join('')
            showWarningHtml(`Los siguientes empleados del CSV no se encontraron en tu lista:<br><br><ul style="text-align: left; margin: 10px 0;">${employeesList}</ul><br>Sus turnos se importaron pero sin empleado asignado. Por favor, verifica los nombres de empleados.`, '⚠️ Empleados no encontrados')
          }
        }

        // Update assignedShift for each employee based on their shifts in the schedule
        const employeeShiftCounts = new Map<string, Map<string, number>>()

        updatedSchedule.days.forEach(day => {
          day.shifts.forEach(shift => {
            // Count all active shifts (not just 'assigned') to determine employee's primary shift
            // This includes: assigned, rest, covering, vacation, sick, absent
            // Only exclude 'empty' shifts
            if (shift.employeeId && shift.status !== 'empty') {
              // Determine shiftType from time
              const shiftType = getShiftTypeFromTime(shift.startTime, shift.endTime)
              if (shiftType) {
                if (!employeeShiftCounts.has(shift.employeeId)) {
                  employeeShiftCounts.set(shift.employeeId, new Map())
                }
                const counts = employeeShiftCounts.get(shift.employeeId)!
                counts.set(shiftType, (counts.get(shiftType) || 0) + 1)
              }
            }
          })
        })

        // Update each employee's assignedShift to their most common shift
        let employeesUpdated = 0
        let employeesAnalyzed = 0
        employeeShiftCounts.forEach((shiftCounts, employeeId) => {
          let maxCount = 0
          let primaryShift = 'morning'

          shiftCounts.forEach((count, shiftType) => {
            if (count > maxCount) {
              maxCount = count
              primaryShift = shiftType
            }
          })

          const employee = employees.find(e => e.id === employeeId)
          if (employee) {
            employeesAnalyzed++
            console.log(`[importFromCSV] 📊 ${employee.name}: ${maxCount} shifts in ${primaryShift}, current assignedShift=${employee.assignedShift}`)

            if (employee.assignedShift !== primaryShift) {
              const { storage } = require('@/lib/storage')
              storage.updateEmployee(employeeId, { ...employee, assignedShift: primaryShift as any })
              employeesUpdated++
              console.log(`[importFromCSV] ✓ Updated ${employee.name} assignedShift from ${employee.assignedShift} to ${primaryShift}`)
            }
          }
        })

        console.log(`[importFromCSV] 📊 Analyzed ${employeesAnalyzed} employees from schedule`)
        if (employeesUpdated > 0) {
          console.log(`[importFromCSV] ✓ Updated assignedShift for ${employeesUpdated} employees`)
        }

        // Final validation
        const totalShifts = updatedSchedule.days.reduce((sum, day) => sum + day.shifts.length, 0)
        console.log('[importFromCSV] 📊 Final schedule:', {
          days: updatedSchedule.days.length,
          totalShifts,
          name: updatedSchedule.name
        })

        if (totalShifts === 0) {
          throw new Error('El schedule importado no contiene shifts válidos')
        }

        resolve(updatedSchedule)
      } catch (error) {
        console.error('[importFromCSV] ❌ Error:', error)
        reject(error instanceof Error ? error : new Error('Error al procesar el archivo CSV. Verifica el formato.'))
      }
    }

    reader.onerror = () => {
      console.error('[importFromCSV] ❌ FileReader error')
      reject(new Error('Error al leer el archivo CSV'))
    }

    reader.readAsText(file, 'utf-8')
  })
}
