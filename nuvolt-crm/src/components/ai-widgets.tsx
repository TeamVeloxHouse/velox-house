import { useState } from 'react'
import { Sparkle, Check } from './icons'
import { classNames } from '../lib/format'
import { bandColor, type Score, type Risk, type Action } from '../lib/intelligence'
import { useActions } from '../store/store'
import type { Activity } from '../store/types'

/** Compact AI score pill with a hover breakdown of the signals. */
export function ScorePill({ score, size = 'md' }: { score: Score; size?: 'sm' | 'md' }) {
  const c = bandColor[score.band]
  return (
    <span className="relative group inline-flex">
      <span
        className={classNames('inline-flex items-center gap-1 rounded-full font-bold cursor-default', size === 'sm' ? 'text-[11px] px-1.5 py-0.5' : 'text-[12px] px-2 py-0.5')}
        style={{ background: c.bg, color: c.fg }}
      >
        <Sparkle size={size === 'sm' ? 10 : 12} /> {score.score}
      </span>
      <span className="pointer-events-none absolute z-50 top-full right-0 mt-1.5 w-60 bg-ink text-white rounded-lg p-2.5 shadow-modal opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150">
        <span className="block text-[11px] font-semibold mb-1.5" style={{ color: c.bg }}>Why {score.score}? · {score.band}</span>
        <span className="flex flex-col gap-1">
          {score.reasons.slice(0, 5).map((r, i) => (
            <span key={i} className="flex items-center justify-between text-[11.5px] text-white/85">
              <span className="truncate pr-2">{r.label}</span>
              <span className="font-semibold tabular-nums" style={{ color: r.delta >= 0 ? '#8FE0C6' : '#F0995F' }}>{r.delta >= 0 ? '+' : ''}{r.delta}</span>
            </span>
          ))}
        </span>
      </span>
    </span>
  )
}

const riskStyle: Record<Risk['level'], { fg: string; bg: string; label: string }> = {
  ok: { fg: '#0E7C66', bg: '#E9F5F1', label: 'On track' },
  watch: { fg: '#C2410C', bg: '#FDF1E7', label: 'Watch' },
  risk: { fg: '#B01B4F', bg: '#FDECEF', label: 'At risk' },
}
export function RiskBadge({ risk, showLabel = true }: { risk: Risk; showLabel?: boolean }) {
  if (risk.level === 'ok' && !showLabel) return null
  const s = riskStyle[risk.level]
  return (
    <span className="relative group inline-flex">
      <span className="inline-flex items-center gap-1 rounded-chip text-[11px] font-semibold px-1.5 py-0.5" style={{ background: s.bg, color: s.fg }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.fg }} />{showLabel ? s.label : ''}
      </span>
      {risk.signals.length > 0 && (
        <span className="pointer-events-none absolute z-50 top-full left-0 mt-1.5 w-56 bg-ink text-white rounded-lg p-2.5 shadow-modal opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150">
          <span className="block text-[11px] font-semibold mb-1" style={{ color: s.bg }}>Risk signals</span>
          {risk.signals.map((sig, i) => (<span key={i} className="block text-[11.5px] text-white/85">• {sig}</span>))}
        </span>
      )}
    </span>
  )
}

/** Next-best-action card with a one-click execute. */
export function NextBestAction({ action, dealId, personId }: { action: Action; dealId?: string; personId?: string }) {
  const act = useActions()
  const [done, setDone] = useState(false)
  function run() {
    const a: Partial<Activity> & { type: Activity['type']; subject: string } = {
      type: action.kind === 'email' ? 'email' : action.kind,
      subject: action.subject,
      dealId,
      personId,
      due: 'Today',
      priority: 'High',
      source: 'ai',
      done: false,
    }
    act.logActivity(a, 'AI next step added')
    setDone(true)
  }
  return (
    <div className="rounded-card bg-accent-wash-3 border border-[#D3E0FA] p-4">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-accent-700"><Sparkle size={13} /> AI next best action</div>
      <div className="text-[13.5px] text-ink-2 mt-1.5 font-semibold">{action.title}</div>
      <div className="text-[12.5px] text-ink-3 mt-1 leading-relaxed">{action.rationale}</div>
      <button
        onClick={run}
        disabled={done}
        className={classNames('mt-2.5 h-8 px-3 rounded-lg text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors', done ? 'bg-positive-wash text-positive' : 'bg-accent-gradient text-white shadow-primary')}
      >
        {done ? <><Check size={13} /> Added</> : <><Sparkle size={13} /> Do it</>}
      </button>
    </div>
  )
}

/** AI record summary with an "ask about this" hook into the copilot. */
export function RecordSummary({ summary, ask }: { summary: string; ask?: string }) {
  return (
    <div className="rounded-card bg-surface border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-accent-700"><Sparkle size={13} /> AI summary</div>
        {ask && (
          <button onClick={() => window.dispatchEvent(new CustomEvent('simplr-ai-ask', { detail: ask }))} className="text-[12px] text-accent font-semibold hover:underline">Ask about this →</button>
        )}
      </div>
      <div className="text-[13px] text-ink-2 leading-relaxed">{summary}</div>
    </div>
  )
}
