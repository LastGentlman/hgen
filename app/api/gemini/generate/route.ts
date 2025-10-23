import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Employee, Schedule, ScheduleDay, Shift, BranchCode, Division } from '@/types'
import { storage } from '@/lib/storage'
import { generateId } from '@/lib/utils'

export const maxDuration = 40

type GeminiGenerateInput = {
  startDate: string
  name: string
  branchCode?: BranchCode
  division?: Division
  locale?: 'es' | 'en'
  instructions?: string
}

type AssignmentTurn = 'morning' | 'afternoon' | 'night'

type GeminiGeneratePlan = {
  days: Array<{
    date: string
    assignments: Array<{
      turn: AssignmentTurn | string
      employeeId: string
      position?: 'C1' | 'C2' | 'C3' | 'EXT'
    }>
  }>
}

type GeminiGenerateOutput = {
  schedule: Schedule
  notes?: string
}

const TURN_TO_TIME: Record<'morning' | 'afternoon' | 'night', { start: string; end: string }> = {
  morning: { start: '07:00', end: '15:00' },
  afternoon: { start: '15:00', end: '23:00' },
  night: { start: '23:00', end: '07:00' },
}

function computeQuincenaRange(startDate: string): { dateList: Array<{ date: string; dayName: string }>; endDate: string } {
  const [year, month, day] = startDate.split('-').map(Number)
  const start = new Date(year, month - 1, day)
  const startDay = start.getDate()

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

  let numDays: number
  let end: Date
  if (startDay === 1) {
    numDays = 15
    end = new Date(start.getFullYear(), start.getMonth(), 15)
  } else if (startDay === 16) {
    const lastDayOfMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
    numDays = lastDayOfMonth - 15
    end = new Date(start.getFullYear(), start.getMonth(), lastDayOfMonth)
  } else {
    numDays = 15
    end = new Date(start)
    end.setDate(end.getDate() + 14)
  }

  const dateList: Array<{ date: string; dayName: string }> = []
  for (let i = 0; i < numDays; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const date = `${yyyy}-${mm}-${dd}`
    const dayName = dayNames[d.getDay()]
    dateList.push({ date, dayName })
  }

  const yyyy = end.getFullYear()
  const mm = String(end.getMonth() + 1).padStart(2, '0')
  const dd = String(end.getDate()).padStart(2, '0')
  const endDate = `${yyyy}-${mm}-${dd}`

  return { dateList, endDate }
}

function mapLooseTurnToKey(turn: string): AssignmentTurn | null {
  const t = (turn || '').toLowerCase().trim()
  if (t === 'morning' || t === 'mañana' || t === 'manana' || t === 't1' || t === 'turno 1') return 'morning'
  if (t === 'afternoon' || t === 'tarde' || t === 't2' || t === 'turno 2') return 'afternoon'
  if (t === 'night' || t === 'noche' || t === 't3' || t === 'turno 3') return 'night'
  return null
}

function buildScheduleFromPlan(
  name: string,
  startDate: string,
  endDate: string,
  plan: GeminiGeneratePlan,
  validEmployeeIds: Set<string>,
  branchCode?: BranchCode,
  division?: Division
): Schedule | null {
  const days: ScheduleDay[] = []
  const planByDate = new Map<string, GeminiGeneratePlan['days'][number]>()
  for (const d of plan.days || []) {
    if (d && typeof d.date === 'string') planByDate.set(d.date, d)
  }

  // Build each day using the three standard turns
  const { dateList } = computeQuincenaRange(startDate)
  for (const { date, dayName } of dateList) {
    const dayAssignments = planByDate.get(date)?.assignments || []

    // Initialize map to track chosen employee per turn
    const turnToEmployee = new Map<AssignmentTurn, { employeeId: string; position?: 'C1' | 'C2' | 'C3' | 'EXT' }>()
    for (const a of dayAssignments) {
      const key = mapLooseTurnToKey(String(a.turn))
      if (!key) continue
      if (!a.employeeId || !validEmployeeIds.has(a.employeeId)) continue
      if (!turnToEmployee.has(key)) {
        turnToEmployee.set(key, { employeeId: a.employeeId, position: a.position })
      }
    }

    const shifts: Shift[] = []
    ;(['morning', 'afternoon', 'night'] as const).forEach((turn) => {
      const chosen = turnToEmployee.get(turn as AssignmentTurn)
      const { start, end } = TURN_TO_TIME[turn as 'morning' | 'afternoon' | 'night']
      shifts.push({
        id: generateId(),
        startTime: start,
        endTime: end,
        date,
        isAssigned: !!chosen,
        status: chosen ? 'assigned' : 'empty',
        employeeId: chosen?.employeeId,
        position: chosen?.position,
      })
    })

    days.push({ date, dayName, shifts })
  }

  const schedule: Schedule = {
    id: generateId(),
    name,
    startDate,
    endDate,
    days,
    branchCode,
    division,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  return schedule
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<GeminiGenerateInput>

    if (!body?.startDate || !body?.name) {
      return NextResponse.json({ ok: false, error: 'missing_params' }, { status: 200 })
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'missing_gemini_key' }, { status: 200 })
    }

    // Load context
    const [employeesAll, schedulesAll] = await Promise.all([
      storage.getEmployees(),
      storage.getSchedules(),
    ])

    // Filter employees by context; if not set, include all
    const employees = employeesAll.filter((e) => {
      if (body.branchCode && e.branchCode && e.branchCode !== body.branchCode) return false
      if (body.division && e.division && e.division !== body.division) return false
      return e.isActive !== false
    })

    // Recent schedules for this context
    const recent = schedulesAll
      .filter((s) => {
        if (body.branchCode && s.branchCode && s.branchCode !== body.branchCode) return false
        if (body.division && s.division && s.division !== body.division) return false
        return true
      })
      .slice(0, 3)
      .map((s) => ({
        id: s.id,
        name: s.name,
        startDate: s.startDate,
        endDate: s.endDate,
        days: s.days.slice(0, 15).map((d) => ({
          date: d.date,
          dayName: d.dayName,
          shifts: d.shifts.map((sh) => ({ startTime: sh.startTime, endTime: sh.endTime, status: sh.status, employeeId: sh.employeeId })),
        })),
        branchCode: s.branchCode,
        division: s.division,
      }))

    const { dateList, endDate } = computeQuincenaRange(body.startDate)

    const employeesSlim = employees.slice(0, 200).map((e) => ({
      id: e.id,
      name: e.name,
      availableDays: e.availableDays,
      assignedShift: e.assignedShift,
      branchCode: e.branchCode,
      division: e.division,
    }))

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' })

    const locale = (body.locale || 'es') as 'es' | 'en'

    const prompt = [
      locale === 'es'
        ? 'Eres un asistente experto creando horarios de 15 días para una operación 24/7 con 3 turnos diarios (Mañana, Tarde, Noche).'
        : 'You are an expert assistant creating 15-day schedules for a 24/7 operation with 3 daily shifts (Morning, Afternoon, Night).',
      locale === 'es'
        ? 'Usa el contexto (empleados y horarios previos) para generar un NUEVO horario completo, lo más cercano a cómo lo haría un humano.'
        : 'Use the context (employees and prior schedules) to generate a NEW full schedule as a human would.',
      locale === 'es'
        ? 'REGLAS: 1) 3 asignaciones por día (mañana, tarde, noche). 2) Respeta disponibilidad (availableDays) por nombre del día. 3) Evita noches consecutivas para la misma persona y distribuye equitativamente. 4) Usa assignedShift como preferencia. 5) No asignes a la misma persona 2 turnos el mismo día.'
        : 'RULES: 1) 3 assignments per day (morning, afternoon, night). 2) Respect availability (availableDays) by day name. 3) Avoid consecutive nights for the same person and distribute fairly. 4) Use assignedShift as a preference. 5) Do not assign the same person to 2 shifts on the same day.',
      locale === 'es'
        ? 'DEVUELVE SOLO JSON válido con la forma {"days":[{"date":"YYYY-MM-DD","assignments":[{"turn":"morning|afternoon|night","employeeId":"<uuid>","position":"C1|C2|C3|EXT"?}]}],"notes"?:string}. Usa EXCLUSIVAMENTE employeeId de la lista.'
        : 'RETURN ONLY valid JSON shaped as {"days":[{"date":"YYYY-MM-DD","assignments":[{"turn":"morning|afternoon|night","employeeId":"<uuid>","position":"C1|C2|C3|EXT"?}]}],"notes"?:string}. Use ONLY employeeId from the list.',
      body.instructions ? (locale === 'es' ? `Notas del usuario: ${body.instructions}` : `User notes: ${body.instructions}`) : undefined,
      locale === 'es' ? `Rango de días (quincena): ${JSON.stringify(dateList)}` : `Day range (15-day cycle): ${JSON.stringify(dateList)}`,
      locale === 'es' ? `Empleados: ${JSON.stringify(employeesSlim)}` : `Employees: ${JSON.stringify(employeesSlim)}`,
      recent.length > 0 ? (locale === 'es' ? `Horarios previos (resumen): ${JSON.stringify(recent)}` : `Prior schedules (summary): ${JSON.stringify(recent)}`) : undefined,
    ]
      .filter(Boolean)
      .join('\n')

    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
    const text = result.response.text()

    let parsed: any
    try {
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 200 })
    }

    const daysArr = Array.isArray(parsed?.days) ? parsed.days : []
    if (daysArr.length === 0) {
      return NextResponse.json({ ok: false, error: 'bad_plan' }, { status: 200 })
    }

    const validEmployeeIds = new Set(employees.map((e) => e.id))
    const plan: GeminiGeneratePlan = { days: daysArr }

    const schedule = buildScheduleFromPlan(
      body.name,
      body.startDate,
      endDate,
      plan,
      validEmployeeIds,
      body.branchCode as BranchCode | undefined,
      body.division as Division | undefined,
    )

    if (!schedule) {
      return NextResponse.json({ ok: false, error: 'build_failed' }, { status: 200 })
    }

    const output: GeminiGenerateOutput = {
      schedule,
      notes: typeof parsed?.notes === 'string' ? parsed.notes : undefined,
    }

    return NextResponse.json({ ok: true, data: output }, { status: 200 })
  } catch (err) {
    console.warn('[api/gemini/generate] error', err)
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 200 })
  }
}
