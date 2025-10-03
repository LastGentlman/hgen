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

export function exportToCSV(
  schedule: Schedule,
  employees: Employee[],
  filename: string
): void {
  try {
    // CSV Headers
    const headers = ['Fecha', 'Día', 'Turno', 'Horario', 'Empleado', 'Posición', 'Estado']

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

        const row = [
          shift.date,
          day.dayName,
          shiftName,
          `${shift.startTime}-${shift.endTime}`,
          employeeName,
          shift.position || '',
          shift.status || 'empty'
        ]

        // Escape commas in values
        const escapedRow = row.map(value =>
          value.includes(',') ? `"${value}"` : value
        )

        rows.push(escapedRow.join(','))
      })
    })

    const csvContent = rows.join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error exporting CSV:', error)
    throw new Error('Error exporting CSV. Please try again.')
  }
}

export function importFromCSV(
  file: File,
  currentSchedule: Schedule,
  employees: Employee[]
): Promise<Schedule> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const lines = content.split('\n').filter(line => line.trim())

        if (lines.length < 2) {
          throw new Error('Archivo CSV vacío o inválido')
        }

        // Skip header row
        const dataLines = lines.slice(1)

        // Clone current schedule
        const updatedSchedule: Schedule = JSON.parse(JSON.stringify(currentSchedule))

        // Parse CSV and update shifts
        dataLines.forEach(line => {
          // Parse CSV line (handle quoted values)
          const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim())

          if (!values || values.length < 7) return

          const [date, , , horario, employeeName, position, status] = values

          // Find the day
          const day = updatedSchedule.days.find(d => d.date === date)
          if (!day) return

          // Parse horario (e.g., "07:00-15:00")
          const [startTime, endTime] = horario.split('-')
          if (!startTime || !endTime) return

          // Find the specific shift by date + time
          const shift = day.shifts.find(s =>
            s.date === date &&
            s.startTime === startTime.trim() &&
            s.endTime === endTime.trim()
          )
          if (!shift) return

          // Find employee by name
          const employee = employees.find(emp => emp.name === employeeName)

          // Update shift
          if (employee) {
            shift.employeeId = employee.id
            shift.isAssigned = true
          } else if (!employeeName) {
            shift.employeeId = undefined
            shift.isAssigned = false
          }

          if (position) {
            shift.position = position as any
          }

          if (status) {
            shift.status = status as any
          }
        })

        resolve(updatedSchedule)
      } catch (error) {
        console.error('Error parsing CSV:', error)
        reject(new Error('Error al procesar el archivo CSV. Verifica el formato.'))
      }
    }

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo CSV'))
    }

    reader.readAsText(file, 'utf-8')
  })
}
