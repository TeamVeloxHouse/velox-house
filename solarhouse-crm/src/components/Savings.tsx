import { useMemo, useState } from 'react'
import { Kpi, Panel } from './ui'
import { DataTable, HBars, Legend } from './charts'
import { Pie, Target, Bolt, Sun, Home } from './icons'
import { Dropdown } from './Dropdown'
import { useActions, useState_ } from '../store/store'
import type { Design, DesignPlane } from '../store/types'
import { moduleById } from '../lib/panels'
import { polygonAreaM2, slopedAreaM2 } from '../lib/design'
import { useMcs } from './McsProduction'
import { DEFAULT_FINANCE, FINANCE_LABEL, OPT_METRIC, batteryRaw, metricOf, optimise, project, systemPrice, type FinanceAssumptions, type OptMetric, type Projection } from '../lib/finance'

/* Savings tab — the 20-year money story for this design, and the optimiser that scores every solar size ×
 * battery size so the adviser can show why this system is the right one. */

const gbp = (n: number) => `${n < 0 ? '−' : ''}£${Math.abs(Math.round(n)).toLocaleString()}`
const RAMP = ['#EAF8F4', '#A8EDDF', '#2FBFA5', '#169C85', '#0E7A66', '#15223B']
function rampAt(t: number) {
  const x = Math.max(0, Math.min(1, t)) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(x)), f = x - i
  const h = (s: string) => [1, 3, 5].map((k) => parseInt(s.slice(k, k + 2), 16))
  const a = h(RAMP[i]), b = h(RAMP[i + 1])
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(',')})`
}

/** Running total after paying for the system, year by year — navy while paying back, teal once in profit. */
export function CumulativeChart({ proj }: { proj: Projection }) {
  const price = proj.capex, cum = proj.rows.map((r) => r.cumulative)
  const cMin = Math.min(-price, ...cum), cMax = Math.max(0, ...cum)
  const H = 170, y = (v: number) => 8 + ((cMax - v) / (cMax - cMin || 1)) * (H - 8), bw = 520 / (cum.length + 1)
  return (
    <div>
      <svg viewBox="0 0 520 200" className="w-full h-auto">
        <line x1={0} x2={520} y1={y(0)} y2={y(0)} stroke="#98A1B0" strokeDasharray="3 3" />
        <text x={4} y={y(0) - 4} fontSize="9" fill="#6B7585">£0</text>
        <rect x={bw * 0.15} width={bw * 0.7} y={y(0)} height={Math.max(1, y(-price) - y(0))} rx={3} fill="#15223B" fillOpacity={0.35}><title>{`Year 0 · pay ${gbp(price)}`}</title></rect>
        {cum.map((v, i) => (
          <rect key={i} x={bw * (i + 1) + bw * 0.15} width={bw * 0.7} y={Math.min(y(v), y(0))} height={Math.max(1, Math.abs(y(v) - y(0)))} rx={3} fill={v < 0 ? '#15223B' : '#169C85'}>
            <title>{`Year ${i + 1} · ${gbp(v)} cumulative · ${gbp(proj.rows[i].net)} that year${proj.rows[i].costs ? ` (after ${gbp(proj.rows[i].costs)} replacement)` : ''}`}</title>
          </rect>
        ))}
        {[0, 5, 10, 15, 20, 25].filter((n) => n <= cum.length).map((n) => <text key={n} x={bw * n + bw / 2} y={H + 22} fontSize="9" textAnchor="middle" fill="#98A1B0">{n === 0 ? 'Now' : `Yr ${n}`}</text>)}
      </svg>
      <Legend items={[{ label: 'Still paying back', swatch: '#15223B' }, { label: 'In profit', swatch: '#169C85' }]} />
    </div>
  )
}

/** Most panels the plane could take: the placed count, or ~60% of its sloped area in modules. */
function capacityOf(p: DesignPlane, mArea: number) {
  return Math.max(p.panels?.length ?? 0, Math.floor((slopedAreaM2(polygonAreaM2(p.polygon), p.pitchDeg) * 0.6) / mArea))
}

export function Savings({ design, moduleId, effTilt }: { design: Design; moduleId: string; effTilt: (p: DesignPlane) => number }) {
  const act = useActions()
  const { studioConfig } = useState_()
  const { res, planeYield, filled, occ, use, batt } = useMcs(design, moduleId, effTilt)
  const [metric, setMetric] = useState<OptMetric>('npv')
  const [showAll, setShowAll] = useState(false)
  const a: FinanceAssumptions = { ...DEFAULT_FINANCE, ...(design.finance as Partial<FinanceAssumptions> | undefined) }
  const mod = moduleById(moduleId)
  const panels = filled.reduce((s, p) => s + (p.panels?.length ?? 0), 0)
  const kwp = filled.reduce((s, p) => s + ((p.panels?.length ?? 0) * moduleById(p.moduleId ?? moduleId).watts) / 1000, 0)
  const formula = systemPrice(kwp, panels, batt, studioConfig)
  const price = design.priceOverride ?? formula
  const proj = useMemo(() => (res ? project({ capex: price, genKwh: res.annualKwh, useKwh: use, occupancy: occ, batteryKwh: batt, batteryPrice: batteryRaw(batt) * (1 + studioConfig.marginPct / 100), a }) : null), [res, price, use, occ, batt, design.finance]) // eslint-disable-line react-hooks/exhaustive-deps

  const opt = useMemo(() => {
    const ys: number[] = []
    for (const p of design.planes) {
      const perPanel = ((planeYield[p.id] ?? 0) * mod.watts) / 1000
      if (perPanel > 0) for (let i = 0; i < capacityOf(p, mod.w * mod.h); i++) ys.push(perPanel)
    }
    return ys.length ? optimise({ panelYields: ys, watts: mod.watts, useKwh: use, occupancy: occ, cfg: studioConfig, a }) : null
  }, [planeYield, design.planes, mod, use, occ, studioConfig, design.finance]) // eslint-disable-line react-hooks/exhaustive-deps

  const setFin = (k: keyof FinanceAssumptions, v: number) => act.updateDesign(design.id, { finance: { ...(design.finance ?? {}), [k]: v } })
  if (!filled.length) return <div className="absolute inset-0 flex items-center justify-center text-[13px] text-muted-b">Place panels first — the savings are worked out from the design.</div>

  // heatmap scaling
  const flat = opt?.cells.flat() ?? []
  const vals = flat.map((c) => metricOf(c, metric)).filter(Number.isFinite)
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const better = OPT_METRIC[metric].better
  const score = (v: number) => (!Number.isFinite(v) || hi === lo ? (Number.isFinite(v) ? 1 : 0) : better === 'high' ? (v - lo) / (hi - lo) : (hi - v) / (hi - lo))
  const best = flat.reduce<(typeof flat)[number] | null>((b, c) => (!b || score(metricOf(c, metric)) > score(metricOf(b, metric)) ? c : b), null)
  const nearestRow = opt ? opt.counts.reduce((bi, n, i) => (Math.abs(n - panels) < Math.abs(opt.counts[bi] - panels) ? i : bi), 0) : -1
  const rows = showAll ? proj?.rows ?? [] : (proj?.rows ?? []).filter((r) => r.year <= 5 || r.year % 5 === 0 || r.costs > 0)

  return (
    <div className="absolute inset-0 overflow-y-auto px-5 py-5">
      <div className="max-w-[1100px] mx-auto flex flex-col gap-4">
        <div className="grid grid-cols-5 gap-3">
          <div className="rounded-card bg-[#15223B] text-white px-4 py-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#62E4CC]">System price</div>
            <div className="flex items-baseline gap-1 mt-1"><span className="text-[22px] font-bold">£</span>
              <input type="number" value={price} onChange={(e) => act.updateDesign(design.id, { priceOverride: Number(e.target.value) || undefined })} className="w-full bg-transparent text-[24px] font-bold tabular-nums outline-none border-b border-white/15 focus:border-[#62E4CC]" />
            </div>
            <div className="text-[11px] text-white/60 mt-1">{design.priceOverride ? <button className="underline" onClick={() => act.updateDesign(design.id, { priceOverride: undefined })}>Reset to pricing ({gbp(formula)})</button> : `From Studio pricing · ${kwp.toFixed(2)} kWp${batt ? ` + ${batt} kWh` : ''}`}</div>
          </div>
          <Kpi variant="teal" icon={Target} label={`${a.years}-year NPV`} value={proj ? gbp(proj.npv) : '…'} delta={`today's money at ${(a.discountRate * 100).toFixed(1)}%`} deltaTone="muted" />
          <Kpi icon={Pie} label="Return (IRR)" value={proj?.irr != null ? `${(proj.irr * 100).toFixed(1)}%` : '—'} delta={proj ? `${Math.round(proj.roi * 100)}% lifetime return` : ''} deltaTone="muted" />
          <Kpi icon={Bolt} label="Payback" value={proj?.payback != null ? `${proj.payback.toFixed(1)} yrs` : '—'} delta={proj?.discountedPayback != null ? `${proj.discountedPayback.toFixed(1)} yrs discounted` : 'not within the term'} deltaTone="muted" />
          <Kpi icon={Home} label="Year-1 saving" value={proj ? gbp(proj.firstYearSaving) : '…'} delta={proj ? `${gbp(proj.lifetimeSavings)} over ${a.years} years` : ''} />
        </div>

        <div className="grid grid-cols-[1fr_1.4fr] gap-4">
          <Panel title="Electricity bill — year 1" sub="Same usage, before and after the system (standing charge included)" icon={Home}>
            {proj && <HBars fmt={gbp} data={[
              { label: 'Without solar', value: proj.billBefore1, color: '#15223B', sub: `${use.toLocaleString()} kWh at ${Math.round(a.importRate * 100)}p` },
              { label: 'With this system', value: Math.max(0, proj.billAfter1), color: '#169C85', sub: `${(proj.rows[0].selfKwh).toLocaleString()} kWh self-used · ${gbp(proj.rows[0].exportIncome)} export income` },
            ]} />}
            {proj && <div className="mt-3 text-[12.5px] text-ink-3">Cuts the bill by <b className="text-ink">{gbp(proj.billBefore1 - proj.billAfter1)}</b> ({Math.round(((proj.billBefore1 - proj.billAfter1) / proj.billBefore1) * 100)}%) in year one, plus <b className="text-ink">{gbp(proj.rows[0].exportIncome)}</b> paid for exported power — and {Math.round(proj.co2Tonnes * 10) / 10} t of CO₂ avoided over {a.years} years.</div>}
          </Panel>
          <Panel title="Cumulative cashflow" sub="Running total after paying for the system — where it crosses zero is payback" icon={Target}>
            {proj && <CumulativeChart proj={proj} />}
          </Panel>
        </div>

        <Panel title="Optimise — solar × battery" sub="Every system size this roof can take against every battery size, scored on the same 20-year model. Click a cell to use that battery." icon={Sun}
          action={<Dropdown value={metric} onChange={(e) => setMetric(e.target.value as OptMetric)}>{(Object.keys(OPT_METRIC) as OptMetric[]).map((k) => <option key={k} value={k}>{OPT_METRIC[k].label}</option>)}</Dropdown>}>
          {!opt ? <div className="text-[12.5px] text-muted-b">Working out the yield for each roof face…</div> : (
            <div className="overflow-x-auto">
              <div className="grid gap-[3px] min-w-[640px]" style={{ gridTemplateColumns: `110px repeat(${opt.batteries.length}, 1fr)` }}>
                <div className="text-[10.5px] font-semibold text-muted-3 uppercase self-end pb-1">Solar ↓ · Battery →</div>
                {opt.batteries.map((b) => <div key={b} className="text-[11.5px] font-bold text-ink-3 text-center pb-1">{b ? `${b} kWh` : 'None'}</div>)}
                {opt.cells.map((row, ri) => [
                  <div key={`h${ri}`} className="text-[12px] font-bold text-ink-2 flex flex-col justify-center">{row[0].kwp.toFixed(1)} kWp<span className="text-[10.5px] font-medium text-muted-b">{row[0].panels} panels · {row[0].genKwh.toLocaleString()} kWh</span></div>,
                  ...row.map((c) => {
                    const v = metricOf(c, metric), t = score(v), isBest = c === best, isCur = ri === nearestRow && c.batteryKwh === batt
                    return (
                      <button key={`${ri}-${c.batteryKwh}`} onClick={() => act.updateDesign(design.id, { batteryKwh: c.batteryKwh })}
                        title={`${c.kwp.toFixed(1)} kWp + ${c.batteryKwh || 'no'} battery · price ${gbp(c.price)} · NPV ${gbp(c.p.npv)} · self-sufficiency ${Math.round(c.p.selfSufficiency1 * 100)}% · year-1 saving ${gbp(c.p.firstYearSaving)} · payback ${c.p.payback?.toFixed(1) ?? '—'} yrs`}
                        className={`relative h-12 rounded-[6px] text-[12px] font-bold tabular-nums transition-transform hover:scale-[1.04] hover:z-10 ${isCur ? 'ring-2 ring-offset-1 ring-[#F59E0B]' : ''}`}
                        style={{ background: rampAt(t), color: t > 0.55 ? '#fff' : '#15223B' }}>
                        {OPT_METRIC[metric].fmt(v)}
                        {isBest && <span className="absolute top-0.5 right-1 text-[10px]">★</span>}
                      </button>
                    )
                  }),
                ])}
              </div>
              <div className="flex items-center gap-4 mt-3 text-[11.5px] text-muted-b flex-wrap">
                <span className="inline-flex items-center gap-1.5"><span className="w-24 h-2.5 rounded-full" style={{ background: `linear-gradient(90deg,${RAMP.join(',')})` }} />{better === 'high' ? 'lower → higher' : 'worse → better'}</span>
                <span>★ best {OPT_METRIC[metric].label.toLowerCase()}{best ? `: ${best.kwp.toFixed(1)} kWp + ${best.batteryKwh || 'no'} battery` : ''}</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px] ring-2 ring-[#F59E0B]" />this design</span>
                {best && nearestRow >= 0 && best.panels !== opt.counts[nearestRow] && <span className="text-ink-3">To match the best, place <b>{best.panels}</b> panels ({best.kwp.toFixed(1)} kWp) on the Design tab.</span>}
              </div>
            </div>
          )}
        </Panel>

        <div className="grid grid-cols-[1fr_1.6fr] gap-4">
          <Panel title="Assumptions" sub="Change any figure — every number on this page and the optimiser update" icon={Pie}>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {(Object.keys(FINANCE_LABEL) as (keyof FinanceAssumptions)[]).map((k) => {
                const f = FINANCE_LABEL[k], v = a[k], shown = f.pct ? Math.round(v * 10000) / 100 : v
                return (
                  <label key={k} className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-semibold text-muted-b">{f.label} <span className="font-normal text-muted-3">{f.unit}</span></span>
                    <input type="number" step={f.step ?? (f.pct ? 0.5 : 1)} value={shown} onChange={(e) => { const n = Number(e.target.value); setFin(k, f.pct ? n / 100 : n) }}
                      className={`h-8 px-2 rounded-[8px] border text-[12.5px] font-semibold tabular-nums ${design.finance?.[k] != null ? 'border-[#62E4CC] bg-[#F1FBF8]' : 'border-[#E1E6EC]'}`} />
                  </label>
                )
              })}
            </div>
            {design.finance && Object.keys(design.finance).length > 0 && <button onClick={() => act.updateDesign(design.id, { finance: undefined })} className="mt-3 text-[12px] font-semibold text-accent">Reset to defaults</button>}
          </Panel>
          <Panel title={`${a.years}-year cashflow`} sub="Output falls a little each year; prices rise; replacements land in their year" icon={Target}
            action={<button onClick={() => setShowAll(!showAll)} className="text-[12px] font-semibold text-accent">{showAll ? 'Key years' : 'Every year'}</button>}>
            <DataTable
              cols={[{ label: 'Year', w: '52px' }, { label: 'kWh', align: 'right' }, { label: 'Price', align: 'right' }, { label: 'Bill saving', align: 'right' }, { label: 'Export', align: 'right' }, { label: 'Costs', align: 'right' }, { label: 'Net', align: 'right' }, { label: 'Cumulative', align: 'right' }]}
              rows={rows.map((r) => [r.year, r.genKwh.toLocaleString(), `${Math.round(r.importRate * 100)}p`, gbp(r.importSaving), gbp(r.exportIncome), r.costs ? <span key="c" className="text-[#B45309]">{gbp(-r.costs)}</span> : '—', <b key="n">{gbp(r.net)}</b>, <span key="u" className={r.cumulative < 0 ? 'text-ink-3' : 'text-[#0E7A66] font-bold'}>{gbp(r.cumulative)}</span>])}
              foot={proj ? ['Total', proj.lifetimeKwh.toLocaleString(), '', gbp(proj.rows.reduce((s, r) => s + r.importSaving, 0)), gbp(proj.rows.reduce((s, r) => s + r.exportIncome, 0)), gbp(-proj.rows.reduce((s, r) => s + r.costs, 0)), gbp(proj.lifetimeSavings), gbp(proj.lifetimeSavings - price)] : undefined}
            />
          </Panel>
        </div>
        <div className="text-[11.5px] text-muted-b">Savings are an estimate built on the MCS generation figure and the assumptions shown. Future energy prices, export rates and how the home uses electricity will change the real result.</div>
      </div>
    </div>
  )
}
