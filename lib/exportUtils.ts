/**
 * Export utilities with lazy-loaded heavy dependencies
 * This module uses dynamic imports to avoid bundling jsPDF and html2canvas in the main chunk
 */

import type { Schedule, Employee, Shift } from '@/types'

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
    console.error('Error generating PDF:', error)
    throw new Error('Error generating PDF. Please try again.')
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
    console.error('Error exporting JSON:', error)
    throw new Error('Error exporting JSON. Please try again.')
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
    throw new Error('Error exporting CSV. Please try again.')
  }
}

export function importFromCSV(
  file: File,
  currentSchedule: Schedule | null,
  employees: Employee[]
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
        const parsedData = parser.parseCSVContent(content)
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
          parsedData.dates.forEach(date => {
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

          // Find employee by name (exact match, case-sensitive)
          const employee = employees.find(emp => emp.name === row.employeeName)

          // Reconstruct coverageInfo from CSV columns if status is 'covering'
          let coverageInfo = undefined
          if (row.status === 'covering' && row.coverageType) {
            coverageInfo = {
              type: row.coverageType as 'shift' | 'branch',
              targetBranch: row.coverageBranch || undefined,
              targetShift: row.coverageShift || undefined
            }
            coverageInfoRestored++
          }

          // Create NEW shift for each CSV row (don't search for existing)
          // This respects the architecture: 1 shift = 1 employee assignment
          const shift = {
            id: generateId(),
            startTime,
            endTime,
            date: row.date,
            employeeId: employee?.id,
            isAssigned: !!employee,
            position: row.position as any || undefined,
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
          console.warn('[importFromCSV] ⚠️ Empleados no encontrados:', Array.from(employeesNotFound))
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
