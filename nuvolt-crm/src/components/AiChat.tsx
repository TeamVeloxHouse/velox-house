import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { answer, type AiBlock, type AiResponse } from '../lib/ai'
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
  if (b.type === 'actions')
    return (
      <div className="flex flex-wrap gap-2">
        {b.items.map((a, i) => (
          <AiActionButton key={i} label={a.label} primary={i === 0} />
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

/** Shared chat state + async "streaming" simulation. */
export function useChat(seed?: ChatTurn[]) {
  const [turns, setTurns] = useState<ChatTurn[]>(seed ?? [])
  const busyRef = useRef(false)

  function ask(text: string) {
    if (!text.trim() || busyRef.current) return
    busyRef.current = true
    const res = answer(text)
    setTurns((t) => [...t, { role: 'user', text }, { role: 'ai', res, pending: true }])
    // simulate model latency, then reveal
    setTimeout(() => {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, pending: false } : x)))
      busyRef.current = false
    }, 750)
  }

  useEffect(() => {
    const h = (e: Event) => ask((e as CustomEvent).detail)
    window.addEventListener('simplr-ai-ask', h)
    return () => window.removeEventListener('simplr-ai-ask', h)
  }, [])

  return { turns, ask, reset: () => setTurns([]) }
}

/** Input bar with send + affordances. */
export function AiComposer({ onSend, compact }: { onSend: (t: string) => void; compact?: boolean }) {
  const [v, setV] = useState('')
  function submit() {
    onSend(v)
    setV('')
  }
  return (
    <div className={classNames('bg-surface border border-border rounded-2xl flex items-end gap-2 p-2', compact ? 'shadow-card' : 'shadow-card')}>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        rows={1}
        placeholder="Ask Simplr AI to analyse, draft, or do something…"
        className="flex-1 resize-none outline-none bg-transparent text-[14px] text-ink-2 placeholder:text-muted-3 px-2 py-1.5 max-h-32"
      />
      <button
        onClick={submit}
        disabled={!v.trim()}
        className="w-9 h-9 rounded-xl bg-accent-gradient text-white flex items-center justify-center shadow-primary disabled:opacity-40 disabled:shadow-none transition-opacity shrink-0"
      >
        <Send size={16} />
      </button>
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
        <div className="text-[14px] font-bold text-ink flex items-center gap-2">Simplr AI <Chip tone="positive" dot>Autonomous</Chip></div>
      </div>
      {right}
    </div>
  )
}

export { Envelope, Play }
