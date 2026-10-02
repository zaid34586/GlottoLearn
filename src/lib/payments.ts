import type { Course } from './types'
import { supabase } from './supabase'

/**
 * Payment flow.
 *
 * Real mode:  VITE_RAZORPAY_KEY_ID is set -> Razorpay Checkout opens.
 * Demo mode:  no key configured -> a clearly-labelled demo checkout that
 *             records the payment directly. Swap to a real gateway by setting
 *             the key + adding server-side order creation.
 */
export const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined
export const isDemoPayments = !razorpayKeyId

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false)
    if ((window as any).Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export interface CheckoutArgs {
  course: Course
  studentName: string
  studentEmail: string
  userId: string
  onPaid: (paymentId: string) => void
  onError: (message: string) => void
}

export async function startCheckout({ course, studentName, studentEmail, userId, onPaid, onError }: CheckoutArgs) {
  if (isDemoPayments) {
    const { data, error } = await supabase
      .from('payments')
      .insert({
        student_id: userId,
        course_id: course.id,
        amount: course.price_inr,
        gateway: 'demo',
        gateway_ref: 'DEMO-' + crypto.randomUUID().slice(0, 8),
        status: 'paid',
      })
      .select('id')
      .single()
    if (error) return onError(error.message)
    onPaid(data.id)
    return
  }

  const ok = await loadRazorpay()
  if (!ok) return onError('Could not load payment gateway. Check your connection.')

  // NOTE: production hardening requires a server endpoint that creates the
  // Razorpay order and verifies the signature. This client-first integration
  // records the payment after checkout.success for v1.
  const rzp = new (window as any).Razorpay({
    key: razorpayKeyId,
    amount: Math.round(course.price_inr * 100),
    currency: 'INR',
    name: 'GlottoLearn',
    description: course.title,
    prefill: { name: studentName, email: studentEmail },
    theme: { color: '#6366f1' },
    handler: async (resp: any) => {
      const { data, error } = await supabase
        .from('payments')
        .insert({
          student_id: userId,
          course_id: course.id,
          amount: course.price_inr,
          gateway: 'razorpay',
          gateway_ref: resp.razorpay_payment_id,
          status: 'paid',
        })
        .select('id')
        .single()
      if (error) return onError(error.message)
      onPaid(data.id)
    },
    modal: { ondismiss: () => onError('Payment cancelled.') },
  })
  rzp.open()
}
