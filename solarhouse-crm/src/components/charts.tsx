import { useRef, useState, type ReactNode } from 'react'
import { classNames } from '../lib/format'

/* Small chart kit for the CRM's analytics pages (Forecast, Insights, Surveys, DNO).
 * Rules (dataviz skill): one axis; magnitude in ONE hue (teal) — forecast is the same hue, lighter and
 * hatched, never a new colour; thin marks, 4px rounded data-ends on the baseline, 2px gaps; recessive
 * grid; text in ink colours, never the series colour; every mark has a hover tooltip. */

export const C = {
  actual: '#0E7A66',
  forecast: '#62E4CC',
  target: '#15223B',
  grid: '#EEF1F5',
  muted: '#98A1B0',
}

type Tip = { x: number; y: number; body: ReactNode } | null
function TipBox({ tip }: { tip: Tip }) {
  if (!tip) return null
  return (
    <div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg bg-[#15223B] text-white text-[11.5px] px-2.5 py-1.5 shadow-lg whitespace-nowrap" style={{ left: tip.x, top: tip.y - 8 }}>
      {tip.body}
    </div>
  )
}

const niceMax = (v: number) => {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
}

export type MonthBar = { label: string; value: number; forecast?: boolean; sub?: string }

/** Monthly columns: solid = actual, hatched light = forecast, dashed navy = target. */
export function MonthColumns({ data, target, fmt, height = 220 }: { data: MonthBar[]; target?: number; fmt: (n: number) => string; height?: number }) {
  const [tip, setTip] = useState<Tip>(null)
  const root = useRef<HTMLDivElement>(null)
  const max = niceMax(Math.max(target ?? 0, ...data.map((d) => d.value)) * 1.05)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const W = 100 / data.length
  return (
    <div ref={root} className="relative" onMouseLeave={() => setTip(null)}>
      <div className="flex" style={{ height }}>
        {/* y axis */}
        <div className="w-12 shrink-0 relative text-[10.5px] text-muted-3 tabular-nums">
          {ticks.map((t) => <span key={t} className="absolute right-2 -translate-y-1/2" style={{ top: `${100 - (t / max) * 100}%` }}>{fmt(t)}</span>)}
        </div>
        <div className="relative flex-1">
          {ticks.map((t) => <div key={t} className="absolute inset-x-0 border-t" style={{ top: `${100 - (t / max) * 100}%`, borderColor: t === 0 ? '#D5DBE3' : C.grid }} />)}
          {target != null && (
            <div className="absolute inset-x-0 border-t-2 border-dashed z-10" style={{ top: `${100 - (target / max) * 100}%`, borderColor: C.target }}>
              <span className="absolute right-0 -top-5 text-[10.5px] font-bold text-[#15223B] bg-white/90 px-1 rounded">Target {fmt(target)}</span>
            </div>
          )}
          <div className="absolute inset-0 flex items-end">
            {data.map((d, i) => (
              <div key={i} className="h-full flex items-end justify-center" style={{ width: `${W}%` }}
                onMouseMove={(e) => { const r = root.current!.getBoundingClientRect(); const b = e.currentTarget.getBoundingClientRect(); setTip({ x: b.left - r.left + b.width / 2, y: b.bottom - r.top - (d.value / max) * height, body: <><b>{d.label}</b> · {fmt(d.value)}{d.forecast ? ' (forecast)' : ''}{d.sub ? <div className="text-white/70">{d.sub}</div> : null}</> }) }}>
                <div className="w-[62%] max-w-[46px] rounded-t-[4px]" style={{
                  height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0,
                  background: d.forecast ? `repeating-linear-gradient(45deg, ${C.forecast} 0 5px, #A8EDDF 5px 8px)` : C.actual,
                  outline: d.forecast ? `1.5px dashed ${C.actual}` : undefined, outlineOffset: -1.5,
                }} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex pl-12 mt-1.5">
        {data.map((d, i) => <div key={i} className={classNames('text-center text-[11px] truncate', d.forecast ? 'text-muted-2 italic' : 'text-ink-3 font-semibold')} style={{ width: `${W}%` }}>{d.label}</div>)}
      </div>
      <TipBox tip={tip} />
    </div>
  )
}

/** Horizontal bars with the value printed at the end — for ranked or ordered categories. */
export function HBars({ data, fmt, color = C.actual, max: maxIn }: { data: { label: ReactNode; value: number; sub?: string; color?: string; tip?: string }[]; fmt: (n: number) => string; color?: string; max?: number }) {
  const max = maxIn ?? Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex flex-col gap-2">
      {data.map((d, i) => (
        <div key={i} className="grid grid-cols-[minmax(110px,160px)_1fr_auto] items-center gap-3" title={d.tip}>
          <div className="text-[12.5px] text-ink-2 truncate">{d.label}{d.sub && <span className="text-muted-3"> · {d.sub}</span>}</div>
          <div className="h-[18px] rounded-[4px] bg-[#F3F5F8] overflow-hidden">
            <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(d.value > 0 ? 1.5 : 0, (d.value / max) * 100)}%`, background: d.color ?? color }} />
          </div>
          <div className="text-[12.5px] font-bold text-ink tabular-nums text-right min-w-[64px]">{fmt(d.value)}</div>
        </div>
      ))}
    </div>
  )
}

/** Funnel: each stage's bar, its absolute value and the step conversion from the stage before. */
export function Funnel({ steps, fmt }: { steps: { label: string; value: number; sub?: string }[]; fmt: (n: number) => string }) {
  const max = Math.max(1, ...steps.map((s) => s.value))
  const ramp = ['#A8EDDF', '#62E4CC', '#2FBFA5', '#169C85', '#0E7A66', '#0A5A4C', '#15223B']
  return (
    <div className="flex flex-col gap-1.5">
      {steps.map((s, i) => {
        const conv = i > 0 && steps[i - 1].value ? Math.round((s.value / steps[i - 1].value) * 100) : null
        return (
          <div key={s.label} className="grid grid-cols-[130px_1fr_70px_56px] items-center gap-3">
            <div className="text-[12.5px] font-semibold text-ink-2 truncate">{s.label}</div>
            <div className="h-6 rounded-[4px] bg-[#F3F5F8]"><div className="h-full rounded-[4px]" style={{ width: `${Math.max(1.5, (s.value / max) * 100)}%`, background: ramp[Math.min(i, ramp.length - 1)] }} /></div>
            <div className="text-[12.5px] font-bold text-ink tabular-nums text-right">{fmt(s.value)}</div>
            <div className="text-[11.5px] text-muted-b tabular-nums text-right">{conv != null ? `${conv}%` : ''}</div>
          </div>
        )
      })}
    </div>
  )
}

/** Legend chip row — identity never by colour alone. */
export function Legend({ items }: { items: { label: string; swatch: string; dashed?: boolean; hatched?: boolean }[] }) {
  return (
    <div className="flex items-center gap-4 text-[11.5px] text-muted-b flex-wrap">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          {it.dashed ? <span className="w-5 border-t-2 border-dashed" style={{ borderColor: it.swatch }} />
            : <span className="w-3 h-3 rounded-[3px]" style={{ background: it.hatched ? `repeating-linear-gradient(45deg, ${C.forecast} 0 3px, #A8EDDF 3px 5px)` : it.swatch, outline: it.hatched ? `1px dashed ${C.actual}` : undefined }} />}
          {it.label}
        </span>
      ))}
    </div>
  )
}

/** A tidy data table used under charts ("the table view"). */
export function DataTable({ cols, rows, foot }: { cols: { label: string; align?: 'left' | 'right'; w?: string }[]; rows: ReactNode[][]; foot?: ReactNode[] }) {
  const template = cols.map((c) => c.w ?? 'minmax(0,1fr)').join(' ')
  return (
    <div className="rounded-[12px] border border-[#E6EAF0] overflow-hidden">
      <div className="grid gap-3 px-4 h-9 items-center bg-[#FAFBFC] border-b border-[#E6EAF0] text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-3" style={{ gridTemplateColumns: template }}>
        {cols.map((c) => <span key={c.label} className={c.align === 'right' ? 'text-right' : ''}>{c.label}</span>)}
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid gap-3 px-4 py-2.5 items-center border-b border-[#F0F2F5] last:border-b-0 text-[12.5px] text-ink-2 hover:bg-[#FAFCFB]" style={{ gridTemplateColumns: template }}>
          {r.map((cell, j) => <span key={j} className={classNames('min-w-0 truncate', cols[j].align === 'right' && 'text-right tabular-nums')}>{cell}</span>)}
        </div>
      ))}
      {foot && (
        <div className="grid gap-3 px-4 py-2.5 items-center bg-[#F7F9FB] border-t border-[#E6EAF0] text-[12.5px] font-bold text-ink" style={{ gridTemplateColumns: template }}>
          {foot.map((cell, j) => <span key={j} className={classNames('min-w-0 truncate', cols[j].align === 'right' && 'text-right tabular-nums')}>{cell}</span>)}
        </div>
      )}
    </div>
  )
}

/** Change vs a previous value, as a small neutral/positive/negative tag with an arrow (not colour alone). */
export function Delta({ now, prev, invert }: { now: number; prev: number; invert?: boolean }) {
  if (!prev) return <span className="text-[11px] text-muted-3">—</span>
  const pct = Math.round(((now - prev) / prev) * 100)
  const good = invert ? pct < 0 : pct > 0
  return <span className={classNames('text-[11px] font-bold rounded px-1 py-px whitespace-nowrap', pct === 0 ? 'bg-[#F1F3F7] text-muted-b' : good ? 'bg-[#E1F6F1] text-[#0A5A4C]' : 'bg-[#FDECEF] text-[#B01B4F]')}>{pct > 0 ? '▲' : pct < 0 ? '▼' : '■'} {Math.abs(pct)}%</span>
}
