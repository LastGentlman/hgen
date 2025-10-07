/**
 * CSV Parser - Robust CSV parsing with validation and logging
 * Follows Single Responsibility Principle
 */

export interface CSVRow {
  date: string
  dayName: string
  shiftName: string
  horario: string
  employeeName: string
  position: string
  status: string
  coverageType: string      // 'shift' | 'branch' | ''
  coverageBranch: string    // '001' | '002' | '003' | ''
  coverageShift: string     // 'morning' | 'afternoon' | 'night' | ''
  scheduleName?: string     // Optional: name of schedule this row belongs to (for multi-schedule CSVs)
}

export interface ParsedCSVData {
  rows: CSVRow[]
  dates: string[]
  errors: string[]
}

export class CSVParser {
  private debugMode: boolean

  constructor(debugMode = true) {
    this.debugMode = debugMode
  }

  /**
   * Parse CSV content and return structured data
   * Uses fill-forward pattern for merged cells (common in Excel exports)
   */
  parseCSVContent(content: string): ParsedCSVData {
    this.log('🔍 Starting CSV parsing...')

    // Remove BOM if present
    const cleanContent = this.removeBOM(content)
    this.log('✓ BOM removed')

    // Split into lines and filter empty ones
    const lines = cleanContent
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0)

    this.log(`✓ Found ${lines.length} lines (including header)`)

    if (lines.length < 2) {
      throw new Error('CSV vacío o sin datos (solo contiene encabezado)')
    }

    // Skip header and parse data lines
    const dataLines = lines.slice(1)
    const rows: CSVRow[] = []
    const errors: string[] = []

    // Fill-forward tracking for merged cells
    let lastDate = ''
    let lastDayName = ''
    let lastShiftName = ''
    let lastHorario = ''
    let fillForwardCount = 0

    dataLines.forEach((line, index) => {
      try {
        const row = this.parseCSVLine(line, index + 2, {
          lastDate,
          lastDayName,
          lastShiftName,
          lastHorario
        })

        if (row) {
          // Update last known values for fill-forward
          if (row.date) lastDate = row.date
          if (row.dayName) lastDayName = row.dayName
          if (row.shiftName) lastShiftName = row.shiftName
          if (row.horario) lastHorario = row.horario

          // Track if fill-forward was used
          const parsedValues = this.splitCSVLine(line)
          if (!parsedValues[0] || !parsedValues[3]) {
            fillForwardCount++
            this.log(`  ↪ Line ${index + 2}: Fill-forward applied (date: ${row.date}, horario: ${row.horario})`)
          }

          rows.push(row)
        }
      } catch (error) {
        const errorMsg = `Línea ${index + 2}: ${error instanceof Error ? error.message : 'Error desconocido'}`
        errors.push(errorMsg)
        this.log(`⚠️ ${errorMsg}`)
      }
    })

    // Extract unique dates
    const dates = this.extractUniqueDates(rows)

    this.log(`✓ Parsed ${rows.length} rows successfully`)
    this.log(`✓ Fill-forward applied to ${fillForwardCount} rows`)
    this.log(`✓ Found ${dates.length} unique dates`)

    if (errors.length > 0) {
      this.log(`⚠️ ${errors.length} errors found during parsing`)
    }

    return { rows, dates, errors }
  }

  /**
   * Parse a single CSV line into a CSVRow object
   * Uses fill-forward values for merged/empty cells
   */
  private parseCSVLine(
    line: string,
    lineNumber: number,
    previousValues?: {
      lastDate: string
      lastDayName: string
      lastShiftName: string
      lastHorario: string
    }
  ): CSVRow | null {
    // Parse CSV line handling quoted values
    const values = this.splitCSVLine(line)

    // Support multiple formats:
    // - Old format: 7 columns (basic)
    // - Coverage format: 10 columns (with coverage info)
    // - Multi-schedule format: 11 columns (with schedule name)
    if (values.length < 7) {
      this.log(`⚠️ Line ${lineNumber}: Expected at least 7 columns, got ${values.length}`)
      return null
    }

    let [date, dayName, shiftName, horario, employeeName, position, status, coverageType = '', coverageBranch = '', coverageShift = '', scheduleName = ''] = values

    // Apply fill-forward for empty cells (common in Excel exports)
    if (previousValues) {
      if (!date && previousValues.lastDate) {
        date = previousValues.lastDate
      }
      if (!dayName && previousValues.lastDayName) {
        dayName = previousValues.lastDayName
      }
      if (!shiftName && previousValues.lastShiftName) {
        shiftName = previousValues.lastShiftName
      }
      if (!horario && previousValues.lastHorario) {
        horario = previousValues.lastHorario
      }
    }

    // Validate required fields (after fill-forward)
    if (!date || !horario) {
      this.log(`⚠️ Line ${lineNumber}: Missing required fields even after fill-forward (date: ${!!date}, horario: ${!!horario})`)
      return null
    }

    // A row must have at least one meaningful value (employee, position, or status)
    // This allows for rows that just define shift structure without assignments
    const hasData = employeeName || position || status
    if (!hasData) {
      this.log(`⚠️ Line ${lineNumber}: Row has no data (no employee, position, or status)`)
      return null
    }

    return {
      date: date.trim(),
      dayName: dayName.trim(),
      shiftName: shiftName.trim(),
      horario: horario.trim(),
      employeeName: employeeName.trim(),
      position: position.trim(),
      status: status.trim(),
      coverageType: coverageType.trim(),
      coverageBranch: coverageBranch.trim(),
      coverageShift: coverageShift.trim(),
      scheduleName: scheduleName.trim() || undefined
    }
  }

  /**
   * Split CSV line handling quoted values correctly
   */
  private splitCSVLine(line: string): string[] {
    // Strip outer quotes if the entire line is wrapped in quotes
    let processedLine = line.trim()
    if (processedLine.startsWith('"') && processedLine.endsWith('"')) {
      processedLine = processedLine.slice(1, -1)
    }

    const values: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < processedLine.length; i++) {
      const char = processedLine[i]

      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current)
        current = ''
      } else {
        current += char
      }
    }

    // Add last value
    values.push(current)

    return values.map(v => v.trim())
  }

  /**
   * Extract unique dates from parsed rows
   */
  private extractUniqueDates(rows: CSVRow[]): string[] {
    const dateSet = new Set<string>()
    rows.forEach(row => {
      if (row.date) {
        dateSet.add(row.date)
      }
    })
    return Array.from(dateSet).sort()
  }

  /**
   * Remove UTF-8 BOM if present
   */
  private removeBOM(content: string): string {
    if (content.charCodeAt(0) === 0xFEFF) {
      return content.slice(1)
    }
    return content
  }

  /**
   * Validate CSV structure
   */
  validateCSVStructure(content: string): { valid: boolean; error?: string } {
    const lines = content.trim().split(/\r?\n/)

    if (lines.length === 0) {
      return { valid: false, error: 'CSV vacío' }
    }

    if (lines.length === 1) {
      return { valid: false, error: 'CSV solo contiene encabezado, sin datos' }
    }

    // Check header
    const header = lines[0].toLowerCase()
    const requiredColumns = ['fecha', 'horario']

    for (const col of requiredColumns) {
      if (!header.includes(col)) {
        return { valid: false, error: `Falta columna requerida: ${col}` }
      }
    }

    return { valid: true }
  }

  /**
   * Log helper
   */
  private log(message: string): void {
    if (this.debugMode) {
      console.log(`[CSVParser] ${message}`)
    }
  }
}
