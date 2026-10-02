import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PageLoader, EmptyState, Badge } from '../../components/ui'
import { formatINR, formatDate } from '../../lib/utils'
import type { Payment } from '../../lib/types'
import { isDemoPayments } from '../../lib/payments'

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase
      .from('payments')
      .select('*, student:profiles!payments_student_id_fkey(*), course:courses(title)')
      .order('created_at', { ascending: false })
    setPayments((data as unknown as Payment[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function markRefunded(p: Payment) {
    // Refund marking: set to failed (money-flow reversal tracked outside app for v1)
    await supabase.from('payments').update({ status: 'failed' }).eq('id', p.id)
    load()
  }

  function exportCSV() {
    const rows = [
      ['Date', 'Student', 'Course', 'Amount', 'Currency', 'Gateway', 'Reference', 'Status'],
      ...payments.map((p) => [
        new Date(p.created_at).toISOString(),
        p.student?.full_name ?? '',
        (p as any).course?.title ?? '',
        String(p.amount),
        p.currency,
        p.gateway,
        p.gateway_ref ?? '',
        p.status,
      ]),
    ]
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `glottolearn-payments-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <PageLoader />

  const paid = payments.filter((p) => p.status === 'paid')
  const revenue = paid.reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Payments</h1>
          <p className="mt-1 text-sm text-slate-500">
            {paid.length} transactions · Revenue: <span className="font-bold text-emerald-600">{formatINR(revenue)}</span>
            {isDemoPayments && ' · ⚠ demo mode'}
          </p>
        </div>
        <button className="btn-ghost" onClick={exportCSV}>⬇ Export CSV</button>
      </div>

      {payments.length === 0 ? (
        <div className="mt-8"><EmptyState icon="💳" title="No transactions yet" hint="Payments appear here as students enroll." /></div>
      ) : (
        <div className="glass mt-6 overflow-x-auto rounded-2xl">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Course</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Gateway</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3 text-slate-500">{formatDate(p.created_at)}</td>
                  <td className="px-5 py-3 text-slate-800">{p.student?.full_name ?? p.student_id.slice(0, 8)}</td>
                  <td className="px-5 py-3 text-slate-600">{(p as any).course?.title ?? '—'}</td>
                  <td className="px-5 py-3 font-semibold text-slate-900">{formatINR(Number(p.amount))}</td>
                  <td className="px-5 py-3 text-xs uppercase text-slate-400">{p.gateway}</td>
                  <td className="px-5 py-3">
                    <Badge tone={p.status === 'paid' ? 'green' : p.status === 'pending' ? 'amber' : 'red'}>{p.status.toUpperCase()}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    {p.status === 'paid' && (
                      <button className="text-xs font-semibold text-amber-600 hover:text-amber-600" onClick={() => markRefunded(p)}>Mark refunded</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
