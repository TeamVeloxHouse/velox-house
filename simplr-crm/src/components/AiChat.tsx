import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { answer, generateProspects, type AiBlock, type AiResponse, type RunPlan, type RunOp } from '../lib/ai'
import { runOviAgent, oviIsLive, type OviStep, type AnthMessage } from '../lib/oviAgent'
import { Avatar, Chip, type ChipTone } from './ui'
import { Sparkle, Send, Check, Envelope, Play } from './icons'
import { money, classNames } from '../lib/format'
import type { Health } from '../data/mock'
import { useState_, useActions } from '../store/store'

type MiniDeal = { id: string; name: string; org: string; stage: string; value: number; health: Health }

export type ChatTurn = { role: 'user' | 'ai'; text?: string; res?: AiResponse; pending?: boolean }

/** Render simple **bold** markdown inline. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <span className="whitespace-pre-wrap leading-relaxed">
      {parts.map((p, i) =>
        p.startsWith('**') ? (
          <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  )
}

const healthTone: Record<Health, ChipTone> = { Healthy: 'positive', 'At risk': 'warning', Stalled: 'negative', 'No next step': 'warning' }

function DealMini({ d, onOpen }: { d: MiniDeal; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="w-full text-left bg-surface border border-border rounded-lg p-3 hover:border-border-blue hover:shadow-card transition-all flex items-center gap-3">
      <Avatar name={d.org} size={30} square variant="neutral" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-ink-2 truncate">{d.name}</div>
        <div className="text-[12px] text-muted-2 truncate">{d.org} · {d.stage}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[13px] font-bold text-ink-2">{money(d.value, { compact: true })}</div>
        <Chip tone={healthTone[d.health]}>{d.health}</Chip>
      </div>
    </button>
  )
}

function Block({ b }: { b: AiBlock }) {
  const nav = useNavigate()
  if (b.type === 'text') return <p className="text-[13.5px] text-ink-3"><RichText text={b.text} /></p>
  if (b.type === 'deals')
    return (
      <div className="flex flex-col gap-2">
        {b.deals.map((d) => (
          <DealMini key={d.id} d={d} onOpen={() => nav(`/deals/${d.id}`)} />
        ))}
      </div>
    )
  if (b.type === 'stats')
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {b.items.map((s, i) => (
          <div key={i} className="bg-surface border border-border rounded-lg p-2.5">
            <div className="text-[11px] text-muted-2">{s.label}</div>
            <div className={classNames('text-[15px] font-bold mt-0.5', s.tone === 'positive' && 'text-positive', s.tone === 'negative' && 'text-negative', !s.tone && 'text-ink')}>{s.value}</div>
          </div>
        ))}
      </div>
    )
  if (b.type === 'tasks')
    return (
      <div className="flex flex-col gap-1.5">
        {b.items.map((t, i) => (
          <div key={i} className="flex items-start gap-2.5 bg-surface border border-border rounded-lg p-2.5">
            <span className="mt-0.5 w-4 h-4 rounded-md border border-input-border shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-ink-2">{t.label}</div>
              <div className="text-[12px] text-muted-2">{t.meta}</div>
            </div>
          </div>
        ))}
      </div>
    )
  if (b.type === 'email')
    return (
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-3.5 py-2 border-b border-divider bg-[#FBFCFF] text-[12px] flex flex-col gap-0.5">
          <div><span className="text-muted-2">To</span> <span className="text-ink-2 font-medium">{b.to}</span></div>
          <div><span className="text-muted-2">Subject</span> <span className="text-ink-2 font-semibold">{b.subject}</span></div>
        </div>
        <div className="px-3.5 py-3 text-[13px] text-ink-2 whitespace-pre-wrap leading-relaxed max-h-[220px] overflow-y-auto">{b.body}</div>
      </div>
    )
  if (b.type === 'workflow')
    return (
      <div className="rounded-card border border-border bg-surface-tint overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-divider flex items-center gap-2 text-[12px] font-semibold text-accent-700">
          <Sparkle size={13} /> {b.title}
        </div>
        <div className="py-1">
          {b.steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2.5 px-3.5 py-2">
              <span className="mt-0.5 shrink-0">
                {s.status === 'done' ? (
                  <span className="w-4 h-4 rounded-full bg-positive flex items-center justify-center"><Check size={11} className="text-white" strokeWidth={3} /></span>
                ) : s.status === 'running' ? (
                  <span className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin inline-block" />
                ) : (
                  <span className="w-4 h-4 rounded-full border-2 border-input-border inline-block" />
                )}
              </span>
              <span className="min-w-0">
                <span className={classNames('block text-[13px]', s.status === 'done' ? 'text-ink-2 font-medium' : s.status === 'running' ? 'text-ink-2 font-semibold' : 'text-muted-3')}>{s.label}{s.status === 'running' && <span className="text-muted-2 font-normal"> …</span>}</span>
                {s.detail && s.status === 'done' && <span className="block text-[12px] text-positive mt-0.5">{s.detail}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  if (b.type === 'actions')
    return (
      <div className="flex flex-wrap gap-2">
        {b.items.map((a, i) => (
          <AiActionButton key={i} label={a.label} primary={i === 0} />
        ))}
      </div>
    )
  if (b.type === 'approval')
    return (
      <div className={classNames('rounded-xl border p-3', b.status === 'pending' ? 'border-warning-border bg-[#FDF6EC]' : b.status === 'approved' ? 'border-positive-border bg-[#F4FAF8]' : 'border-border bg-control')}>
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2 mb-1.5"><Sparkle size={13} className="text-warning" /> Approval needed</div>
        <div className="text-[13px] text-ink-3">{b.summary}</div>
        {b.status === 'pending' ? (
          <div className="flex gap-2 mt-2.5">
            <button onClick={() => window.dispatchEvent(new CustomEvent('ovi-approve', { detail: { id: b.id, ok: true } }))} className="h-8 px-3 rounded-lg bg-accent text-white text-[12.5px] font-semibold flex items-center gap-1.5"><Check size={13} /> Approve</button>
            <button onClick={() => window.dispatchEvent(new CustomEvent('ovi-approve', { detail: { id: b.id, ok: false } }))} className="h-8 px-3 rounded-lg border border-border text-ink-3 text-[12.5px] font-medium hover:bg-control">Cancel</button>
          </div>
        ) : (
          <div className={classNames('text-[12px] font-semibold mt-1.5', b.status === 'approved' ? 'text-positive' : 'text-muted-2')}>{b.status === 'approved' ? '✓ Approved' : 'Cancelled'}</div>
        )}
      </div>
    )
  if (b.type === 'opsteps')
    return (
      <div className="flex flex-col gap-1.5">
        {b.steps.map((s) => (
          <div key={s.id} className="flex items-center gap-2 text-[12.5px]">
            {s.status === 'done' ? <span className="w-4 h-4 rounded-full bg-positive flex items-center justify-center shrink-0"><Check size={10} className="text-white" strokeWidth={3} /></span>
              : s.status === 'error' ? <span className="w-4 h-4 rounded-full bg-negative text-white flex items-center justify-center shrink-0 text-[10px]">!</span>
              : <span className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin inline-block shrink-0" />}
            <span className={classNames('min-w-0 truncate', s.status === 'done' ? 'text-ink-2 font-medium' : s.status === 'error' ? 'text-negative' : 'text-ink-2 font-semibold')}>{s.label}{s.status === 'running' && ' …'}</span>
          </div>
        ))}
      </div>
    )
  return null
}

/** An AI action chip that actually mutates the store or re-asks the model. */
function AiActionButton({ label, primary }: { label: string; primary: boolean }) {
  const nav = useNavigate()
  const act = useActions()
  const { deals } = useState_()
  const [done, setDone] = useState(false)

  const l = label.toLowerCase()
  function run() {
    // Operator follow-ups
    if (l.includes('email them') || l === 'now email them') {
      window.dispatchEvent(new CustomEvent('simplr-ai-ask', { detail: 'Email the prospects I just found and launch a multichannel campaign' }))
      return
    }
    if (l.includes('schedule') || l.includes('weekly') || l.includes('cadence')) {
      window.dispatchEvent(new CustomEvent('simplr-ai-ask', { detail: 'Schedule this to find new prospects and email them every Monday' }))
      return
    }
    if (l.includes('campaign')) { nav('/reach/campaigns'); return }
    if (l.includes('scheduled task')) { nav('/reach/schedules'); return }
    // Re-ask the model for "show / which / what / why" style actions
    if (/^(show|which|what|why|my |high|accounts)/.test(l) || l.includes('go to')) {
      window.dispatchEvent(new CustomEvent('simplr-ai-ask', { detail: label }))
      return
    }
    const risk = deals.filter((d) => !d.won && !d.lost && (d.health === 'At risk' || d.health === 'Stalled' || d.health === 'No next step'))
    if (l.includes('task') || l.includes('next step')) {
      risk.slice(0, 3).forEach((d) => act.addActivity({ type: 'task', subject: `Follow up — ${d.org}`, dealId: d.id, personId: d.personIds[0], due: 'Tomorrow', priority: 'High', source: 'ai' }))
      act.toast(`Added ${Math.min(3, risk.length)} tasks to your at-risk deals`)
    } else if (l.includes('schedule') && l.includes('call')) {
      risk.slice(0, 2).forEach((d) => act.addActivity({ type: 'call', subject: `Call — ${d.org}`, dealId: d.id, personId: d.personIds[0], due: 'Tomorrow · 10:00', priority: 'High', source: 'ai' }))
      act.toast('Calls scheduled')
    } else if (l.includes('draft') || l.includes('re-engagement') || l.includes('follow-up') || l.includes('check-in')) {
      act.toast('Drafts ready in your inbox for review', 'accent')
    } else if (l.includes('send')) {
      act.toast('Email sent')
    } else if (l.includes('open deal') || l.includes('pipeline')) {
      nav('/deals')
      return
    } else if (l.includes('forecast') || l.includes('report')) {
      nav('/insights')
      return
    } else if (l.includes('snooze')) {
      act.toast('Low-priority items snoozed', 'warning')
    } else {
      act.toast('Done')
    }
    setDone(true)
  }

  return (
    <button
      onClick={run}
      className={classNames(
        'h-8 px-3 rounded-lg text-[12.5px] font-medium border transition-colors flex items-center gap-1.5',
        done ? 'bg-positive-wash border-positive-border text-positive' : primary ? 'bg-accent-wash border-border-blue text-accent hover:bg-[#E4ECFB]' : 'border-border text-ink-3 hover:bg-control',
      )}
    >
      {done ? <Check size={13} /> : primary ? <Sparkle size={13} /> : null}
      {done ? 'Done' : label}
    </button>
  )
}

export function AiMessage({ turn }: { turn: ChatTurn }) {
  if (turn.role === 'user')
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-accent-gradient text-white rounded-2xl rounded-tr-md px-3.5 py-2.5 text-[13.5px] shadow-primary">{turn.text}</div>
      </div>
    )
  return (
    <div className="flex gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-accent-gradient text-white flex items-center justify-center shrink-0 shadow-primary">
        <Sparkle size={15} />
      </div>
      <div className="min-w-0 flex-1 flex flex-col gap-2.5 pt-0.5">
        {turn.pending ? (
          <div className="flex items-center gap-2 text-[13px] text-muted-2">
            {turn.res?.thinking && <span>{turn.res.thinking}</span>}
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:-0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:-0.1s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" />
            </span>
          </div>
        ) : (
          turn.res?.blocks.map((b, i) => <Block key={i} b={b} />)
        )}
        {!turn.pending && turn.res?.suggestions && turn.res.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {turn.res.suggestions.map((s, i) => (
              <SuggestChip key={i} label={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// SuggestChip is wired by the parent via context-free custom event to keep this file simple.
function SuggestChip({ label }: { label: string }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent('simplr-ai-ask', { detail: label }))}
      className="text-[12px] text-accent bg-accent-wash hover:bg-[#E4ECFB] rounded-full px-2.5 py-1 font-medium transition-colors"
    >
      {label}
    </button>
  )
}

/** Shared chat state with live, step-by-step operator execution.
 *  `listen` (default true) subscribes to the global `simplr-ai-ask` event — keep it
 *  true for exactly one instance (the floating assistant) to avoid double execution. */
const OVI_CHAT_KEY = 'simplr.ovi.chat.v1'

export function useChat(seed?: ChatTurn[], opts?: { listen?: boolean; persist?: boolean }) {
  // Restore a persisted conversation (so you can pick up yesterday's chat).
  const restored = (() => {
    if (!opts?.persist || seed) return null
    try { const raw = localStorage.getItem(OVI_CHAT_KEY); return raw ? (JSON.parse(raw) as { turns: ChatTurn[]; history: AnthMessage[] }) : null } catch { return null }
  })()
  const [turns, setTurns] = useState<ChatTurn[]>(restored?.turns ?? seed ?? [])
  const act = useActions()
  const nav = useNavigate()
  const busyRef = useRef(false)
  const liveRef = useRef<boolean | null>(null)      // is a real model wired up? (cached)
  const historyRef = useRef<AnthMessage[]>(restored?.history ?? [])  // running Anthropic message history

  // Persist the conversation whenever it settles (not mid-stream).
  useEffect(() => {
    if (!opts?.persist) return
    if (turns.some((t) => t.pending)) return
    try { localStorage.setItem(OVI_CHAT_KEY, JSON.stringify({ turns, history: historyRef.current })) } catch { /* ignore quota */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns])
  const approvals = useRef<Map<string, (ok: boolean) => void>>(new Map())

  // Inline approval: render an Approve/Cancel card and resolve when the user clicks.
  function confirmInline(summary: string): Promise<boolean> {
    return new Promise((resolve) => {
      const id = `ap${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
      approvals.current.set(id, resolve)
      updateLastAi((r) => ({ ...r, blocks: [...r.blocks, { type: 'approval', id, summary, status: 'pending' }] }))
    })
  }
  useEffect(() => {
    const h = (e: Event) => {
      const { id, ok } = (e as CustomEvent).detail as { id: string; ok: boolean }
      const resolve = approvals.current.get(id)
      if (!resolve) return
      approvals.current.delete(id)
      resolve(ok)
      setTurns((t) => t.map((turn) => (turn.res ? { ...turn, res: { ...turn.res, blocks: turn.res.blocks.map((b) => (b.type === 'approval' && b.id === id ? { ...b, status: ok ? 'approved' : 'declined' } : b)) } } : turn)))
    }
    window.addEventListener('ovi-approve', h)
    return () => window.removeEventListener('ovi-approve', h)
  }, [])

  // Insert/update a live tool-call step in the current AI turn.
  function upsertStep(res: AiResponse, s: OviStep): AiResponse {
    let found = false
    const blocks = res.blocks.map((b) => {
      if (b.type !== 'opsteps') return b
      found = true
      const steps = [...b.steps]
      const idx = steps.findIndex((x) => x.id === s.id)
      const entry = { id: s.id, label: s.summary, status: s.status }
      if (idx === -1) steps.push(entry); else steps[idx] = entry
      return { ...b, steps }
    })
    if (!found) blocks.unshift({ type: 'opsteps', steps: [{ id: s.id, label: s.summary, status: s.status }] })
    return { ...res, blocks }
  }

  // Mutate the most recent AI turn's response.
  function updateLastAi(mut: (res: AiResponse) => AiResponse) {
    setTurns((t) => {
      const copy = [...t]
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === 'ai' && copy[i].res) { copy[i] = { ...copy[i], res: mut(copy[i].res!) }; break }
      }
      return copy
    })
  }
  function setStep(res: AiResponse, i: number, status: 'running' | 'done', detail?: string): AiResponse {
    return { ...res, blocks: res.blocks.map((b) => (b.type === 'workflow' ? { ...b, steps: b.steps.map((s, si) => (si === i ? { ...s, status, detail: detail ?? s.detail } : s)) } : b)) }
  }

  function execOp(op: RunOp | undefined, plan: RunPlan, prospects: ReturnType<typeof generateProspects>): string | undefined {
    switch (op) {
      case 'search': return `${plan.count} ${plan.vertical === 'b2b' ? 'B2B' : plan.vertical} decision-makers across ${Math.max(1, Math.round(plan.count * 0.72))} companies`
      case 'enrich': return `${plan.count} verified emails · ${Math.round(plan.count * 0.55)} direct dials`
      case 'addLeads': act.bulkAddLeads(prospects.map((p) => ({ name: p.name, company: p.company, role: p.role, score: p.score }))); return `${plan.count} added to Leads`
      case 'sequence': return 'Email + LinkedIn · 5 steps over 9 days'
      case 'campaign': act.createReachCampaign(plan.campaignName, plan.vertical, prospects); return 'Live · first send 09:00 tomorrow'
      case 'schedule': act.addScheduledTask(plan.campaignName, 'Weekly · Mon 08:00'); return 'Runs every Monday 08:00'
      default: return undefined
    }
  }

  function streamRun(plan: RunPlan) {
    const prospects = generateProspects(plan.count, plan.vertical)
    updateLastAi((r) => ({ ...r, blocks: [...r.blocks, { type: 'workflow', title: 'Working…', steps: plan.steps.map((s) => ({ ...s })) }] }))
    let i = 0
    const step = () => {
      updateLastAi((r) => setStep(r, i, 'running'))
      setTimeout(() => {
        const detail = execOp(plan.steps[i].op, plan, prospects)
        updateLastAi((r) => setStep(r, i, 'done', detail))
        i += 1
        if (i < plan.steps.length) step()
        else finish()
      }, 850 + Math.random() * 400)
    }
    step()

    function finish() {
      const hasCampaign = plan.steps.some((s) => s.op === 'campaign')
      const hasSchedule = plan.steps.some((s) => s.op === 'schedule')
      const closing: AiBlock[] = hasCampaign
        ? [{ type: 'text', text: `✅ **Campaign live.** ${plan.count} prospects enrolled in *${plan.campaignName}* — first emails send at 09:00, LinkedIn steps queued. I’ll keep working the sequence and surface every reply.` }, { type: 'actions', items: [{ label: 'Show me the campaign' }, { label: 'Schedule this weekly' }] }]
        : hasSchedule
          ? [{ type: 'text', text: `✅ **Scheduled.** I’ll run this automatically and report the result each time.` }, { type: 'actions', items: [{ label: 'View scheduled tasks' }] }]
          : [{ type: 'text', text: `✅ Added **${plan.count}** prospects to Leads, verified and scored. Want me to reach out?` }, { type: 'actions', items: [{ label: 'Now email them' }, { label: 'Schedule this weekly' }] }]
      updateLastAi((r) => ({ ...r, blocks: [...r.blocks, ...closing] }))
      busyRef.current = false
    }
  }

  // The built-in deterministic engine (used when no real model is wired up).
  function finishDeterministic(text: string) {
    const res = answer(text)
    setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { role: 'ai', res, pending: true } : x)))
    setTimeout(() => {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, pending: false } : x)))
      if (res.run) streamRun(res.run)
      else busyRef.current = false
    }, res.run ? 600 : 700)
  }

  async function ask(text: string) {
    if (!text.trim() || busyRef.current) return
    busyRef.current = true
    setTurns((t) => [...t, { role: 'user', text }, { role: 'ai', res: { blocks: [] }, pending: true }])

    // First time: is a real Claude model wired up behind /api/ovi?
    if (liveRef.current === null) { try { liveRef.current = await oviIsLive() } catch { liveRef.current = false } }
    if (!liveRef.current) { finishDeterministic(text); return }

    // Real operator: stream Claude's tool calls against the live store.
    setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { role: 'ai', res: { blocks: [] }, pending: false } : x)))
    try {
      const result = await runOviAgent(text, historyRef.current, {
        onText: (txt) => updateLastAi((r) => ({ ...r, blocks: [...r.blocks, { type: 'text', text: txt }] })),
        onStep: (s) => updateLastAi((r) => upsertStep(r, s)),
        ctx: { act, nav, confirm: confirmInline },
      })
      if (result.fallback) { liveRef.current = false; finishDeterministic(text); return }
      historyRef.current = result.messages
    } catch {
      updateLastAi((r) => ({ ...r, blocks: [...r.blocks, { type: 'text', text: '⚠️ Something went wrong reaching Ovi.' }] }))
    } finally {
      busyRef.current = false
    }
  }

  useEffect(() => {
    if (opts?.listen === false) return
    const h = (e: Event) => ask((e as CustomEvent).detail)
    window.addEventListener('simplr-ai-ask', h)
    return () => window.removeEventListener('simplr-ai-ask', h)
  }, [])

  function reset() {
    setTurns([])
    historyRef.current = []
    if (opts?.persist) { try { localStorage.removeItem(OVI_CHAT_KEY) } catch { /* ignore */ } }
  }
  return { turns, ask, reset }
}

/** Input bar with send + file attach (Claude-like). */
export function AiComposer({ onSend, compact, placeholder }: { onSend: (t: string) => void; compact?: boolean; placeholder?: string }) {
  const [v, setV] = useState('')
  const [file, setFile] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  function submit() {
    const prefix = file ? `Using the attached file “${file}”: ` : ''
    onSend(prefix + v)
    setV('')
    setFile(null)
  }
  return (
    <div className={classNames('bg-surface border border-border rounded-2xl flex flex-col gap-1 p-2 shadow-card')}>
      {file && (
        <div className="flex items-center gap-2 mx-1 px-2.5 py-1.5 rounded-lg bg-accent-wash border border-border-blue text-[12px] text-accent-700 self-start">
          <Envelope size={13} /> {file}
          <button onClick={() => setFile(null)} className="text-accent/60 hover:text-accent ml-1 text-[14px] leading-none">×</button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f.name); e.currentTarget.value = '' }} />
        <button onClick={() => fileRef.current?.click()} title="Attach a file (CSV, ICP, list)" className="w-9 h-9 rounded-xl border border-border text-muted-b hover:text-ink-3 hover:bg-control flex items-center justify-center shrink-0 text-[18px] leading-none">+</button>
        <textarea
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          rows={1}
          placeholder={placeholder ?? 'Ask TellOvi AI to analyse, draft, or do something…'}
          className="flex-1 resize-none outline-none bg-transparent text-[14px] text-ink-2 placeholder:text-muted-3 px-2 py-1.5 max-h-32"
        />
        <button
          onClick={submit}
          disabled={!v.trim() && !file}
          className="w-9 h-9 rounded-xl bg-accent-gradient text-white flex items-center justify-center shadow-primary disabled:opacity-40 disabled:shadow-none transition-opacity shrink-0"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}

export function AiHeader({ right }: { right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-xl bg-accent-gradient text-white flex items-center justify-center shadow-primary">
        <Sparkle size={17} />
      </div>
      <div className="flex-1">
        <div className="text-[14px] font-bold text-ink flex items-center gap-2">TellOvi AI <Chip tone="positive" dot>Autonomous</Chip></div>
      </div>
      {right}
    </div>
  )
}

export { Envelope, Play }
