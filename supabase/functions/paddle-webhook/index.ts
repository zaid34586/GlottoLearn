// ============================================================
// GlottoLearn — Paddle webhook (Supabase Edge Function)
//
// Receives Paddle Billing events, verifies the HMAC signature,
// and records payment + enrollment with the service role — the
// only path that can mark a payment 'paid' in live mode.
//
// Deploy:
//   supabase functions deploy paddle-webhook --no-verify-jwt
// Secrets:
//   supabase secrets set PADDLE_WEBHOOK_SECRET=<from Paddle dashboard>
//   (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically)
//
// Paddle dashboard → Notifications → create webhook:
//   https://<project-ref>.supabase.co/functions/v1/paddle-webhook
//   events: transaction.completed, payment.succeeded
//
// Signature format: Paddle-Signature: ts=<unix>;h1=<hex>
//   h1 = HMAC-SHA256(secret, ts + ":" + rawBody)
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2'

const encoder = new TextEncoder()
const PURCHASE_EVENTS = new Set(['transaction.completed', 'payment.succeeded'])
const TS_TOLERANCE_SEC = 300

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function verifySignature(rawBody: string, header: string, secret: string): Promise<boolean> {
  const parts = header.split(';')
  const ts = parts.find((p) => p.startsWith('ts='))?.slice(3)
  const signatures = parts.filter((p) => p.startsWith('h1=')).map((p) => p.slice(3))
  if (!ts || signatures.length === 0) return false
  const tsNum = Number(ts)
  if (!Number.isFinite(tsNum)) return false
  if (Math.abs(Math.floor(Date.now() / 1000) - tsNum) > TS_TOLERANCE_SEC) return false

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${ts}:${rawBody}`))
  const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return signatures.some((s) => timingSafeEqual(s, expected))
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const rawBody = await req.text()
  const signature = req.headers.get('paddle-signature') ?? ''
  const secret = Deno.env.get('PADDLE_WEBHOOK_SECRET')

  if (!secret) return json({ error: 'PADDLE_WEBHOOK_SECRET not configured' }, 500)
  if (!rawBody || !signature) return json({ error: 'Missing body or signature' }, 400)

  // Signature failure → 401 (never trust the payload).
  if (!(await verifySignature(rawBody, signature, secret))) {
    return json({ error: 'Invalid signature' }, 401)
  }

  let event: { event_type?: string; data?: Record<string, any> }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  // Acknowledge everything else quickly — Paddle retries non-2xx.
  if (!event.event_type || !PURCHASE_EVENTS.has(event.event_type)) {
    return json({ received: true, ignored: event.event_type })
  }

  const data = event.data ?? {}
  const custom = data.custom_data ?? {}
  const userId = String(custom.user_id ?? '')
  const courseId = String(custom.course_id ?? '')
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
  if (!uuidRe.test(userId) || !uuidRe.test(courseId)) {
    return json({ received: true, skipped: 'missing or invalid custom_data' })
  }

  const transactionId = String(data.transaction_id ?? data.id ?? '')
  if (!transactionId) return json({ received: true, skipped: 'no transaction id' })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  // Amount comes from OUR price list — never trust client/checkout input.
  const { data: course } = await supabase
    .from('courses')
    .select('id, price_inr')
    .eq('id', courseId)
    .maybeSingle()
  if (!course) return json({ received: true, skipped: 'unknown course' })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()
  if (!profile) return json({ received: true, skipped: 'unknown user' })

  // Idempotent: Paddle retries events — reuse the payment row if it exists.
  let paymentId: string
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('gateway', 'paddle')
    .eq('gateway_ref', transactionId)
    .maybeSingle()

  if (existing) {
    paymentId = existing.id
  } else {
    const { data: created, error: payErr } = await supabase
      .from('payments')
      .insert({
        student_id: userId,
        course_id: courseId,
        amount: course.price_inr,
        currency: String(data.currency_code ?? 'INR'),
        gateway: 'paddle',
        gateway_ref: transactionId,
        status: 'paid',
      })
      .select('id')
      .single()
    if (payErr || !created) {
      console.error('payment insert failed', payErr)
      return json({ error: 'Failed to record payment' }, 500) // Paddle retries
    }
    paymentId = created.id
  }

  const { error: enrErr } = await supabase
    .from('enrollments')
    .upsert(
      { course_id: courseId, student_id: userId, payment_id: paymentId },
      { onConflict: 'course_id,student_id', ignoreDuplicates: true },
    )
  if (enrErr) {
    console.error('enrollment upsert failed', enrErr)
    return json({ error: 'Failed to record enrollment' }, 500)
  }

  return json({ received: true, payment_id: paymentId })
})
