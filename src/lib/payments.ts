import type { Course } from './types'
import { supabase } from './supabase'

/**
 * Payment flow — Paddle Billing (overlay checkout, client-side token).
 *
 * Paddle mode: VITE_PADDLE_CLIENT_TOKEN is set AND the course has a
 *              paddle_price_id -> Paddle overlay checkout opens.
 *              Completion is recorded by the `paddle-webhook` edge
 *              function (signature-verified, service role). The client
 *              only polls enroll_in_course() until the webhook lands.
 * Demo mode:   otherwise -> record_demo_payment() RPC, gated server-side
 *              by the app_flags.demo_payments flag.
 *
 * The client can never write payment rows directly (migration 0003).
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
  onPaid: () => void
  onError: (message: string) => void
}

/** Poll enroll_in_course() until the Paddle webhook has recorded payment. */
async function waitForEnrollment(courseId: string): Promise<string | null> {
  const deadline = Date.now() + 60_000
  let last = 'Payment received, but enrollment is still processing. Check My Courses in a minute.'
  for (;;) {
    const { error } = await supabase.rpc('enroll_in_course', { p_course_id: courseId })
    if (!error) return null
    last = error.message
    if (Date.now() >= deadline) return last
    await new Promise((r) => setTimeout(r, 2000))
  }
}

export async function startCheckout({ course, studentEmail, userId, onPaid, onError }: CheckoutArgs) {
  // Demo mode — no Paddle token, or this course has no Paddle price attached
  if (isDemoPayments || !course.paddle_price_id) {
    const { error } = await supabase.rpc('record_demo_payment', { p_course_id: course.id })
    if (error) return onError(error.message)
    onPaid()
    return
  }

  const ok = await loadPaddle()
  if (!ok) return onError('Could not load payment gateway. Check your connection.')

  const Paddle = (window as any).Paddle

  let completed: (() => void) | null = null
  let failed: ((msg: string) => void) | null = null
  let gotTransaction = false

  try {
    if (import.meta.env.VITE_PADDLE_ENV === 'sandbox') Paddle.Environment.set('sandbox')
    Paddle.Initialize({
      token: paddleClientToken,
      eventCallback: (event: PaddleEvent) => {
        if (event.name === 'checkout.completed' && event.data) {
          gotTransaction = true
          completed?.()
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
    completed = async () => {
      // Webhook records payment + enrollment server-side; poll until it lands.
      const errMsg = await waitForEnrollment(course.id)
      if (errMsg) failed?.(errMsg)
      else {
        onPaid()
        resolve()
      }
    }
    failed = (msg: string) => {
      onError(msg)
      resolve()
    }
  })
}
