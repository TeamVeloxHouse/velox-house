import { selfConsumptionRate } from '../lib/solar'
import type { Design } from '../store/types'
import { Dropdown } from './Dropdown'

/* Energy analysis for the design sidebar — consumption offset, self-consumption, a monthly
 * generation-vs-usage chart, a typical-day curve, and estimated bill savings. Deterministic model
 * (UK seasonal + typical-day shapes), so it's instant and needs no backend. */

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
// UK PV monthly share of annual (normalised) — low winter, high summer.
const GEN_W = norm([30, 50, 88, 120, 140, 142, 138, 120, 92, 58, 32, 24])
// Household demand monthly share (mild winter bias for lighting/heating).
const CONS_W = norm([10.2, 9.2, 9.0, 8.0, 7.3, 6.8, 6.7, 6.9, 7.6, 8.6, 9.4, 10.3])
// Typical-day shapes (24 h), normalised — generation bell vs a morning+evening load.
const GEN_DAY = norm(Array.from({ length: 24 }, (_, h) => Math.max(0, Math.sin(((h - 5.5) / 13) * Math.PI)) ** 1.2))
const LOAD_DAY = norm(Array.from({ length: 24 }, (_, h) => 0.4 + 0.9 * Math.exp(-((h - 7.8) ** 2) / 2.2) + 1.5 * Math.exp(-((h - 19.5) ** 2) / 4.5)))

function norm(a: number[]) { const s = a.reduce((x, y) => x + y, 0) || 1; return a.map((v) => v / s) }
const IMPORT_P = 0.27, EXPORT_P = 0.15 // £/kWh — grid import vs SEG export

const OCC: { id: NonNullable<Design['occupancy']>; label: string }[] = [
  { id: 'home_all_day', label: 'Home all day' },
  { id: 'in_half_day', label: 'In half the day' },
  { id: 'out_all_day', label: 'Out all day' },
]

export function EnergyPanel({ design, annualKwh, onUpdate }: { design: Design; annualKwh: number; onUpdate: (patch: Partial<Design>) => void }) {
  const gen = Math.round(annualKwh)
  const demand = design.annualConsumptionKwh ?? 3800
  const occupancy = design.occupancy ?? 'in_half_day'
  const battery = design.batteryKwh ?? 0
  const scRate = gen > 0 ? selfConsumptionRate({ generation: gen, demand, occupancy, batteryUsableKwh: battery }) : 0
  const selfUsed = Math.round(gen * scRate)
  const exported = Math.max(0, gen - selfUsed)
  const gridImport = Math.max(0, demand - selfUsed)
  const offsetPct = demand > 0 ? Math.min(100, Math.round((selfUsed / demand) * 100)) : 0
  const genOffsetPct = demand > 0 ? Math.round((gen / demand) * 100) : 0
  const saveSelf = selfUsed * IMPORT_P, saveExport = exported * EXPORT_P
  const annualSaving = Math.round(saveSelf + saveExport)

  const genMonthly = GEN_W.map((w) => gen * w)
  const consMonthly = CONS_W.map((w) => demand * w)

  return (
    <div className="p-4 border-t border-divider flex flex-col gap-3.5">
      <div className="flex items-center gap-1.5"><BoltMini /><div className="text-[12px] font-bold text-ink">Energy &amp; savings</div>
        {gen === 0 && <span className="ml-auto text-[10.5px] text-muted-2">place panels to model</span>}
      </div>

      {/* Consumption offset headline */}
      <div>
        <div className="flex items-end justify-between mb-1">
          <div className="text-[11.5px] text-muted-b">Solar covers your usage</div>
          <div className="text-[20px] font-bold text-ink leading-none tabular-nums">{offsetPct}<span className="text-[12px] text-muted-b font-semibold">%</span></div>
        </div>
        <div className="h-2.5 rounded-full bg-control overflow-hidden"><div className="h-full rounded-full" style={{ width: `${offsetPct}%`, background: 'linear-gradient(90deg,#1FAE94,#159C86)' }} /></div>
        <div className="text-[10.5px] text-muted-2 mt-1">Generates {genOffsetPct}% of your annual demand · {scRate ? Math.round(scRate * 100) : 0}% used on-site</div>
      </div>

      {/* Inputs */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-[11.5px] text-muted-b">
          <span className="w-[86px] shrink-0">Annual usage</span>
          <input type="number" value={demand} min={0} step={100} onChange={(e) => onUpdate({ annualConsumptionKwh: Math.max(0, Math.round(+e.target.value || 0)) })} className="flex-1 h-8 px-2 rounded-control border border-input-border bg-white text-[12.5px] tabular-nums outline-none focus:border-accent" />
          <span className="text-muted-2">kWh</span>
        </label>
        <label className="flex items-center gap-2 text-[11.5px] text-muted-b">
          <span className="w-[86px] shrink-0">Occupancy</span>
          <Dropdown value={occupancy} onChange={(e) => onUpdate({ occupancy: e.target.value as Design['occupancy'] })} className="flex-1 h-8 px-2 rounded-control border border-input-border bg-white text-[12.5px] outline-none focus:border-accent">
            {OCC.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </Dropdown>
        </label>
        <label className="flex items-center gap-2 text-[11.5px] text-muted-b">
          <span className="w-[86px] shrink-0">Battery</span>
          <input type="number" value={battery} min={0} step={1} onChange={(e) => onUpdate({ batteryKwh: Math.max(0, +e.target.value || 0) })} className="flex-1 h-8 px-2 rounded-control border border-input-border bg-white text-[12.5px] tabular-nums outline-none focus:border-accent" />
          <span className="text-muted-2">kWh</span>
        </label>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-1.5">
        <EStat v={gen} u="kWh generated" c="#159C86" />
        <EStat v={selfUsed} u="used on-site" c="#17B890" />
        <EStat v={exported} u="exported" c="#1FAE94" />
        <EStat v={gridImport} u="from grid" c="#94A3B8" />
      </div>

      {/* Monthly generation vs usage */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="eyebrow text-muted-3">Monthly</div>
          <div className="flex items-center gap-2.5 text-[9.5px] text-muted-b">
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: '#159C86' }} />solar</span>
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: '#CBD5E1' }} />usage</span>
          </div>
        </div>
        <MonthlyBars gen={genMonthly} cons={consMonthly} />
      </div>

      {/* Typical day */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="eyebrow text-muted-3">Typical day</div>
          <div className="text-[9.5px] text-muted-b">shaded = solar used live</div>
        </div>
        <DayCurve gen={GEN_DAY.map((w) => gen * w)} load={LOAD_DAY.map((w) => demand * w)} />
      </div>

      {/* Savings */}
      <div className="rounded-card border border-border p-3 bg-control/40">
        <div className="flex items-center justify-between">
          <div className="text-[11.5px] text-muted-b">Estimated annual saving</div>
          <div className="text-[17px] font-bold text-ink tabular-nums">£{annualSaving.toLocaleString()}</div>
        </div>
        <div className="text-[10.5px] text-muted-2 mt-1">£{Math.round(saveSelf).toLocaleString()} avoided import · £{Math.round(saveExport).toLocaleString()} SEG export · {IMPORT_P * 100}p import / {EXPORT_P * 100}p export</div>
      </div>
    </div>
  )
}

function MonthlyBars({ gen, cons }: { gen: number[]; cons: number[] }) {
  const W = 286, H = 84, pad = 4, bw = (W - pad * 2) / 12
  const max = Math.max(1, ...gen, ...cons)
  return (
    <svg viewBox={`0 0 ${W} ${H + 12}`} className="w-full" style={{ height: 'auto' }}>
      {gen.map((g, i) => {
        const x = pad + i * bw, gh = (g / max) * H, ch = (cons[i] / max) * H, w = bw * 0.36
        return (
          <g key={i}>
            <rect x={x + bw * 0.14} y={H - ch} width={w} height={ch} rx={1.5} fill="#CBD5E1" />
            <rect x={x + bw * 0.5} y={H - gh} width={w} height={gh} rx={1.5} fill="#159C86" />
            <text x={x + bw / 2} y={H + 9} textAnchor="middle" fontSize="7.5" fill="#94A3B8">{MONTHS[i]}</text>
          </g>
        )
      })}
    </svg>
  )
}

function DayCurve({ gen, load }: { gen: number[]; load: number[] }) {
  const W = 286, H = 78, pad = 4
  const max = Math.max(1, ...gen, ...load)
  const pts = (a: number[]) => a.map((v, i) => `${pad + (i / 23) * (W - pad * 2)},${H - (v / max) * H}`).join(' ')
  // Self-consumption band = min(gen, load) area
  const selfArea = gen.map((g, i) => Math.min(g, load[i]))
  const areaPath = `M${pad},${H} ` + selfArea.map((v, i) => `L${pad + (i / 23) * (W - pad * 2)},${H - (v / max) * H}`).join(' ') + ` L${W - pad},${H} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H + 12}`} className="w-full" style={{ height: 'auto' }}>
      <path d={areaPath} fill="#17B890" opacity={0.28} />
      <polyline points={pts(gen)} fill="none" stroke="#159C86" strokeWidth="2" strokeLinejoin="round" />
      <polyline points={pts(load)} fill="none" stroke="#64748B" strokeWidth="1.6" strokeDasharray="4 3" strokeLinejoin="round" />
      {[6, 12, 18].map((h) => <text key={h} x={pad + (h / 23) * (W - pad * 2)} y={H + 9} textAnchor="middle" fontSize="7.5" fill="#94A3B8">{h}:00</text>)}
    </svg>
  )
}

function EStat({ v, u, c }: { v: number; u: string; c: string }) {
  return <div className="rounded-lg bg-control px-2 py-1.5"><div className="text-[14px] font-bold text-ink leading-none tabular-nums" style={{ color: c }}>{v.toLocaleString()}</div><div className="text-[9px] text-muted-2 mt-0.5 uppercase tracking-wide">{u}</div></div>
}
function BoltMini() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#159C86" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" /></svg> }
