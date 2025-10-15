// Deprecated route kept for backward compatibility. Redirect to Gemini.
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 20

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const resp = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/gemini/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    const json = await resp.json()
    return NextResponse.json(json, { status: 200 })
  } catch (err) {
    console.warn('[api/grok/suggest] redirect error', err)
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 200 })
  }
}
