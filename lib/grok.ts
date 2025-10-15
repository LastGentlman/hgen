import { Employee, Schedule, ShiftTemplate, DayOfWeek } from '@/types'

// Minimal Grok (xAI) chat client
// Uses OpenAI-compatible Chat Completions endpoint

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

type ChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string }
  }>
}

const DEFAULT_GROK_ENDPOINT = process.env.GROK_API_BASE_URL || 'https://api.x.ai/v1/chat/completions'
const DEFAULT_GROK_MODEL = process.env.GROK_MODEL || 'grok-2-mini'

export type GrokSuggestInput = {
  employees: Employee[]
  schedules?: Schedule[]
  locale?: 'es' | 'en'
  instructions?: string
}

export type GrokSuggestOutput = {
  shiftTemplates: ShiftTemplate[]
  notes?: string
}

/**
 * Calls Grok to suggest shift templates. Server-side only.
 */
export async function grokSuggestShiftTemplates(input: GrokSuggestInput): Promise<GrokSuggestOutput | null> {
  const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY
  if (!apiKey) {
    console.warn('[grok] Missing GROK_API_KEY/XAI_API_KEY; skipping Grok call')
    return null
  }

  const locale = input.locale || 'es'

  const system: ChatMessage = {
    role: 'system',
    content:
      'Eres un asistente experto en generación de horarios 24/7. Respondes SOLO en JSON válido sin comentarios. '
      + 'Output: { "shiftTemplates": Array<{ startTime: string; endTime: string; dayOfWeek: "Lunes"|"Martes"|"Miércoles"|"Jueves"|"Viernes"|"Sábado"|"Domingo" }>, "notes"?: string }.'
  }

  // Limit employees and historical schedules sizes to keep prompt small
  const employeesSlim = input.employees.slice(0, 200).map(e => ({ id: e.id, name: e.name, availableDays: e.availableDays, department: e.department }))
  const schedulesSlim = (input.schedules || []).slice(0, 3).map(s => ({
    id: s.id,
    startDate: s.startDate,
    endDate: s.endDate,
    days: s.days.slice(0, 15).map(d => ({ dayName: d.dayName, shifts: d.shifts.map(sh => ({ startTime: sh.startTime, endTime: sh.endTime, status: sh.status })) }))
  }))

  const user: ChatMessage = {
    role: 'user',
    content: [
      locale === 'es'
        ? 'Genera una propuesta de plantillas de turnos para una operación 24/7 de 15 días con 3 turnos/día.'
        : 'Generate a proposal of shift templates for a 24/7 operation with 3 shifts per day over 15 days.',
      'Requisitos:',
      '- Formato 24h HH:MM.',
      '- Si ajustas horas, mantén 3 turnos/día.',
      '- dayOfWeek debe ser uno de: Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo.',
      input.instructions ? `Notas del usuario: ${input.instructions}` : undefined,
      employeesSlim.length > 0 ? `Empleados (resumen): ${JSON.stringify(employeesSlim)}` : undefined,
      schedulesSlim.length > 0 ? `Historial (reciente): ${JSON.stringify(schedulesSlim)}` : undefined,
      'Responde SOLO con JSON del tipo {"shiftTemplates":[...],"notes"?:string}.'
    ].filter(Boolean).join('\n')
  }

  const body = {
    model: DEFAULT_GROK_MODEL,
    messages: [system, user],
    temperature: 0.2,
    response_format: { type: 'json_object' as const }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  try {
    const resp = await fetch(DEFAULT_GROK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!resp.ok) {
      console.warn('[grok] Non-OK response', resp.status, await safeText(resp))
      return null
    }

    const json = (await resp.json()) as ChatCompletionResponse
    const content = json.choices?.[0]?.message?.content
    if (!content) return null

    const parsed = JSON.parse(content)
    const normalized = normalizeShiftTemplates(parsed?.shiftTemplates)
    if (!normalized) return null

    return { shiftTemplates: normalized, notes: typeof parsed?.notes === 'string' ? parsed.notes : undefined }
  } catch (err) {
    console.warn('[grok] Error calling API', err)
    return null
  } finally {
    clearTimeout(timeout)
  }
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
    if (!mapped || !isValidTime(startTime) || !isValidTime(endTime)) continue
    normalized.push({ startTime, endTime, dayOfWeek: mapped })
  }

  // Ensure we have at least one entry per day; otherwise return null
  const byDay = new Map<DayOfWeek, number>()
  for (const t of normalized) {
    byDay.set(t.dayOfWeek, (byDay.get(t.dayOfWeek) || 0) + 1)
  }
  if (validDays.some(d => (byDay.get(d) || 0) === 0)) {
    return null
  }
  return normalized
}

function isValidTime(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value)
}

async function safeText(resp: Response): Promise<string> {
  try { return await resp.text() } catch { return '' }
}
