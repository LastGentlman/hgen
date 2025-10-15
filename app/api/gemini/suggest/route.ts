import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Employee, Schedule, ShiftTemplate, DayOfWeek } from '@/types'
import { storage } from '@/lib/storage'

export const maxDuration = 20

type GeminiSuggestInput = {
  employees: Employee[]
  schedules?: Schedule[]
  locale?: 'es' | 'en'
  instructions?: string
}

type GeminiSuggestOutput = {
  shiftTemplates: ShiftTemplate[]
  notes?: string
}

function normalizeShiftTemplates(templates: unknown): ShiftTemplate[] | null {
  if (!Array.isArray(templates)) return null
  const validDays: DayOfWeek[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  const dayAliases: Record<string, DayOfWeek> = {
    Monday: 'Lunes', Tuesday: 'Martes', Wednesday: 'Miércoles', Thursday: 'Jueves', Friday: 'Viernes', Saturday: 'Sábado', Sunday: 'Domingo',
    Lunes: 'Lunes', Martes: 'Martes', Miércoles: 'Miércoles', Jueves: 'Jueves', Viernes: 'Viernes', Sábado: 'Sábado', Domingo: 'Domingo'
  }
  const normalized: ShiftTemplate[] = []
  for (const item of templates) {
    if (!item) continue
    const startTime = String((item as any).startTime || '').slice(0, 5)
    const endTime = String((item as any).endTime || '').slice(0, 5)
    const day: string = (item as any).dayOfWeek
    const mapped = dayAliases[day]
    if (!mapped || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) continue
    normalized.push({ startTime, endTime, dayOfWeek: mapped })
  }
  const byDay = new Map<DayOfWeek, number>()
  for (const t of normalized) { byDay.set(t.dayOfWeek, (byDay.get(t.dayOfWeek) || 0) + 1) }
  if (validDays.some(d => (byDay.get(d) || 0) === 0)) return null
  return normalized
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<GeminiSuggestInput> & { instructions?: string }

    const [employees, schedules] = await Promise.all([
      storage.getEmployees(),
      storage.getSchedules(),
    ])

    const employeesSlim = employees.slice(0, 200).map(e => ({ id: e.id, name: e.name, availableDays: e.availableDays, department: e.department }))
    const schedulesSlim = schedules.slice(0, 3).map(s => ({
      id: s.id,
      startDate: s.startDate,
      endDate: s.endDate,
      days: s.days.slice(0, 15).map(d => ({ dayName: d.dayName, shifts: d.shifts.map(sh => ({ startTime: sh.startTime, endTime: sh.endTime, status: sh.status })) }))
    }))

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'missing_gemini_key' }, { status: 200 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' })

    const locale = 'es'
    const prompt = [
      locale === 'es'
        ? 'Genera una propuesta de plantillas de turnos para una operación 24/7 de 15 días con 3 turnos/día.'
        : 'Generate a proposal of shift templates for a 24/7 operation with 3 shifts per day over 15 days.',
      'Responde SOLO en JSON válido del tipo {"shiftTemplates":[{startTime,endTime,dayOfWeek}],"notes"?:string}.',
      'Requisitos:',
      '- Formato 24h HH:MM.',
      '- Si ajustas horas, mantén 3 turnos/día.',
      '- dayOfWeek debe ser uno de: Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo.',
      body?.instructions ? `Notas del usuario: ${body.instructions}` : undefined,
      employeesSlim.length > 0 ? `Empleados (resumen): ${JSON.stringify(employeesSlim)}` : undefined,
      schedulesSlim.length > 0 ? `Historial (reciente): ${JSON.stringify(schedulesSlim)}` : undefined,
    ].filter(Boolean).join('\n')

    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
    const text = result.response.text()

    let parsed: any
    try {
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 200 })
    }

    const normalized = normalizeShiftTemplates(parsed?.shiftTemplates)
    if (!normalized) {
      return NextResponse.json({ ok: false, error: 'bad_templates' }, { status: 200 })
    }

    const output: GeminiSuggestOutput = {
      shiftTemplates: normalized,
      notes: typeof parsed?.notes === 'string' ? parsed.notes : undefined
    }

    return NextResponse.json({ ok: true, data: output }, { status: 200 })
  } catch (err) {
    console.warn('[api/gemini/suggest] error', err)
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 200 })
  }
}
