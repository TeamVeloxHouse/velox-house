/* Modern form inputs for the Finder: token multi-select with type-ahead, a clean stepper (no
 * sliders), and a Google-Maps-style address autocomplete. All match the app's Slate design. */

import { useEffect, useMemo, useRef, useState } from 'react'
import { classNames } from '../lib/format'

const base = 'rounded-control border border-input-border bg-white text-[13px] outline-none focus-within:border-accent'

/* ─────────── Token multi-select with type-ahead suggestions ─────────── */
export function MultiSelect({
  values, onChange, suggestions = [], placeholder, allowCustom = true, icon, asyncSuggest,
}: {
  values: string[]
  onChange: (v: string[]) => void
  suggestions?: string[]
  placeholder?: string
  allowCustom?: boolean
  icon?: (p: { size?: number; className?: string }) => JSX.Element
  asyncSuggest?: (q: string) => Promise<string[]>
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [remote, setRemote] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const Icon = icon
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', h); return () => window.removeEventListener('mousedown', h)
  }, [])
  useEffect(() => {
    if (!asyncSuggest || q.length < 3) { setRemote([]); return }
    let dead = false
    const t = setTimeout(async () => { try { const r = await asyncSuggest(q); if (!dead) setRemote(r) } catch { /* offline */ } }, 250)
    return () => { dead = true; clearTimeout(t) }
  }, [q, asyncSuggest])
  const opts = useMemo(() => [...suggestions, ...remote].filter((s, i, a) => a.indexOf(s) === i && !values.includes(s) && s.toLowerCase().includes(q.toLowerCase())).slice(0, 8), [suggestions, remote, values, q])
  const add = (v: string) => { const t = v.trim(); if (t && !values.includes(t)) onChange([...values, t]); setQ('') }
  const remove = (v: string) => onChange(values.filter((x) => x !== v))

  return (
    <div ref={ref} className="relative">
      <div className={classNames(base, 'flex flex-wrap items-center gap-1.5 px-2 py-1.5 min-h-[38px]')} onClick={() => setOpen(true)}>
        {Icon && <Icon size={15} className="text-muted-2 ml-1 shrink-0" />}
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-full text-[12px] font-medium text-white" style={{ background: 'linear-gradient(135deg,#1FAE94,#159C86)' }}>
            {v}<button onClick={(e) => { e.stopPropagation(); remove(v) }} className="w-4 h-4 rounded-full hover:bg-white/25 flex items-center justify-center text-[11px]">✕</button>
          </span>
        ))}
        <input value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && q && allowCustom) { e.preventDefault(); add(q) } else if (e.key === 'Backspace' && !q && values.length) remove(values[values.length - 1]) }}
          placeholder={values.length ? '' : placeholder} className="flex-1 min-w-[80px] h-7 px-1 bg-transparent outline-none text-[13px]" />
      </div>
      {open && (opts.length > 0 || (allowCustom && q)) && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-surface rounded-overlay shadow-modal border border-border overflow-hidden max-h-[220px] overflow-y-auto">
          {allowCustom && q && !suggestions.some((s) => s.toLowerCase() === q.toLowerCase()) && (
            <button onClick={() => add(q)} className="w-full text-left px-3 py-2 text-[13px] hover:bg-control flex items-center gap-2"><span className="text-accent font-semibold">+ Add</span> “{q}”</button>
          )}
          {opts.map((o) => <button key={o} onClick={() => add(o)} className="w-full text-left px-3 py-2 text-[13px] text-ink-2 hover:bg-control">{o}</button>)}
        </div>
      )}
    </div>
  )
}

/* ─────────── Stepper (replaces sliders) ─────────── */
export function Stepper({ value, onChange, min = 0, max = 9999, step = 1, suffix, format }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; format?: (n: number) => string
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n))
  const btn = 'w-8 h-[38px] flex items-center justify-center text-muted-b hover:text-ink hover:bg-control text-[16px] font-semibold shrink-0 select-none'
  return (
    <div className={classNames(base, 'flex items-center overflow-hidden')}>
      <button type="button" onClick={() => onChange(clamp(value - step))} className={btn}>−</button>
      <div className="flex-1 flex items-center justify-center gap-1 border-x border-input-border h-[38px] px-2">
        <input value={format ? format(value) : value} onChange={(e) => { const n = parseFloat(String(e.target.value).replace(/[^\d.]/g, '')); if (!isNaN(n)) onChange(clamp(n)) }}
          className="w-full text-center bg-transparent outline-none text-[14px] font-semibold text-ink" />
        {suffix && <span className="text-[12px] text-muted-2 shrink-0">{suffix}</span>}
      </div>
      <button type="button" onClick={() => onChange(clamp(value + step))} className={btn}>+</button>
    </div>
  )
}

/* ─────────── Address autocomplete (Google-Maps-style) ─────────── */
export type PlacePick = { text: string; placeId?: string }
export function AddressAutocomplete({ value, onPick, onChange, placeholder }: {
  value: string; onPick: (p: PlacePick) => void; onChange?: (text: string) => void; placeholder?: string
}) {
  const [q, setQ] = useState(value)
  const [sug, setSug] = useState<PlacePick[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => setQ(value), [value])
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', h); return () => window.removeEventListener('mousedown', h)
  }, [])
  useEffect(() => {
    if (!q || q.length < 3) { setSug([]); return }
    let dead = false
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await fetch('/api/autocomplete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: q }) })
        const j = await r.json()
        if (!dead) { setSug(j.suggestions || []); setOpen(true) }
      } catch { /* offline */ } finally { if (!dead) setLoading(false) }
    }, 250)
    return () => { dead = true; clearTimeout(t) }
  }, [q])

  return (
    <div ref={ref} className="relative">
      <div className={classNames(base, 'flex items-center h-[38px] px-3')}>
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); onChange?.(e.target.value) }} onFocus={() => q.length >= 3 && setOpen(true)} placeholder={placeholder} className="flex-1 bg-transparent outline-none text-[13px]" />
        {loading && <span className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />}
      </div>
      {open && sug.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-surface rounded-overlay shadow-modal border border-border overflow-hidden max-h-[260px] overflow-y-auto">
          {sug.map((s, i) => (
            <button key={i} onClick={() => { setQ(s.text); onPick(s); setOpen(false) }} className="w-full text-left px-3 py-2.5 text-[13px] text-ink-2 hover:bg-control border-b border-divider last:border-0 flex items-center gap-2">
              <span className="text-muted-2">📍</span><span className="truncate">{s.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
