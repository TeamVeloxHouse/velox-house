/* Shared bits for the whole-home steps (Home & usage · Battery · EV charger · system savings). */
import { useMemo, type ReactNode } from 'react'
import type { Design, DesignPlane, Provenance } from '../store/types'
import { useMcs } from './McsProduction'
import { systemInputs, type DaySeries, type PvArray } from '../lib/homeSystem'

export const gbp = (v: number) => `${v < 0 ? '−' : ''}£${Math.abs(Math.round(v)).toLocaleString()}`
export const pct = (v: number) => `${Math.round(v * 100)}%`

/** The design as a system: simulation inputs built from the roof's real per-face yields. */
export function useSystem(design: Design, moduleId: string, effTilt: (p: DesignPlane) => number) {
  const { res } = useMcs(design, moduleId, effTilt)
  const arrays: PvArray[] = useMemo(() => (res?.arrays ?? []).map((a) => ({ kwh: a.kwh, tiltDeg: a.tiltDeg, azFromSouthDeg: a.azimuthFromSouthDeg })), [res])
  const inputs = useMemo(() => systemInputs(design, arrays), [design, arrays])
  return { inputs, mcs: res, pvReady: !!res || !design.planes.some((p) => p.panels?.length) }
}

/** "Estimate" / "Confirmed on survey" — every input that the survey should check carries one. */
export function ProvChip({ value, onChange }: { value: Provenance; onChange?: (v: Provenance) => void }) {
  const on = value === 'survey'
  return (
    <button type="button" onClick={() => onChange?.(on ? 'estimate' : 'survey')} title={on ? 'Confirmed on survey — click to mark as an estimate' : 'Estimated — confirm on survey'}
      className={`h-6 px-2 rounded-full text-[11px] font-bold whitespace-nowrap inline-flex items-center gap-1 ${on ? 'bg-[#15223B] text-[#62E4CC]' : 'bg-[#FEF3C7] text-[#92400E]'}`}>
      {on ? '✓ Surveyed' : 'Estimate'}
    </button>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-[11.5px] font-semibold text-muted-b">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-2 leading-snug">{hint}</span>}
    </label>
  )
}
export const inputCls = 'h-9 w-full px-2.5 rounded-control border border-input-border bg-white text-[13px] text-ink outline-none focus:border-accent tabular-nums'
export function NumIn({ value, onChange, min = 0, max, step = 1, suffix }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <div className="relative">
      <input type="number" value={Number.isFinite(value) ? value : ''} min={min} max={max} step={step} onChange={(e) => { const v = +e.target.value; if (!isNaN(v)) onChange(Math.max(min, max != null ? Math.min(max, v) : v)) }} className={inputCls + (suffix ? ' pr-12' : '')} />
      {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11.5px] text-muted-2 pointer-events-none">{suffix}</span>}
    </div>
  )
}
/** Segmented control in the house style (grey track, white active pill). */
export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex p-[3px] gap-0.5 rounded-control bg-[#E9EDF2] border border-[#DDE3EA] max-w-full overflow-x-auto">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)} className={`h-[30px] px-3 rounded-[7px] text-[12.5px] whitespace-nowrap ${o.id === value ? 'bg-white text-ink font-bold shadow-[0_1px_3px_rgba(11,18,32,0.14)]' : 'text-ink-3 font-medium hover:text-ink'}`}>{o.label}</button>
      ))}
    </div>
  )
}

/** A typical day: solar (teal area), home + car demand (navy line), grid import (grey bars), cheap-rate hours shaded;
 *  and underneath, the battery's charge through the day. */
export function DayChart({ day, capKwh, title }: { day: DaySeries; capKwh: number; title: string }) {
  const W = 520, H = 150, P = { l: 34, r: 8, t: 10, b: 20 }
  const n = 48, x = (i: number) => P.l + ((W - P.l - P.r) * (i + 0.5)) / n
  const demand = day.load.map((v, i) => v + day.ev[i])
  const max = Math.max(0.2, ...day.gen, ...demand, ...day.grid) * 1.1
  const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / max)
  const minP = Math.min(...day.price), avgP = day.price.reduce((a, b) => a + b, 0) / n
  const cheap = day.price.map((p) => minP < avgP * 0.8 && p <= minP + 0.02)
  const bw = (W - P.l - P.r) / n
  const area = `M${x(0)},${y(0)} ` + day.gen.map((v, i) => `L${x(i)},${y(v)}`).join(' ') + ` L${x(n - 1)},${y(0)} Z`
  const line = demand.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')
  const ticks = [0, max / 2, max].map((v) => Math.round(v * 10) / 10)
  const SH = 54
  const sy = (v: number) => 6 + (SH - 16) * (1 - v)
  const socLine = capKwh > 0 ? day.soc.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${sy(v / capKwh)}`).join(' ') : ''
  return (
    <div>
      <div className="text-[12px] font-bold text-ink mb-1">{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${title}: solar, demand and grid import by half hour`}>
        {cheap.map((c, i) => c && <rect key={i} x={x(i) - bw / 2} y={P.t} width={bw} height={H - P.t - P.b} fill="#15223B" opacity={0.05} />)}
        {ticks.map((t) => <g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="#EEF1F5" /><text x={P.l - 5} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#8A94A6">{t}</text></g>)}
        {day.grid.map((v, i) => v > 0.001 && <rect key={i} x={x(i) - bw * 0.35} y={y(v)} width={bw * 0.7} height={y(0) - y(v)} fill="#C9D2DC" />)}
        <path d={area} fill="#62E4CC" fillOpacity={0.45} stroke="#0E7A66" strokeWidth={1.2} />
        <path d={line} fill="none" stroke="#15223B" strokeWidth={1.8} />
        {[0, 6, 12, 18].map((h) => <text key={h} x={x(h * 2)} y={H - 6} fontSize="9" fill="#8A94A6" textAnchor="middle">{String(h).padStart(2, '0')}:00</text>)}
        <text x={4} y={P.t + 4} fontSize="9" fill="#8A94A6">kWh</text>
      </svg>
      {capKwh > 0 && (
        <svg viewBox={`0 0 ${W} ${SH}`} className="w-full h-auto" role="img" aria-label="Battery charge through the day">
          <line x1={P.l} x2={W - P.r} y1={sy(0)} y2={sy(0)} stroke="#EEF1F5" /><line x1={P.l} x2={W - P.r} y1={sy(1)} y2={sy(1)} stroke="#EEF1F5" />
          <text x={P.l - 5} y={sy(1) + 3} textAnchor="end" fontSize="9" fill="#8A94A6">100%</text><text x={P.l - 5} y={sy(0) + 3} textAnchor="end" fontSize="9" fill="#8A94A6">0</text>
          <path d={socLine} fill="none" stroke="#15223B" strokeWidth={1.6} strokeDasharray="4 3" />
          <text x={W - P.r} y={SH - 2} textAnchor="end" fontSize="9" fill="#8A94A6">battery charge</text>
        </svg>
      )}
    </div>
  )
}
export function DayLegend({ battery }: { battery: boolean }) {
  const item = (sw: ReactNode, l: string) => <span className="inline-flex items-center gap-1.5">{sw}{l}</span>
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-b">
      {item(<span className="w-3 h-3 rounded-sm" style={{ background: '#62E4CC', opacity: 0.8 }} />, 'Solar')}
      {item(<span className="w-4 h-0.5 bg-[#15223B]" />, 'Home + car demand')}
      {item(<span className="w-3 h-3 rounded-sm bg-[#C9D2DC]" />, 'From the grid')}
      {item(<span className="w-3 h-3 rounded-sm bg-[#15223B] opacity-10" />, 'Cheap-rate hours')}
      {battery && item(<span className="w-4 border-t-2 border-dashed border-[#15223B]" />, 'Battery charge')}
    </div>
  )
}
