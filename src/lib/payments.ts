import type { Course } from './types'
import { supabase } from './supabase'

/**
 * Payment flow — Paddle Billing (overlay checkout, client-side token).
 *
 * Paddle mode: VITE_PADDLE_CLIENT_TOKEN is set AND the course has a
 *              paddle_price_id -> Paddle overlay checkout opens.
 * Demo mode:   otherwise -> a clearly-labelled demo checkout that records
 *              the payment directly so the full flow stays testable.
 *
 * v1 note: completion is captured from the checkout.completed event.
 * For production-grade guarantee, add a Paddle webhook -> server verify.
 */
export const paddleClientToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined
export const isDemoPayments = !paddleClientToken

type PaddleEvent = { name: string; data?: any; error?: any }

let paddleReady: Promise<boolean> | null = null

function loadPaddle(): Promise<boolean> {
  if (paddleReady) return paddleReady
  paddleReady = new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false)
    if ((window as any).Paddle) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
  return paddleReady
}

export interface CheckoutArgs {
  course: Course
  studentName: string
  studentEmail: string
  userId: string
  onPaid: (paymentId: string) => void
  onError: (message: string) => void
}

async function recordPayment(userId: string, course: Course, gateway: string, gatewayRef: string) {
  return supabase
    .from('payments')
    .insert({
      student_id: userId,
      course_id: course.id,
      amount: course.price_inr,
      gateway,
      gateway_ref: gatewayRef,
      status: 'paid',
    })
    .select('id')
    .single()
}

export async function startCheckout({ course, studentEmail, userId, onPaid, onError }: CheckoutArgs) {
  // Demo mode — no Paddle token, or this course has no Paddle price attached
  if (isDemoPayments || !course.paddle_price_id) {
    const { data, error } = await recordPayment(userId, course, 'demo', 'DEMO-' + crypto.randomUUID().slice(0, 8))
    if (error) return onError(error.message)
    onPaid(data.id)
    return
  }

  const ok = await loadPaddle()
  if (!ok) return onError('Could not load payment gateway. Check your connection.')

  const Paddle = (window as any).Paddle

  let completed: ((paymentId: string) => void) | null = null
  let failed: ((msg: string) => void) | null = null
  let gotTransaction = false

  try {
    if (import.meta.env.VITE_PADDLE_ENV === 'sandbox') Paddle.Environment.set('sandbox')
    Paddle.Initialize({
      token: paddleClientToken,
      eventCallback: (event: PaddleEvent) => {
        if (event.name === 'checkout.completed' && event.data) {
          gotTransaction = true
          completed?.(event.data.transaction_id ?? 'paddle-' + Date.now())
        }
        if (event.name === 'checkout.closed' && !gotTransaction) {
          failed?.('Payment cancelled.')
        }
        if (event.name === 'checkout.error') {
          failed?.(event.error?.message ?? 'Payment failed. Please try again.')
        }
      },
    })
  } catch {
    // already initialized in this session — continue to open
  }

  Paddle.Checkout.open({
    settings: {
      displayMode: 'overlay',
      theme: 'light',
      locale: 'en',
    },
    items: [{ priceId: course.paddle_price_id, quantity: 1 }],
    customer: { email: studentEmail },
    customData: { user_id: userId, course_id: course.id, course_title: course.title },
  })

  await new Promise<void>((resolve) => {
    completed = async (txnId: string) => {
      const { data, error } = await recordPayment(userId, course, 'paddle', txnId)
      if (error) failed?.(error.message)
      else onPaid(data.id)
      resolve()
    }
    failed = (msg: string) => {
      onError(msg)
      resolve()
    }
  })
}
