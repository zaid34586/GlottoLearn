import { useState } from 'react'
import { supabase } from '../lib/supabase'

/** Course cover/thumbnail picker → uploads to the public 'covers' bucket, returns a public URL. */
export function CoverUpload({ value, onChange, pathPrefix }: {
  value: string | null
  onChange: (url: string | null) => void
  pathPrefix?: string
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('Please choose an image file (JPG/PNG/WebP).'); return }
    setBusy(true)
    setErr(null)
    const path = `${pathPrefix ?? 'general'}/${crypto.randomUUID()}-${file.name}`
    const { error } = await supabase.storage.from('covers').upload(path, file)
    if (error) { setBusy(false); setErr(error.message); return }
    const { data } = supabase.storage.from('covers').getPublicUrl(path)
    onChange(data.publicUrl)
    setBusy(false)
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Cover thumbnail</label>
      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-slate-200">
          <img src={value} alt="Course cover" className="h-36 w-full object-cover" />
          <div className="absolute right-2 top-2 flex gap-2">
            <label className="cursor-pointer rounded-lg bg-white/90 px-2.5 py-1 text-xs font-bold text-slate-700 shadow hover:bg-white">
              {busy ? 'Uploading…' : 'Replace'}
              <input type="file" accept="image/*" className="hidden" onChange={pick} disabled={busy} />
            </label>
            <button
              type="button"
              className="rounded-lg bg-white/90 px-2.5 py-1 text-xs font-bold text-red-600 shadow hover:bg-white"
              onClick={() => onChange(null)}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-8 text-sm text-slate-500 transition hover:border-indigo-400 hover:text-indigo-600">
          <span>{busy ? 'Uploading…' : '🖼️ Click to choose an image'}</span>
          <input type="file" accept="image/*" className="hidden" onChange={pick} disabled={busy} />
        </label>
      )}
      <p className="mt-1 text-[11px] text-slate-400">Shown on course cards & the course page. Recommended 1280×720.</p>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  )
}

/** Public demo/preview video picker → uploads to the public 'demos' bucket, returns a storage path. */
export function DemoVideoUpload({ value, onChange, pathPrefix }: {
  value: string | null
  onChange: (path: string | null) => void
  pathPrefix?: string
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const publicUrl = value ? supabase.storage.from('demos').getPublicUrl(value).data.publicUrl : null

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('video/')) { setErr('Please choose a video file (MP4/WebM).'); return }
    setBusy(true)
    setErr(null)
    const path = `${pathPrefix ?? 'general'}/${crypto.randomUUID()}-${file.name}`
    const { error } = await supabase.storage.from('demos').upload(path, file)
    if (error) { setBusy(false); setErr(error.message); return }
    onChange(path)
    setBusy(false)
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Demo / preview video</label>
      {publicUrl ? (
        <div className="space-y-2">
          <video key={publicUrl} src={publicUrl} controls preload="metadata" className="w-full rounded-xl bg-black" />
          <div className="flex gap-2">
            <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
              {busy ? 'Uploading…' : 'Replace video'}
              <input type="file" accept="video/*" className="hidden" onChange={pick} disabled={busy} />
            </label>
            <button
              type="button"
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
              onClick={() => onChange(null)}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-8 text-sm text-slate-500 transition hover:border-indigo-400 hover:text-indigo-600">
          <span>{busy ? 'Uploading video…' : '🎬 Click to upload a preview (MP4/WebM)'}</span>
          <input type="file" accept="video/*" className="hidden" onChange={pick} disabled={busy} />
        </label>
      )}
      <p className="mt-1 text-[11px] text-slate-400">Everyone can watch this before buying — free marketing for your course.</p>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  )
}
