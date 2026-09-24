import { useEffect, useRef, useState, type ReactNode } from 'react'
import { classNames } from '../lib/format'

/* One month grid for every calendar in the CRM. It always fits the space it's given — the whole
 * month on screen, no scrolling — and shows as many events per day as fit, then "+N more". */

export type GridEvent = { id: string; label: ReactNode; color: string; wash: string; done?: boolean; onClick?: () => void; title?: string }

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Weeks (Mon-first) covering the month — 4 to 6 rows, never a spare trailing week. */
export function monthWeeks(year: number, month0: number): string[][] {
  const lead = (new Date(year, month0, 1).getDay() + 6) % 7
  const days = new Date(year, month0 + 1, 0).getDate()
  const rows = Math.ceil((lead + days) / 7)
  return Array.from({ length: rows }, (_, w) => Array.from({ length: 7 }, (_, d) => iso(new Date(year, month0, 1 - lead + w * 7 + d))))
}

export function MonthGrid({ year, month0, events, onDay, onMore, dayBadge }: {
  year: number
  month0: number
  events: Record<string, GridEvent[]>
  onDay?: (iso: string) => void
  onMore?: (iso: string) => void
  /** optional small summary in the day's corner, e.g. "3 booked" */
  dayBadge?: (iso: string) => ReactNode
}) {
  const weeks = monthWeeks(year, month0)
  const today = iso(new Date())
  const box = useRef<HTMLDivElement>(null)
  const [rowH, setRowH] = useState(110)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setRowH(el.clientHeight / weeks.length))
    ro.observe(el)
    return () => ro.disconnect()
  }, [weeks.length])
  // day header ≈ 26px, each event chip ≈ 21px, keep room for the "+N more" line
  const fit = Math.max(1, Math.floor((rowH - 30) / 21))

  return (
    <div className="flex-1 min-h-0 flex flex-col rounded-card border border-[#E1E6EC] bg-white shadow-card overflow-hidden">
      <div className="grid grid-cols-7 shrink-0 bg-[#15223B]">
        {DOW.map((d, i) => <div key={d} className={classNames('text-[11px] font-bold uppercase tracking-[0.08em] text-center py-2.5', i >= 5 ? 'text-white/55' : 'text-[#62E4CC]')}>{d}</div>)}
      </div>
      <div ref={box} className="flex-1 min-h-0 grid grid-cols-7" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
        {weeks.flat().map((d, i) => {
          const inMonth = Number(d.slice(5, 7)) === month0 + 1
          const list = events[d] ?? []
          const shown = list.length > fit ? list.slice(0, fit - 1) : list
          const more = list.length - shown.length
          return (
            <div
              key={d}
              onClick={() => onDay?.(d)}
              className={classNames('min-h-0 overflow-hidden p-1.5 flex flex-col gap-[3px] border-[#EDF0F4] transition-colors', i % 7 !== 6 && 'border-r', i < (weeks.length - 1) * 7 && 'border-b',
                inMonth ? 'bg-white' : 'bg-[#FAFBFC]', onDay && 'cursor-pointer hover:bg-[#F6FBFA]')}
            >
              <div className="flex items-center justify-between shrink-0">
                <span className={classNames('text-[12px] font-bold w-6 h-6 flex items-center justify-center rounded-full',
                  d === today ? 'bg-[#15223B] text-[#62E4CC]' : inMonth ? 'text-ink-2' : 'text-muted-3')}>{Number(d.slice(8))}</span>
                {dayBadge?.(d)}
              </div>
              {shown.map((e) => (
                <button key={e.id} title={e.title} onClick={(ev) => { ev.stopPropagation(); e.onClick?.() }}
                  className="shrink-0 h-[18px] flex items-center gap-1.5 rounded-[5px] px-1.5 text-left hover:brightness-95" style={{ background: e.wash }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.color }} />
                  <span className={classNames('text-[11px] truncate leading-none', e.done ? 'text-muted-3 line-through' : 'text-ink-2')}>{e.label}</span>
                </button>
              ))}
              {more > 0 && <button onClick={(ev) => { ev.stopPropagation(); onMore?.(d) }} className="shrink-0 text-[10.5px] font-bold text-[#15223B]/70 hover:text-[#15223B] text-left pl-1.5">+{more} more</button>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
