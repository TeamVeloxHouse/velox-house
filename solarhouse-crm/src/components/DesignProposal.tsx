import { designPrice } from '../lib/designPrice'
import { useEffect, useMemo, useState } from 'react'
import { DataTable, HBars, MonthColumns } from './charts'
import { SunpathDiagram, estimateDesign, planeSunpath } from './McsProduction'
import { CumulativeChart } from './Savings'
import { useState_ } from '../store/store'
import type { Design, ShowroomSession } from '../store/types'
import { moduleById } from '../lib/panels'
import { OCCUPANCY_LABEL, KK_SOURCE_LABEL, type McsResult } from '../lib/mcs'
import { DEFAULT_FINANCE, FINANCE_LABEL, batteryRaw, project, systemPrice, type FinanceAssumptions } from '../lib/finance'
import { compass } from '../lib/design'

/* Showroom proposal pages driven by a surveyed Design Studio design: the roof plan, the MCS installation
 * figures behind the generation, the sun-path shading, and the 20-year money story on the customer's own
 * usage and tariff. Everything here is computed from the design — nothing is typed in by hand. */

const gbp = (n: number) => `${n < 0 ? '−' : ''}£${Math.abs(Math.round(n)).toLocaleString()}`
const DEG = Math.PI / 180
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function Eyebrow({ children }: { children: React.ReactNode }) { return <div className="text-[12px] font-semibold uppercase tracking-wide text-accent">{children}</div> }
function Card({ title, sub, children, className = '' }: { title?: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border border-border rounded-card p-5 ${className}`}>
      {title && <div className="text-[14px] font-bold text-ink">{title}</div>}
      {sub && <div className="text-[12px] text-muted-b mt-0.5 mb-3">{sub}</div>}
      {children}
    </div>
  )
}
function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3 py-2 border-b border-divider last:border-0"><span className="text-[12.5px] text-muted-b">{k}</span><span className="text-[13px] font-semibold text-ink text-right">{v}</span></div>
}

/** The design + its MCS estimate + the customer's 20-year projection, shared by both proposal pages. */
export function useDesignProposal(design: Design | undefined, session: ShowroomSession) {
  const { studioConfig } = useState_()
  const [mcs, setMcs] = useState<McsResult | null>(null)
  // the customer's own usage + tariff from the showroom session drive the proposal (not the studio defaults)
  const withCustomer = useMemo(() => design && ({ ...design, annualConsumptionKwh: session.annualKwh || design.annualConsumptionKwh, occupancy: session.occupancy }), [design, session.annualKwh, session.occupancy])
  useEffect(() => { let live = true; if (withCustomer) estimateDesign(withCustomer).then((r) => live && setMcs(r)); return () => { live = false } }, [withCustomer])
  const filled = design?.planes.filter((p) => p.panels?.length) ?? []
  const panels = filled.reduce((s, p) => s + (p.panels?.length ?? 0), 0)
  const mod = moduleById(filled[0]?.moduleId)
  const kwp = filled.reduce((s, p) => s + ((p.panels?.length ?? 0) * moduleById(p.moduleId).watts) / 1000, 0)
  const batt = design?.batteryKwh ?? session.design.batteryKwh ?? 0
  const parts = design ? designPrice(design, kwp, panels, studioConfig) : null
  const price = design?.priceOverride ?? (parts ? parts.pv + parts.battery : systemPrice(kwp, panels, batt, studioConfig)) // the 20-year solar page leaves the EV charger out
  const a: FinanceAssumptions = { ...DEFAULT_FINANCE, ...(design?.finance as Partial<FinanceAssumptions> | undefined), importRate: Math.max(0.1, session.tariffPence / 100) }
  const proj = useMemo(() => (mcs ? project({ capex: price, genKwh: mcs.annualKwh, useKwh: mcs.useKwh, occupancy: session.occupancy, batteryKwh: batt, batteryPrice: batteryRaw(batt) * (1 + studioConfig.marginPct / 100), a }) : null), [mcs, price, batt, session.occupancy, design?.finance, session.tariffPence]) // eslint-disable-line react-hooks/exhaustive-deps
  return { mcs, proj, a, price, kwp, panels, mod, batt, filled }
}

/** Top-down roof plan: roof faces, every module, obstacles and the Land Registry title boundary. */
export function RoofPlan({ design, strings, light, notes, onPanel }: { design: Design; strings?: { id: string; panelIds: string[]; color: string }[]; light?: boolean; notes?: boolean; onPanel?: (panelId: string) => void }) {
  const [parcel, setParcel] = useState<{ lat: number; lng: number }[] | null>(null)
  useEffect(() => {
    if (!design.center) return
    let live = true
    fetch(`/api/parcel?lat=${design.center.lat}&lng=${design.center.lng}`).then((r) => r.json()).then((j) => live && setParcel(j?.parcel ?? null)).catch(() => {})
    return () => { live = false }
  }, [design.center])
  const c = design.center ?? design.planes[0]?.polygon[0]
  if (!c) return null
  const mLng = 111320 * Math.cos(c.lat * DEG)
  const xy = (p: { lat: number; lng: number }) => [(p.lng - c.lng) * mLng, -(p.lat - c.lat) * 110540] as const
  const pts = [...design.planes.flatMap((p) => p.polygon), ...(parcel ?? [])].map(xy)
  if (!pts.length) return null
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  const pad = 2.5, minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad, w = Math.max(...xs) - minX + pad, h = Math.max(...ys) - minY + pad
  const path = (ring: { lat: number; lng: number }[]) => ring.map((p, i) => `${i ? 'L' : 'M'}${xy(p)[0].toFixed(2)},${xy(p)[1].toFixed(2)}`).join('') + 'Z'
  const colorOf = new Map<string, string>(), panelById = new Map(design.planes.flatMap((p) => (p.panels ?? []).map((pn) => [pn.id, pn] as const)))
  for (const s of strings ?? []) for (const id of s.panelIds) colorOf.set(id, s.color)
  const mid = (pn: { corners: { lat: number; lng: number }[] }) => { const a = xy(pn.corners[0]), b = xy(pn.corners[2]); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }
  const scaleM = w > 40 ? 10 : 5
  const ink = light ? '#15223B' : '#ffffff'
  return (
    <div className="relative rounded-[12px] overflow-hidden" style={{ background: light ? '#F7F9FB' : 'linear-gradient(160deg,#0E1A2E,#15223B)', border: light ? '1px solid #DEE3EA' : undefined }}>
      <svg viewBox={`${minX} ${minY} ${w} ${h}`} className="w-full h-auto max-h-[420px] block">
        <defs>
          <linearGradient id="pvglass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2B3F66" /><stop offset="1" stopColor="#101B30" /></linearGradient>
          <pattern id="grid1m" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke={ink} strokeOpacity={light ? 0.06 : 0.04} strokeWidth="0.03" /></pattern>
        </defs>
        <rect x={minX} y={minY} width={w} height={h} fill="url(#grid1m)" />
        {parcel && <path d={path(parcel)} fill="#62E4CC" fillOpacity={0.05} stroke={light ? '#0E7A66' : '#62E4CC'} strokeWidth={0.18} />}
        {design.planes.map((p) => <path key={p.id} d={path(p.polygon)} fill={light ? '#E3E8EF' : '#3A4A63'} fillOpacity={light ? 1 : 0.55} stroke={light ? '#98A1B0' : '#A8EDDF'} strokeOpacity={0.6} strokeWidth={0.08} />)}
        {(design.obstacles ?? []).map((o) => <path key={o.id} d={path(o.polygon)} fill="#98A1B0" fillOpacity={0.5} stroke={ink} strokeOpacity={0.4} strokeWidth={0.05} />)}
        {design.planes.flatMap((p) => (p.panels ?? []).map((pn) => {
          const col = colorOf.get(pn.id) ?? (strings ? '#C3CAD5' : '#62E4CC')
          return (
            <path key={pn.id} d={path(pn.corners)} fill="url(#pvglass)" stroke={col} strokeOpacity={0.95} strokeWidth={colorOf.has(pn.id) ? 0.12 : 0.05}
              strokeDasharray={strings && !colorOf.has(pn.id) ? '0.2 0.12' : undefined}
              onClick={onPanel ? () => onPanel(pn.id) : undefined} style={onPanel ? { cursor: 'pointer' } : undefined} className={onPanel ? 'hover:opacity-80' : undefined}>
              {strings && !colorOf.has(pn.id) && <title>Not on a string</title>}
            </path>
          )
        }))}
        {(strings ?? []).map((s, si) => {
          const pts = s.panelIds.map((id) => panelById.get(id)).filter(Boolean).map((pn) => mid(pn!))
          if (!pts.length) return null
          return (
            <g key={s.id} style={{ pointerEvents: 'none' }}>
              <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth={0.1} strokeLinejoin="round" strokeDasharray="0.35 0.2" />
              <circle cx={pts[0][0]} cy={pts[0][1]} r={0.42} fill={s.color} />
              <text x={pts[0][0]} y={pts[0][1] + 0.2} fontSize={0.55} fontWeight={700} textAnchor="middle" fill="#15223B">{si + 1}</text>
            </g>
          )
        })}
        {notes && (design.notes ?? []).map((n, i) => { const [x, y] = xy(n); return <g key={n.id}><circle cx={x} cy={y} r={0.5} fill="#F59E0B" stroke="#fff" strokeWidth={0.08} /><text x={x} y={y + 0.2} fontSize={0.55} fontWeight={700} textAnchor="middle" fill="#15223B">{i + 1}</text></g> })}
        <g transform={`translate(${minX + w - scaleM - 1.2},${minY + h - 1.2})`}>
          <rect width={scaleM} height={0.18} fill={ink} fillOpacity={0.8} />
          <text x={scaleM / 2} y={-0.35} fontSize={0.7} textAnchor="middle" fill={ink} fillOpacity={0.8}>{scaleM} m</text>
        </g>
      </svg>
      <div className={`absolute left-3 bottom-3 flex gap-3 text-[10.5px] font-semibold ${light ? 'text-ink-3' : 'text-white/75'}`}>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-2 rounded-[2px] bg-[#1E2F4E] border border-[#62E4CC]" />Solar modules</span>
        {parcel && <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#62E4CC]" />Title boundary</span>}
        {strings?.length ? <span>Numbered dot = string start (+)</span> : null}
      </div>
      <div className={`absolute right-3 top-3 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${light ? 'bg-white border border-border text-ink' : 'bg-white/10 text-white'}`}>N↑</div>
    </div>
  )
}

/* ─────────── Page: your surveyed design ─────────── */
export function SectionSurveyedDesign({ design, session }: { design: Design; session: ShowroomSession }) {
  const { mcs, kwp, panels, mod, batt, filled } = useDesignProposal(design, session)

  return (
    <div className="flex flex-col gap-4">
      <div><Eyebrow>Your surveyed design</Eyebrow><h2 className="text-[22px] font-bold text-ink mt-1">Designed for your roof, panel by panel</h2>
        <p className="text-[13.5px] text-muted-b mt-1">Measured from aerial imagery of {design.address.split(',')[0]} and laid out around your roof's edges, vents and chimneys.</p></div>
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr] items-start">
        <RoofPlan design={design} />
        <Card title="Your system">
          <Fact k="Solar modules" v={`${panels} × ${mod.brand} ${mod.watts} W`} />
          <Fact k="System size" v={`${kwp.toFixed(2)} kWp`} />
          <Fact k="Roof faces used" v={filled.map((p) => `${p.name || 'Roof'} (${compass(p.azimuthDeg)})`).join(', ')} />
          <Fact k="Battery storage" v={batt ? `${batt} kWh usable` : 'None'} />
          <Fact k="Expected generation" v={mcs ? `${mcs.annualKwh.toLocaleString()} kWh a year` : '…'} />
          <Fact k="Your home uses" v={mcs ? `${mcs.useKwh.toLocaleString()} kWh a year` : '…'} />
          <Fact k="Powered by your solar" v={mcs ? `${Math.round(mcs.selfSufficiency * 100)}% of it` : '…'} />
          <Fact k="Module warranty" v={`${mod.warrantyYr ?? 25} years`} />
        </Card>
      </div>

      <Card title="How your generation is calculated" sub={`The MCS method: system size × a yield for your location, roof angle and direction × a shading factor. Occupancy: ${OCCUPANCY_LABEL[session.occupancy]}.`}>
        <DataTable
          cols={[{ label: 'Roof face', w: 'minmax(110px,1.2fr)' }, { label: 'Pitch', align: 'right' }, { label: 'Facing', align: 'right' }, { label: 'Size', align: 'right' }, { label: 'Yield (kWh/kWp)', align: 'right' }, { label: 'Shading', align: 'right' }, { label: 'kWh a year', align: 'right' }]}
          rows={(mcs?.arrays ?? []).map((r) => [<b key="n">{r.name}</b>, `${Math.round(r.tiltDeg)}°`, `${compass(r.azimuthFromSouthDeg + 180)} (${Math.round(r.azimuthFromSouthDeg)}° from S)`, `${r.kwp.toFixed(2)} kWp`, r.kk, r.sf.toFixed(2), <b key="k">{r.kwh.toLocaleString()}</b>])}
          foot={mcs ? ['Total', '', '', `${kwp.toFixed(2)} kWp`, '', '', `${mcs.annualKwh.toLocaleString()} kWh`] : undefined}
        />
        {mcs && <div className="text-[11.5px] text-muted-b mt-2">Yield source: {KK_SOURCE_LABEL[mcs.source]}{mcs.zone ? ` · MCS zone ${mcs.zone}` : ''}.</div>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <Card title="Month by month" sub="Most of your power comes April to September — the table shows a typical day in each month">
          <MonthColumns data={(mcs?.monthlyKwh ?? Array(12).fill(0)).map((v, i) => ({ label: MONTHS[i][0], value: v, sub: `${MONTHS[i]}: about ${Math.round(v / DAYS[i])} kWh a day` }))} fmt={(n) => `${Math.round(n)}`} height={180} />
          <div className="grid grid-cols-6 gap-1 mt-3">
            {(mcs?.monthlyKwh ?? []).map((v, i) => <div key={i} className="rounded-[6px] bg-[#F1FBF8] text-center py-1"><div className="text-[10px] text-muted-b">{MONTHS[i]}</div><div className="text-[12px] font-bold text-ink tabular-nums">{(v / DAYS[i]).toFixed(1)}</div></div>)}
          </div>
          <div className="text-[10.5px] text-muted-3 mt-1">kWh per day, average</div>
        </Card>
        <Card title="Shading check" sub="Where the sun is through the year from each roof face — navy blocks are blocked by trees, buildings or roof features">
          <div className="grid gap-3">
            {filled.slice(0, 2).map((p) => {
              const r = mcs?.arrays.find((x) => x.id === p.id)
              return <SunpathDiagram key={p.id} segments={planeSunpath(design, p.id).segments} title={`${p.name || 'Roof'} · shading factor ${(r?.sf ?? 1).toFixed(2)}`} />
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ─────────── Page: 20 years with solar ─────────── */
export function SectionLongTerm({ design, session }: { design: Design; session: ShowroomSession }) {
  const { proj, a, price } = useDesignProposal(design, session)
  if (!proj) return <div className="text-[13px] text-muted-b">Working out your 20-year figures…</div>
  const r1 = proj.rows[0]
  const keyRows = proj.rows.filter((r) => r.year === 1 || r.year % 5 === 0)
  return (
    <div className="flex flex-col gap-4">
      <div><Eyebrow>{a.years} years with solar</Eyebrow><h2 className="text-[22px] font-bold text-ink mt-1">What your system is worth over its life</h2>
        <p className="text-[13.5px] text-muted-b mt-1">Worked out on your own usage and your current {Math.round(a.importRate * 100)}p unit rate.</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-card p-4 text-white" style={{ background: 'linear-gradient(140deg,#15223B,#0E7A66)' }}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#62E4CC]">Total saved</div>
          <div className="text-[28px] font-bold tabular-nums leading-tight mt-1">{gbp(proj.lifetimeSavings)}</div>
          <div className="text-[11.5px] text-white/70">over {a.years} years</div>
        </div>
        <Big label="Pays for itself in" v={proj.payback != null ? `${proj.payback.toFixed(1)} years` : `over ${a.years} years`} sub={`for a ${gbp(price)} system`} />
        <Big label="Return on investment" v={proj.irr != null ? `${(proj.irr * 100).toFixed(1)}% a year` : '—'} sub="like a savings rate, tax-free" />
        <Big label="CO₂ avoided" v={`${(Math.round(proj.co2Tonnes * 10) / 10).toLocaleString()} t`} sub={`${Math.round(proj.lifetimeKwh / 1000).toLocaleString()} MWh of clean power`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr] items-start">
        <Card title="Your bill in year one" sub="Standing charge included — it's paid with or without solar">
          <HBars fmt={gbp} data={[
            { label: 'Today', value: r1.billBefore, color: '#15223B', sub: `${(r1.billBefore / 12).toFixed(0)} a month` },
            { label: 'With solar', value: r1.billAfter, color: '#169C85', sub: `${(r1.billAfter / 12).toFixed(0)} a month` },
          ]} />
          <div className="mt-3 text-[12.5px] text-ink-3">Plus <b className="text-ink">{gbp(r1.exportIncome)}</b> paid to you for the {r1.exportKwh.toLocaleString()} kWh you send to the grid.{r1.tariffSaving > 0 && <> Your battery also tops up on cheap overnight power ({r1.gridShiftKwh.toLocaleString()} kWh a year), included in the bill above.</>}</div>
        </Card>
        <Card title="Your money over time" sub="The running total after paying for the system — once it goes teal you're in profit">
          <CumulativeChart proj={proj} />
        </Card>
      </div>
      <Card title="Year by year">
        <DataTable
          cols={[{ label: 'Year', w: '60px' }, { label: 'Generation', align: 'right' }, { label: 'Unit price', align: 'right' }, { label: 'Bill saving', align: 'right' }, { label: 'Export income', align: 'right' }, { label: 'Saved that year', align: 'right' }, { label: 'Running total', align: 'right' }]}
          rows={keyRows.map((r) => [r.year, `${r.genKwh.toLocaleString()} kWh`, `${Math.round(r.importRate * 100)}p`, gbp(r.importSaving + r.tariffSaving), gbp(r.exportIncome), <b key="n">{gbp(r.net)}</b>, <span key="c" className={r.cumulative < 0 ? 'text-ink-3' : 'text-[#0E7A66] font-bold'}>{gbp(r.cumulative)}</span>])}
        />
      </Card>
      <Card title="The assumptions behind these figures">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6">
          <Fact k={FINANCE_LABEL.importRate.label} v={`${Math.round(a.importRate * 100)}p per kWh today`} />
          <Fact k={FINANCE_LABEL.priceRise.label} v={`${(a.priceRise * 100).toFixed(1)}% a year`} />
          <Fact k={FINANCE_LABEL.exportRate.label} v={`${Math.round(a.exportRate * 100)}p per kWh`} />
          <Fact k={FINANCE_LABEL.annualDeg.label} v={`${(a.annualDeg * 100).toFixed(2)}% a year`} />
          <Fact k={FINANCE_LABEL.discountRate.label} v={`${(a.discountRate * 100).toFixed(1)}% a year`} />
          <Fact k={FINANCE_LABEL.inverterYear.label} v={`in year ${a.inverterYear}`} />
        </div>
        <p className="text-[11.5px] text-muted-b mt-3 leading-relaxed">Generation follows the MCS estimation method and is a guide to the first year, not a guarantee. Savings depend on future energy prices, export rates and how your home uses electricity. Panel output is assumed to fall slightly each year, and one inverter replacement is included. The Smart Export Guarantee rate is set by your energy supplier.</p>
      </Card>
    </div>
  )
}
function Big({ label, v, sub }: { label: string; v: string; sub: string }) {
  return <div className="rounded-card bg-surface border border-border p-4"><div className="text-[11px] font-semibold uppercase tracking-wide text-muted-b">{label}</div><div className="text-[22px] font-bold text-ink tabular-nums leading-tight mt-1">{v}</div><div className="text-[11.5px] text-muted-b">{sub}</div></div>
}
