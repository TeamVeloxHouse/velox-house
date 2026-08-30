import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Chip } from '../components/ui'
import { Sun, Bolt, Person, Check, Flow } from '../components/icons'
import { useState_ } from '../store/store'
import { money, classNames } from '../lib/format'
import { RoofOverlay } from '../components/RoofOverlay'
import { CompanyLogo, scoreTone } from './CommercialSolar'
import { analyseRoofLive } from '../lib/solar'
import { computeCommercial, classifyIndustry, type CommercialCalc } from '../lib/commercialModel'
import { fetchPvgisHourly } from '../lib/pvgisClient'
import { buildHourlyLoad, monthlyBuckets, MONTH_LABELS } from '../lib/loadProfiles'
import { UK } from '../lib/energy'

const GRAD_FROM = '#3B6BF5', GRAD_TO = '#7C3AED'

export function SolarSiteDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { solarProspects } = useState_()
  const p = solarProspects.find((x) => x.id === id)
  const [calc, setCalc] = useState<CommercialCalc | null>(p?.calc ?? null)
  const [monthly, setMonthly] = useState<{ gen: number[]; load: number[] } | null>(null)
  const [accurate, setAccurate] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!p?.center) { setLoading(false); return }
    let dead = false
    ;(async () => {
      setLoading(true)
      try {
        const analysis = await analyseRoofLive(p.address, p.center)
        const seg = analysis.segments[0]
        const industry = p.calc?.industry ?? classifyIndustry(undefined)
        const pvgis = await fetchPvgisHourly(p.center!.lat, p.center!.lng, seg?.pitch ?? 12, seg?.azimuthDeg ?? 0)
        const fresh = computeCommercial(analysis, {
          industry, floorAreaM2: p.calc?.assumptions.floorAreaM2,
          hourlyGenPerKwp: pvgis?.perKwpWh, objective: 'payback',
        })
        const shade = analysis.shadeFactor ?? 1
        const genMonthly = pvgis
          ? monthlyBuckets(pvgis.perKwpWh.map((wh) => (wh / 1000) * fresh.recommended.kwp * shade))
          : MONTH_LABELS.map(() => fresh.recommended.annualGenKwh / 12)
        const loadMonthly = monthlyBuckets(buildHourlyLoad(fresh.demandKwh, industry))
        if (!dead) { setCalc(fresh); setMonthly({ gen: genMonthly, load: loadMonthly }); setAccurate(!!pvgis) }
      } catch { /* keep stored calc */ } finally { if (!dead) setLoading(false) }
    })()
    return () => { dead = true }
  }, [id])

  if (!p) return <><TopBar title="Site" /><PageBody><div className="p-10 text-center text-muted-b">Prospect not found. <button className="text-accent" onClick={() => nav('/tools/commercial-solar')}>Back to finder</button></div></PageBody></>

  const r = calc?.recommended
  const img = p.imageUrl?.replace('560x360', '900x420')

  return (
    <>
      <TopBar title={p.company} crumbs={['Tools', 'Commercial Solar']}
        actions={<Button variant="secondary" icon={<Flow size={15} />} onClick={() => nav('/tools/commercial-solar')}>Back to finder</Button>} />
      <PageBody>
        <div className="grid grid-cols-[1.15fr_1fr] gap-5">
          {/* roof image */}
          <div className="rounded-card overflow-hidden border border-border relative bg-control aspect-[15/7]">
            {img && <img src={img} alt="" className="w-full h-full object-cover absolute inset-0" />}
            <RoofOverlay center={p.center} segments={p.roofSegments} zoom={p.roofZoom} w={900} h={420} />
            <div className="absolute top-3 left-3 flex gap-2">
              <span className="text-[12px] font-bold text-white px-2.5 py-1 rounded-full shadow" style={{ background: scoreTone(p.score) }}>Score {p.score}</span>
              {accurate && <span className="text-[11px] font-bold text-white px-2.5 py-1 rounded-full" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}>◆ PVGIS accurate</span>}
              {p.roofAreaM2 && <span className="text-[11px] font-semibold text-white bg-black/55 px-2 py-1 rounded backdrop-blur-sm self-center">{p.roofAreaM2.toLocaleString()} m² measured</span>}
            </div>
          </div>
          {/* headline */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <CompanyLogo domain={p.domain} name={p.company} size={52} />
              <div className="min-w-0">
                <div className="text-[20px] font-bold text-ink leading-tight truncate">{p.company}</div>
                <div className="text-[13px] text-muted-b truncate">{p.address}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Big label="Recommended system" value={`${r ? Math.round(r.kwp) : '—'} kWp`} sub={`${r?.panels ?? '—'} panels · roof fits ${p.roofMaxKwp} kWp`} />
              <Big label="Payback" value={`${r?.paybackYears ?? '—'} yrs`} sub={`best-payback size`} accent />
              <Big label="Year-1 saving" value={money(r?.year1Saving ?? 0)} sub="energy + export" pos />
              <Big label="25-year saving" value={money(r?.lifetimeSaving ?? 0, { compact: true })} sub={`NPV ${money(r?.npv ?? 0, { compact: true })}`} pos />
            </div>
            {loading && <div className="text-[12.5px] text-accent flex items-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />Running PVGIS accurate model…</div>}
          </div>
        </div>

        {r && calc && (
          <>
            <div className="grid grid-cols-2 gap-5">
              <ChartCard title="System size vs payback" subtitle="Why this size — the optimiser's sweep">
                <SweepChart sweep={calc.sweep} recKwp={r.kwp} />
              </ChartCard>
              <ChartCard title="Self-consumption" subtitle={`${r.selfConsumptionPct}% used on-site · covers ${r.demandOffsetPct}% of demand`}>
                <Donut self={r.selfConsumedKwh} exported={r.exportedKwh} />
              </ChartCard>
            </div>
            <div className="grid grid-cols-2 gap-5">
              {monthly && (
                <ChartCard title="Generation vs consumption" subtitle="Monthly — kWh">
                  <MonthlyBars gen={monthly.gen} load={monthly.load} />
                </ChartCard>
              )}
              <ChartCard title="25-year cumulative cash" subtitle="Crosses zero at payback">
                <CashflowChart year1={r.year1Saving} capex={r.capex} years={calc.assumptions.years} inflation={calc.assumptions.inflation} degradation={calc.assumptions.degradation} />
              </ChartCard>
            </div>

            <div className="rounded-card bg-surface border border-border p-4">
              <div className="eyebrow text-[10px] text-muted-3 mb-3">Assumptions {accurate && '· PVGIS 8,760-hour simulation'}</div>
              <div className="grid grid-cols-4 gap-4 text-[12.5px]">
                <Assume l="Industry" v={cap(calc.industry)} />
                <Assume l="Est. annual demand" v={`${Math.round(calc.demandKwh).toLocaleString()} kWh`} />
                <Assume l="Specific yield" v={`${calc.specificYield} kWh/kWp`} />
                <Assume l="Method" v={calc.method === 'hourly' ? 'Hourly (PVGIS)' : 'Coefficient'} />
                <Assume l="Import price" v={`${(calc.assumptions.importRate * 100).toFixed(0)}p/kWh`} />
                <Assume l="Export price" v={`${(calc.assumptions.exportRate * 100).toFixed(0)}p/kWh`} />
                <Assume l="Energy inflation" v={`${(calc.assumptions.inflation * 100).toFixed(0)}%/yr`} />
                <Assume l="CO₂ saved" v={`${r.co2PerYearTonnes} t/yr`} />
              </div>
            </div>
          </>
        )}
      </PageBody>
    </>
  )
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')

function Big({ label, value, sub, pos, accent }: { label: string; value: string; sub?: string; pos?: boolean; accent?: boolean }) {
  return (
    <div className="rounded-card bg-control p-3.5">
      <div className="text-[11.5px] text-muted-2 font-medium">{label}</div>
      <div className={classNames('text-[24px] font-bold mt-1 tracking-[-0.02em]', pos ? 'text-positive' : accent ? 'text-accent' : 'text-ink')}>{value}</div>
      {sub && <div className="text-[11px] text-muted-2 mt-0.5">{sub}</div>}
    </div>
  )
}
function Assume({ l, v }: { l: string; v: string }) {
  return <div><div className="text-muted-2">{l}</div><div className="font-semibold text-ink-2 mt-0.5">{v}</div></div>
}
function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card bg-surface border border-border p-4">
      <div className="flex items-baseline justify-between mb-3"><div className="text-[14px] font-bold text-ink">{title}</div>{subtitle && <div className="text-[11.5px] text-muted-2">{subtitle}</div>}</div>
      {children}
    </div>
  )
}

/* ─────────── SVG charts ─────────── */
function SweepChart({ sweep, recKwp }: { sweep: { kwp: number; payback: number }[]; recKwp: number }) {
  const W = 420, H = 180, pad = 30
  const pts = sweep.filter((s) => isFinite(s.payback) && s.payback < 40)
  if (pts.length < 2) return <Empty />
  const xMax = Math.max(...pts.map((p) => p.kwp)), yMax = Math.max(...pts.map((p) => p.payback))
  const X = (k: number) => pad + (k / xMax) * (W - pad - 8)
  const Y = (v: number) => H - pad - (v / yMax) * (H - pad - 8)
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.kwp).toFixed(1)},${Y(p.payback).toFixed(1)}`).join(' ')
  const area = `${line} L${X(pts[pts.length - 1].kwp)},${H - pad} L${X(pts[0].kwp)},${H - pad} Z`
  const rec = pts.reduce((a, b) => (Math.abs(b.kwp - recKwp) < Math.abs(a.kwp - recKwp) ? b : a), pts[0])
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs><linearGradient id="swg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={GRAD_FROM} stopOpacity="0.28" /><stop offset="1" stopColor={GRAD_FROM} stopOpacity="0" /></linearGradient></defs>
      {[0, 0.5, 1].map((f) => <line key={f} x1={pad} x2={W - 8} y1={Y(yMax * f)} y2={Y(yMax * f)} stroke="#EEF0F4" />)}
      {[0, 0.5, 1].map((f) => <text key={f} x={4} y={Y(yMax * f) + 4} fontSize="9" fill="#9AA3B2">{Math.round(yMax * f)}y</text>)}
      <path d={area} fill="url(#swg)" /><path d={line} fill="none" stroke={GRAD_FROM} strokeWidth="2" />
      <line x1={X(rec.kwp)} x2={X(rec.kwp)} y1={8} y2={H - pad} stroke={GRAD_TO} strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx={X(rec.kwp)} cy={Y(rec.payback)} r="4" fill={GRAD_TO} />
      <text x={X(rec.kwp)} y={18} fontSize="9.5" fill={GRAD_TO} fontWeight="700" textAnchor="middle">{Math.round(rec.kwp)} kWp · {rec.payback}y</text>
      <text x={W / 2} y={H - 4} fontSize="9" fill="#9AA3B2" textAnchor="middle">system size (kWp) →</text>
    </svg>
  )
}

function MonthlyBars({ gen, load }: { gen: number[]; load: number[] }) {
  const W = 420, H = 180, pad = 26
  const max = Math.max(...gen, ...load, 1)
  const bw = (W - pad - 8) / 12
  const Y = (v: number) => H - pad - (v / max) * (H - pad - 10)
  const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v)))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {MONTH_LABELS.map((m, i) => {
        const x = pad + i * bw
        return (
          <g key={m}>
            <rect x={x + bw * 0.18} y={Y(load[i])} width={bw * 0.3} height={H - pad - Y(load[i])} rx="1.5" fill="#CBD5E1" />
            <rect x={x + bw * 0.52} y={Y(gen[i])} width={bw * 0.3} height={H - pad - Y(gen[i])} rx="1.5" fill={GRAD_FROM} />
            <text x={x + bw / 2} y={H - 8} fontSize="8" fill="#9AA3B2" textAnchor="middle">{m[0]}</text>
          </g>
        )
      })}
      <text x={pad} y={12} fontSize="9" fill="#9AA3B2">peak {fmt(max)} kWh</text>
      <g><rect x={W - 150} y={4} width="9" height="9" rx="2" fill="#CBD5E1" /><text x={W - 138} y={12} fontSize="9" fill="#6b7280">consumption</text><rect x={W - 70} y={4} width="9" height="9" rx="2" fill={GRAD_FROM} /><text x={W - 58} y={12} fontSize="9" fill="#6b7280">solar</text></g>
    </svg>
  )
}

function CashflowChart({ year1, capex, years, inflation, degradation }: { year1: number; capex: number; years: number; inflation: number; degradation: number }) {
  const W = 420, H = 180, pad = 34
  const cum: number[] = []; let c = -capex
  for (let y = 1; y <= years; y++) { c += year1 * Math.pow(1 + inflation, y - 1) * Math.pow(1 - degradation, y - 1); cum.push(c) }
  const all = [-capex, ...cum]
  const min = Math.min(...all), max = Math.max(...all)
  const X = (i: number) => pad + (i / years) * (W - pad - 8)
  const Y = (v: number) => H - 20 - ((v - min) / (max - min || 1)) * (H - 40)
  const line = all.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  const zeroY = Y(0)
  const crossIdx = cum.findIndex((v) => v >= 0)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <line x1={pad} x2={W - 8} y1={zeroY} y2={zeroY} stroke="#CBD5E1" strokeDasharray="3 3" />
      <text x={4} y={zeroY + 3} fontSize="8.5" fill="#9AA3B2">£0</text>
      <path d={`${line} L${X(years)},${zeroY} L${X(0)},${zeroY} Z`} fill={GRAD_FROM} fillOpacity="0.1" />
      <path d={line} fill="none" stroke={GRAD_FROM} strokeWidth="2" />
      {crossIdx >= 0 && <><line x1={X(crossIdx + 1)} x2={X(crossIdx + 1)} y1={8} y2={H - 18} stroke={GRAD_TO} strokeDasharray="3 3" /><text x={X(crossIdx + 1)} y={H - 4} fontSize="9" fill={GRAD_TO} fontWeight="700" textAnchor="middle">payback ~yr {crossIdx + 1}</text></>}
      <text x={W - 8} y={Y(max) + 10} fontSize="9" fill="#0E7C66" textAnchor="end" fontWeight="700">+{money(max, { compact: true })}</text>
    </svg>
  )
}

function Donut({ self, exported }: { self: number; exported: number }) {
  const total = self + exported || 1
  const pct = self / total
  const R = 54, C = 2 * Math.PI * R
  return (
    <div className="flex items-center gap-5 justify-center py-2">
      <svg viewBox="0 0 140 140" width="150" height="150">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#E5E9F0" strokeWidth="18" />
        <circle cx="70" cy="70" r={R} fill="none" stroke={GRAD_FROM} strokeWidth="18" strokeDasharray={`${C * pct} ${C}`} strokeLinecap="round" transform="rotate(-90 70 70)" />
        <text x="70" y="66" fontSize="24" fontWeight="800" fill="#0B1220" textAnchor="middle">{Math.round(pct * 100)}%</text>
        <text x="70" y="84" fontSize="10" fill="#7A8494" textAnchor="middle">self-used</text>
      </svg>
      <div className="flex flex-col gap-2 text-[12.5px]">
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: GRAD_FROM }} /><b>{Math.round(self / 1000)} MWh</b> used on-site</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#E5E9F0]" /><b>{Math.round(exported / 1000)} MWh</b> exported</div>
      </div>
    </div>
  )
}
function Empty() { return <div className="h-[180px] flex items-center justify-center text-[12px] text-muted-2">Not enough data</div> }
