import { NextRequest, NextResponse } from 'next/server'
import { grokSuggestShiftTemplates, GrokSuggestInput } from '@/lib/grok'
import { storage } from '@/lib/storage'

export const maxDuration = 20

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<GrokSuggestInput> & { instructions?: string }

    // Load employees and a small sample of recent schedules from server-side storage
    const [employees, schedules] = await Promise.all([
      storage.getEmployees(),
      storage.getSchedules(),
    ])

    const payload: GrokSuggestInput = {
      employees,
      schedules: schedules.slice(0, 3),
      locale: 'es',
      instructions: body?.instructions || undefined,
    }

    const result = await grokSuggestShiftTemplates(payload)

    if (!result) {
      return NextResponse.json({ ok: false, error: 'grok_failed' }, { status: 200 })
    }

    return NextResponse.json({ ok: true, data: result }, { status: 200 })
  } catch (err) {
    console.warn('[api/grok/suggest] error', err)
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 200 })
  }
}
