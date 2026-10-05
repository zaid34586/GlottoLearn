import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { PageLoader, Badge, EmptyState } from '../../components/ui'
import { formatDate } from '../../lib/utils'
import type { Batch, Profile } from '../../lib/types'
import { cn } from '../../lib/utils'

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
}

type SignalMsg =
  | { kind: 'offer'; from: string; to: string; sdp: string }
  | { kind: 'answer'; from: string; to: string; sdp: string }
  | { kind: 'ice'; from: string; to: string; candidate: RTCIceCandidateInit }

interface ChatMsg { id: string; from: string; name: string; text: string; at: number }
interface PeerInfo { peerId: string; userId: string; name: string; role: string; hand: boolean }

export default function LiveClassroom() {
  const { batchId } = useParams()
  const { session, profile } = useAuth()
  const [batch, setBatch] = useState<Batch | null>(null)
  const [courseTitle, setCourseTitle] = useState('')
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [peers, setPeers] = useState<Record<string, PeerInfo>>({})
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('connecting')
  const [showParticipants, setShowParticipants] = useState(false)
  const [showChat, setShowChat] = useState(true)
  const [mediaError, setMediaError] = useState<string | null>(null)

  const peerIdRef = useRef(crypto.randomUUID())
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map())
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const joinedAtRef = useRef<number>(Date.now())
  const isTeacherRef = useRef(false)

  const isTeacher = batch ? batch.teacher_id === profile?.id || profile?.role === 'admin' : false
  isTeacherRef.current = isTeacher

  // ---------- Load batch + access check ----------
  useEffect(() => {
    if (!batchId || !session || !profile) return
    supabase.from('batches').select('*, course:courses(title, id)').eq('id', batchId).single().then(async ({ data }) => {
      const b = data as unknown as Batch
      if (!b) return setAllowed(false)
      setBatch(b)
      setCourseTitle((b as any).course?.title ?? '')
      if (b.teacher_id === profile.id || profile.role === 'admin') return setAllowed(true)
      // Server-side: requires course enrollment + a booked seat in this batch
      const { data: canJoin } = await supabase.rpc('can_join_batch', { p_batch_id: batchId })
      setAllowed(!!canJoin)
    })
  }, [batchId, session, profile])

  // ---------- Attendance ----------
  useEffect(() => {
    if (!batchId || !session || !allowed) return
    const uid = session.user.id
    supabase.from('attendance').upsert({ batch_id: batchId, student_id: uid, joined_at: new Date().toISOString() }, { onConflict: 'batch_id,student_id' }).then()
    return () => {
      const dur = Math.round((Date.now() - joinedAtRef.current) / 1000)
      supabase.from('attendance').update({ left_at: new Date().toISOString(), duration_sec: dur })
        .match({ batch_id: batchId, student_id: uid }).then()
    }
  }, [batchId, session, allowed])

  const sendSignal = useCallback((msg: SignalMsg | { kind: string; [k: string]: unknown }) => {
    channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: msg as any })
  }, [])

  const broadcastEvent = useCallback((event: string, payload: Record<string, unknown>) => {
    channelRef.current?.send({ type: 'broadcast', event, payload })
  }, [])

  // ---------- WebRTC helpers ----------
  const createPC = useCallback((remotePeerId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcsRef.current.set(remotePeerId, pc)

    localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!))

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal({ kind: 'ice', from: peerIdRef.current, to: remotePeerId, candidate: e.candidate.toJSON() })
    }
    pc.ontrack = (e) => {
      const stream = e.streams[0]
      const attach = () => {
        const el = remoteVideosRef.current.get(remotePeerId)
        if (el) {
          el.srcObject = stream
          el.play().catch(() => {})
        } else {
          setTimeout(attach, 200)
        }
      }
      attach()
      setPeers((p) => ({ ...p }))
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        pcsRef.current.delete(remotePeerId)
      }
    }
    return pc
  }, [sendSignal])

  // ---------- Join room ----------
  useEffect(() => {
    if (!batchId || !session || !profile || !allowed) return
    let cancelled = false
    const myPeerId = peerIdRef.current
    const myName = profile.full_name || 'Learner'
    const myRole = isTeacherRef.current ? 'teacher' : 'student'

    async function join() {
      // 1. Local media
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        localStreamRef.current = stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
          localVideoRef.current.play().catch(() => {})
        }
      } catch {
        setMediaError('Camera/microphone unavailable — you can still join with chat only.')
      }

      // 2. Realtime channel
      const channel = supabase.channel(`classroom:${batchId}`, {
        config: { broadcast: { self: false }, presence: { key: myPeerId } },
      })
      channelRef.current = channel

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState() as Record<string, any[]>
          const others: Record<string, PeerInfo> = {}
          for (const [pid, metas] of Object.entries(state)) {
            const meta = metas[0]
            if (pid !== myPeerId) {
              others[pid] = { peerId: pid, userId: meta.user_id, name: meta.name, role: meta.role, hand: !!meta.hand }
            }
          }
          setPeers(others)
          // Initiate connection to any peer we don't have yet (deterministic: higher peerId initiates)
          for (const pid of Object.keys(others)) {
            if (pid > myPeerId && !pcsRef.current.has(pid)) {
              initiateOffer(pid)
            }
          }
          // Clean up peers that left
          for (const pid of Array.from(pcsRef.current.keys())) {
            if (!others[pid]) {
              pcsRef.current.get(pid)?.close()
              pcsRef.current.delete(pid)
            }
          }
        })
        .on('broadcast', { event: 'signal' }, async ({ payload: msg }: any) => {
          if (msg.to !== myPeerId) return
          if (msg.kind === 'offer') {
            let pc = pcsRef.current.get(msg.from)
            if (!pc) pc = createPC(msg.from)
            await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp })
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            sendSignal({ kind: 'answer', from: myPeerId, to: msg.from, sdp: answer.sdp! })
          } else if (msg.kind === 'answer') {
            const pc = pcsRef.current.get(msg.from)
            if (pc) await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp })
          } else if (msg.kind === 'ice') {
            const pc = pcsRef.current.get(msg.from)
            if (pc) await pc.addIceCandidate(msg.candidate).catch(() => {})
          }
        })
        .on('broadcast', { event: 'chat' }, ({ payload }: any) => {
          setChat((c) => [...c.slice(-200), payload as ChatMsg])
        })
        .on('broadcast', { event: 'hand' }, ({ payload }: any) => {
          setPeers((p) => (p[payload.peerId] ? { ...p, [payload.peerId]: { ...p[payload.peerId], hand: payload.hand } } : p))
        })
        .on('broadcast', { event: 'batch-status' }, ({ payload }: any) => {
          setBatch((b) => (b ? { ...b, status: payload.status } : b))
        })
        .subscribe(async (s) => {
          if (s === 'SUBSCRIBED') {
            await channel.track({ user_id: profile!.id, name: myName, role: myRole, hand: false })
            setStatus('connected')
            // If I'm the newest low-id peer, existing higher-id peers will offer to me.
            // Also, existing peers with lower id than mine: I offer them via presence sync.
          }
        })
    }

    async function initiateOffer(remotePeerId: string) {
      const pc = createPC(remotePeerId)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      sendSignal({ kind: 'offer', from: myPeerId, to: remotePeerId, sdp: offer.sdp! })
    }

    join()

    return () => {
      cancelled = true
      pcsRef.current.forEach((pc) => pc.close())
      pcsRef.current.clear()
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
      channelRef.current?.unsubscribe()
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, session, profile, allowed])

  // ---------- Controls ----------
  function toggleMic() {
    const tracks = localStreamRef.current?.getAudioTracks() ?? []
    tracks.forEach((t) => (t.enabled = !micOn))
    setMicOn(!micOn)
  }
  function toggleCam() {
    const tracks = localStreamRef.current?.getVideoTracks() ?? []
    tracks.forEach((t) => (t.enabled = !camOn))
    setCamOn(!camOn)
  }

  function toggleHand() {
    const next = !handRaised
    setHandRaised(next)
    broadcastEvent('hand', { peerId: peerIdRef.current, hand: next })
  }

  async function toggleShare() {
    if (sharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenStreamRef.current = null
      // restore camera track to all senders
      const camTrack = localStreamRef.current?.getVideoTracks()[0]
      pcsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender && camTrack) sender.replaceTrack(camTrack)
      })
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current ?? null
      setSharing(false)
      return
    }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      screenStreamRef.current = screen
      const track = screen.getVideoTracks()[0]
      pcsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender) sender.replaceTrack(track)
      })
      if (localVideoRef.current) localVideoRef.current.srcObject = screen
      track.onended = () => toggleShare()
      setSharing(true)
    } catch {
      /* user cancelled */
    }
  }

  function sendChat(e: React.FormEvent) {
    e.preventDefault()
    if (!chatInput.trim() || !profile) return
    const msg: ChatMsg = { id: crypto.randomUUID(), from: peerIdRef.current, name: profile.full_name || 'Learner', text: chatInput.trim(), at: Date.now() }
    broadcastEvent('chat', msg as any)
    setChat((c) => [...c, msg])
    setChatInput('')
  }

  // ---------- Teacher: start/end class ----------
  async function setClassStatus(status: Batch['status']) {
    if (!batch) return
    await supabase.from('batches').update({ status }).eq('id', batch.id)
    setBatch({ ...batch, status })
    broadcastEvent('batch-status', { status })
  }

  // ---------- Teacher: recording ----------
  async function toggleRecording() {
    if (!recording) {
      const stream = localStreamRef.current
      if (!stream) return setMediaError('Cannot record without camera/mic access.')
      chunksRef.current = []
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm' })
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data)
      rec.onstop = saveRecording
      rec.start()
      recorderRef.current = rec
      setRecording(true)
    } else {
      recorderRef.current?.stop()
      setRecording(false)
    }
  }

  async function saveRecording() {
    if (!batch || !session) return
    const blob = new Blob(chunksRef.current, { type: 'video/webm' })
    if (blob.size === 0) return
    const path = `${batch.course_id}/${batch.id}-${Date.now()}.webm`
    const { error } = await supabase.storage.from('videos').upload(path, blob, { contentType: 'video/webm' })
    if (!error) {
      await supabase.from('recordings').insert({
        course_id: batch.course_id,
        batch_id: batch.id,
        title: `${batch.title} — Recording`,
        video_path: path,
        created_by: session.user.id,
      })
    } else {
      setMediaError('Recording upload failed: ' + error.message)
    }
  }

  if (allowed === null) return <PageLoader />
  if (!allowed || !batch) {
    return <EmptyState icon="🔒" title="You don't have access to this class" hint="Enroll in the course and reserve a free seat in Live Classes first." action={<Link to="/dashboard" className="btn-ghost mt-2">Back to Dashboard</Link>} />
  }

  const peerList = Object.values(peers)

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-lg font-bold text-white">{batch.title}</h1>
            {batch.status === 'live' && <Badge tone="green">🔴 LIVE</Badge>}
            {batch.status === 'completed' && <Badge tone="slate">ENDED</Badge>}
          </div>
          <p className="text-xs text-white/45">{courseTitle} · {formatDate(batch.scheduled_at)} · {batch.duration_min} min</p>
        </div>
        <div className="flex items-center gap-2">
          {isTeacher && batch.status !== 'live' && batch.status !== 'completed' && (
            <button className="btn-primary !py-2" onClick={() => setClassStatus('live')}>▶ Start Class</button>
          )}
          {isTeacher && batch.status === 'live' && (
            <>
              <button className={cn('btn-ghost !py-2', recording && '!border-red-400/60 !text-red-300')} onClick={toggleRecording}>
                {recording ? '⏹ Stop Recording' : '⏺ Record'}
              </button>
              <button className="btn-danger !py-2" onClick={() => setClassStatus('completed')}>End Class</button>
            </>
          )}
          {!isTeacher && batch.status === 'completed' && <Badge tone="slate">Class ended by teacher</Badge>}
        </div>
      </div>

      {mediaError && <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">{mediaError}</p>}

      {/* Video grid */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Local video */}
            <div className="relative overflow-hidden rounded-2xl bg-black/60">
              <video ref={localVideoRef} muted playsInline className="aspect-video w-full object-cover" />
              <div className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                You {isTeacher && '(Teacher)'} {micOn ? '' : '🔇'} {camOn ? '' : '📷'}
              </div>
              {handRaised && <span className="absolute right-2 top-2 animate-floaty text-2xl">✋</span>}
            </div>
            {/* Remote videos */}
            {peerList.map((p) => (
              <div key={p.peerId} className="relative overflow-hidden rounded-2xl bg-black/60">
                <video
                  ref={(el) => {
                    if (el) remoteVideosRef.current.set(p.peerId, el)
                    else remoteVideosRef.current.delete(p.peerId)
                  }}
                  autoPlay playsInline className="aspect-video w-full object-cover"
                />
                <div className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                  {p.name} {p.role === 'teacher' && '(Teacher)'}
                </div>
                {p.hand && <span className="absolute right-2 top-2 animate-floaty text-2xl">✋</span>}
              </div>
            ))}
            {peerList.length === 0 && status === 'connected' && (
              <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-white/15 text-sm text-white/40">
                Waiting for others to join…
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="glass mt-4 flex flex-wrap items-center justify-center gap-3 rounded-2xl p-4">
            <button onClick={toggleMic} className={cn('rounded-full border px-5 py-2.5 text-sm font-semibold', micOn ? 'border-white/20 bg-white/10 text-white' : 'border-red-400/50 bg-red-500/20 text-red-300')}>
              {micOn ? '🎙 Mute' : '🔇 Unmute'}
            </button>
            <button onClick={toggleCam} className={cn('rounded-full border px-5 py-2.5 text-sm font-semibold', camOn ? 'border-white/20 bg-white/10 text-white' : 'border-red-400/50 bg-red-500/20 text-red-300')}>
              {camOn ? '📷 Stop Video' : '📵 Start Video'}
            </button>
            <button onClick={toggleShare} className={cn('rounded-full border px-5 py-2.5 text-sm font-semibold', sharing ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300' : 'border-white/20 bg-white/10 text-white')}>
              {sharing ? '🛑 Stop Sharing' : '🖥 Share Screen'}
            </button>
            <button onClick={toggleHand} className={cn('rounded-full border px-5 py-2.5 text-sm font-semibold', handRaised ? 'border-amber-400/60 bg-amber-500/20 text-amber-300' : 'border-white/20 bg-white/10 text-white')}>
              ✋ {handRaised ? 'Lower Hand' : 'Raise Hand'}
            </button>
            <button onClick={() => setShowParticipants((v) => !v)} className="rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white">
              👥 {peerList.length + 1}
            </button>
          </div>
        </div>

        {/* Side panel: chat + participants */}
        <aside className="space-y-4">
          {showParticipants && (
            <div className="glass max-h-60 overflow-y-auto rounded-2xl p-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-white/50">Participants ({peerList.length + 1})</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between text-white">
                  <span>{profile?.full_name} {isTeacher && <span className="text-indigo-300">(Teacher)</span>}</span>
                  {handRaised && <span>✋</span>}
                </li>
                {peerList.map((p) => (
                  <li key={p.peerId} className="flex items-center justify-between text-white/75">
                    <span>{p.name} {p.role === 'teacher' && <span className="text-indigo-300">(Teacher)</span>}</span>
                    {p.hand && <span>✋</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="glass flex h-[420px] flex-col rounded-2xl">
            <button onClick={() => setShowChat((v) => !v)} className="border-b border-white/10 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-white/50">
              💬 Class Chat {showChat ? '▾' : '▸'}
            </button>
            {showChat && (
              <>
                <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
                  {chat.length === 0 && <p className="text-center text-xs text-white/30">Messages appear here for everyone in class.</p>}
                  {chat.map((m) => (
                    <div key={m.id} className={cn('text-sm', m.from === peerIdRef.current && 'text-right')}>
                      <span className={cn('inline-block max-w-[85%] rounded-xl px-3 py-2', m.from === peerIdRef.current ? 'bg-indigo-500/25 text-white' : 'bg-white/8 text-white/85')}>
                        <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-indigo-300">{m.name}</span>
                        {m.text}
                      </span>
                    </div>
                  ))}
                </div>
                <form onSubmit={sendChat} className="flex gap-2 border-t border-white/10 p-3">
                  <input className="field !py-2" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message…" />
                  <button className="btn-primary !px-4 !py-2">➤</button>
                </form>
              </>
            )}
          </div>
          <Link to={isTeacher ? '/teach/batches' : '/live-classes'} className="btn-ghost w-full">← Leave Class</Link>
        </aside>
      </div>
    </div>
  )
}
