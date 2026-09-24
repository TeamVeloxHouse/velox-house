import { useEffect, useMemo, useState } from 'react'
import { Segmented, Kpi, Panel } from './ui'
import { MonthColumns, DataTable, Legend, C } from './charts'
import { Sun, Bolt, Home, Pie, Plus, Target } from './icons'
import { useActions } from '../store/store'
import type { Design, DesignPlane } from '../store/types'
import { moduleById } from '../lib/panels'
import { mcsEstimate, resolveArrays, shadeFactor, obstructionFrom, OCCUPANCY_LABEL, KK_SOURCE_LABEL, type Occupancy, type McsResult, type Obstruction, type Segment } from '../lib/mcs'
import { classNames } from '../lib/format'

/* Production tab — the MCS-style estimate the customer's proposal is built on: per-array kWp × Kk × SF,
 * the sun-path diagram behind each shade factor, and self-consumption by occupancy. */

const DEG = Math.PI / 180
const mLng = (lat: number) => 111320 * Math.cos(lat * DEG)
const centroid = (ring: { lat: number; lng: number }[]) => ring.reduce((a, v) => ({ lat: a.lat + v.lat / ring.length, lng: a.lng + v.lng / ring.length }), { lat: 0, lng: 0 })
const OBST_HEIGHT: Record<string, number> = { chimney: 1.2, hvac: 0.8, skylight: 0, keepout: 0 }
const toSouth = (fromNorth: number) => ((fromNorth - 180 + 540) % 360) - 180

/** Everything that can shade this plane: roof obstacles (chimneys, plant) and the design's horizon list. */
function obstructionsFor(p: DesignPlane, design: Design): Obstruction[] {
  const c = centroid(p.polygon)
  const out: Obstruction[] = []
  for (const o of design.obstacles ?? []) {
    const h = o.heightM ?? OBST_HEIGHT[o.kind] ?? 0
    if (h <= 0.05) continue
    const oc = centroid(o.polygon)
    const dE = (oc.lng - c.lng) * mLng(c.lat), dN = (oc.lat - c.lat) * 110540
    const dist = Math.hypot(dE, dN)
    const xs = o.polygon.map((v) => (v.lng - oc.lng) * mLng(c.lat)), ys = o.polygon.map((v) => (v.lat - oc.lat) * 110540)
    const width = Math.max(0.5, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)))
    out.push(obstructionFrom(toSouth(Math.atan2(dE, dN) / DEG), width, dist, h, o.kind))
  }
  for (const hz of design.horizon ?? []) out.push(obstructionFrom(toSouth(hz.bearingDeg), hz.widthM, hz.distanceM, hz.heightM, hz.label))
  return out
}

export function SunpathDiagram({ segments, title }: { segments: (Segment & { shaded: boolean })[]; title?: string }) {
  // azimuth −135…+135 (east ← south → west), altitude 0…75
  const W = 300, H = 150, x = (az: number) => ((az + 135) / 270) * W, y = (alt: number) => H - (alt / 75) * H
  return (
    <div>
      {title && <div className="text-[12px] font-bold text-ink-2 mb-1.5">{title}</div>}
      <svg viewBox={`-26 -6 ${W + 32} ${H + 24}`} className="w-full h-auto">
        {[0, 15, 30, 45, 60, 75].map((a) => <g key={a}><line x1={0} x2={W} y1={y(a)} y2={y(a)} stroke="#EEF1F5" /><text x={-6} y={y(a) + 3} fontSize="8" textAnchor="end" fill="#98A1B0">{a}°</text></g>)}
        {[-135, -90, -45, 0, 45, 90, 135].map((a) => <g key={a}><line y1={0} y2={H} x1={x(a)} x2={x(a)} stroke="#EEF1F5" /><text x={x(a)} y={H + 11} fontSize="8" textAnchor="middle" fill="#98A1B0">{a === 0 ? 'S' : a === -90 ? 'E' : a === 90 ? 'W' : a}</text></g>)}
        {segments.map((s, i) => (
          <rect key={i} x={x(s.az0) + 0.6} y={y(Math.min(75, s.alt1)) + 0.6} width={x(s.az1) - x(s.az0) - 1.2} height={y(s.alt0) - y(Math.min(75, s.alt1)) - 1.2} rx={1.5}
            fill={s.shaded ? '#15223B' : '#62E4CC'} fillOpacity={s.shaded ? 0.9 : Math.min(0.85, 0.18 + s.weight / 3)}>
            <title>{`${s.az0}° to ${s.az1}° · ${s.alt0}–${s.alt1}° up · ${s.weight.toFixed(1)}% of the year's sun${s.shaded ? ' · SHADED' : ''}`}</title>
          </rect>
        ))}
      </svg>
    </div>
  )
}

/** The MCS estimate for the placed panels, plus the per-kWp yield (Kk × SF) of every roof plane — the
 *  Production tab, Savings tab and optimiser all read from this one hook. */
export function useMcs(design: Design, moduleId: string, effTilt: (p: DesignPlane) => number) {
  const [res, setRes] = useState<McsResult | null>(null)
  const [planeYield, setPlaneYield] = useState<Record<string, number>>({})
  const occ = (design.occupancy ?? 'in_half_day') as Occupancy
  const use = design.annualConsumptionKwh ?? 3800
  const batt = design.batteryKwh ?? 0
  const filled = design.planes.filter((p) => p.panels?.length)
  const lat = design.center?.lat ?? 51.5
  const shade = useMemo(() => Object.fromEntries(design.planes.map((p) => [p.id, shadeFactor(lat, obstructionsFor(p, design))])), [design, lat]) // eslint-disable-line react-hooks/exhaustive-deps
  const postcode = design.address.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i)?.[0]
  const sfOf = (id: string) => design.shadeOverrides?.[id] ?? shade[id]?.sf ?? 1

  useEffect(() => {
    if (!design.center) { setRes(null); return }
    let live = true
    const site = { ...design.center, postcode }
    if (filled.length) mcsEstimate({
      arrays: filled.map((p, i) => ({ id: p.id, name: p.name || `Array ${i + 1}`, kwp: ((p.panels?.length ?? 0) * moduleById(p.moduleId ?? moduleId).watts) / 1000, tiltDeg: effTilt(p), azimuthFromSouthDeg: toSouth(p.azimuthDeg), shadeFactor: sfOf(p.id) })),
      site, useKwh: use, occupancy: occ, batteryUsableKwh: batt,
    }).then((r) => { if (live) setRes(r) })
    else setRes(null)
    if (design.planes.length) resolveArrays(design.planes.map((p) => ({ id: p.id, kwp: 1, tiltDeg: effTilt(p), azimuthFromSouthDeg: toSouth(p.azimuthDeg), shadeFactor: sfOf(p.id) })), site)
      .then((r) => { if (live) setPlaneYield(Object.fromEntries(r.arrays.map((a) => [a.id, a.kwh]))) })
    return () => { live = false }
  }, [design, moduleId, shade, use, occ, batt]) // eslint-disable-line react-hooks/exhaustive-deps
  return { res, planeYield, shade, filled, occ, use, batt, sfOf }
}

export function McsProduction({ design, moduleId, effTilt }: { design: Design; moduleId: string; effTilt: (p: DesignPlane) => number }) {
  const act = useActions()
  const [newHz, setNewHz] = useState({ label: 'Tree', bearing: 'S', distance: '8', height: '6', width: '4' })
  const { res, shade, filled, occ, use, batt } = useMcs(design, moduleId, effTilt)

  const COMPASS: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 }
  const addHorizon = () => {
    const hz = { id: `hz${Date.now()}`, label: newHz.label || 'Obstruction', bearingDeg: COMPASS[newHz.bearing] ?? 180, distanceM: Number(newHz.distance) || 8, heightM: Number(newHz.height) || 5, widthM: Number(newHz.width) || 4 }
    act.updateDesign(design.id, { horizon: [...(design.horizon ?? []), hz] })
  }
  if (!filled.length) return <div className="absolute inset-0 flex items-center justify-center text-[13px] text-muted-b">No panels placed yet — run <b className="mx-1">Ovi auto-layout</b> or use the Build tool.</div>

  return (
    <div className="absolute inset-0 overflow-y-auto px-5 py-5">
      <div className="max-w-[1100px] mx-auto flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-3">
          <Kpi variant="navy" icon={Sun} label="Annual generation" value={res ? `${res.annualKwh.toLocaleString()} kWh` : '…'} delta={res ? KK_SOURCE_LABEL[res.source] : 'calculating'} />
          <Kpi icon={Bolt} label="Used in the home" value={res ? `${res.selfKwh.toLocaleString()} kWh` : '…'} delta={res ? `${Math.round(res.selfConsumptionRate * 100)}% of generation` : ''} deltaTone="muted" />
          <Kpi icon={Home} label="Self-sufficiency" value={res ? `${Math.round(res.selfSufficiency * 100)}%` : '…'} meter={res ? res.selfSufficiency * 100 : 0} delta={`of ${use.toLocaleString()} kWh used a year`} deltaTone="muted" />
          <Kpi variant="teal" icon={Target} label="Exported" value={res ? `${res.exportKwh.toLocaleString()} kWh` : '…'} delta="paid under the Smart Export Guarantee" />
        </div>

        <Panel title="How it's calculated" sub="Annual output = kWp × Kk (yield for this location, tilt and orientation) × SF (shade factor)" icon={Pie}
          action={<div className="flex items-center gap-2">
            <Segmented options={Object.values(OCCUPANCY_LABEL)} value={OCCUPANCY_LABEL[occ]} onChange={(v) => act.updateDesign(design.id, { occupancy: (Object.keys(OCCUPANCY_LABEL) as Occupancy[]).find((k) => OCCUPANCY_LABEL[k] === v) })} />
          </div>}>
          <div className="flex items-center gap-4 mb-3 text-[12.5px] text-ink-3 flex-wrap">
            <label className="flex items-center gap-2">Annual usage <input type="number" value={use} onChange={(e) => act.updateDesign(design.id, { annualConsumptionKwh: Number(e.target.value) || 0 })} className="w-24 h-8 px-2 rounded-[8px] border border-[#E1E6EC] text-[13px] font-semibold" /> kWh</label>
            <label className="flex items-center gap-2">Battery (usable) <input type="number" value={batt} onChange={(e) => act.updateDesign(design.id, { batteryKwh: Number(e.target.value) || 0 })} className="w-20 h-8 px-2 rounded-[8px] border border-[#E1E6EC] text-[13px] font-semibold" /> kWh</label>
            {res?.zone && <span>MCS zone <b className="text-ink">{res.zone}</b></span>}
            {res && res.source !== 'mcs' && <span className="text-[11.5px] text-muted-b">Official MCS tables not loaded — figures are an estimate from {res.source === 'pvgis' ? 'PVGIS' : 'our offline model'}.</span>}
          </div>
          <DataTable
            cols={[{ label: 'Array', w: 'minmax(120px,1.3fr)' }, { label: 'Tilt', align: 'right' }, { label: 'Azimuth from S', align: 'right' }, { label: 'DC power', align: 'right' }, { label: 'Kk (kWh/kWp)', align: 'right' }, { label: 'Shade factor', align: 'right' }, { label: 'Annual kWh', align: 'right' }]}
            rows={(res?.arrays ?? []).map((a) => [
              <b key="n">{a.name}</b>, `${Math.round(a.tiltDeg)}°`, `${Math.round(a.azimuthFromSouthDeg)}°`, `${a.kwp.toFixed(2)} kWp`, a.kk,
              <input key="sf" type="number" step="0.01" min="0" max="1" value={design.shadeOverrides?.[a.id] ?? a.sf} onChange={(e) => act.updateDesign(design.id, { shadeOverrides: { ...(design.shadeOverrides ?? {}), [a.id]: Math.max(0, Math.min(1, Number(e.target.value))) } })} className="w-16 h-7 px-1.5 text-right rounded-[6px] border border-[#E1E6EC] text-[12px] font-semibold" />,
              <b key="k">{a.kwh.toLocaleString()}</b>,
            ])}
            foot={['Total', '', '', `${(res?.arrays ?? []).reduce((s, a) => s + a.kwp, 0).toFixed(2)} kWp`, '', '', `${(res?.annualKwh ?? 0).toLocaleString()} kWh`]}
          />
        </Panel>

        <div className="grid grid-cols-[1.2fr_1fr] gap-4">
          <Panel title="Monthly generation" sub="The annual figure spread by this location's monthly sunlight" icon={Sun}>
            <div className="mb-2"><Legend items={[{ label: 'kWh per month', swatch: C.actual }]} /></div>
            <MonthColumns data={(res?.monthlyKwh ?? Array(12).fill(0)).map((v, i) => ({ label: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i], value: v, sub: `${Math.round(v / [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][i])} kWh a day on average` }))} fmt={(n) => `${Math.round(n)}`} height={190} />
          </Panel>
          <Panel title="Shading — obstructions" sub="Trees and buildings around the roof; chimneys and plant on it come from the design" icon={Plus}>
            <div className="flex flex-col gap-1.5 mb-3">
              {(design.horizon ?? []).map((h) => (
                <div key={h.id} className="flex items-center gap-2 text-[12.5px] rounded-[8px] bg-[#F7F9FB] border border-[#EEF1F5] px-2.5 py-1.5">
                  <b className="text-ink">{h.label}</b><span className="text-muted-b">{h.heightM} m tall · {h.distanceM} m away · {h.widthM} m wide · {Object.entries(COMPASS).find(([, v]) => v === h.bearingDeg)?.[0] ?? `${h.bearingDeg}°`}</span>
                  <button onClick={() => act.updateDesign(design.id, { horizon: (design.horizon ?? []).filter((x) => x.id !== h.id) })} className="ml-auto text-muted-3 hover:text-ink">✕</button>
                </div>
              ))}
              {!(design.horizon ?? []).length && <div className="text-[12px] text-muted-2">No off-roof obstructions added.</div>}
            </div>
            <div className="grid grid-cols-[1fr_70px_60px_60px_60px_auto] gap-1.5 items-center">
              <input value={newHz.label} onChange={(e) => setNewHz({ ...newHz, label: e.target.value })} placeholder="Tree / building" className="h-8 px-2 rounded-[8px] border border-[#E1E6EC] text-[12.5px]" />
              <select value={newHz.bearing} onChange={(e) => setNewHz({ ...newHz, bearing: e.target.value })} className="h-8 px-1 rounded-[8px] border border-[#E1E6EC] text-[12.5px]">{Object.keys(COMPASS).map((k) => <option key={k}>{k}</option>)}</select>
              <input value={newHz.distance} onChange={(e) => setNewHz({ ...newHz, distance: e.target.value })} title="Distance (m)" className="h-8 px-2 rounded-[8px] border border-[#E1E6EC] text-[12.5px]" />
              <input value={newHz.height} onChange={(e) => setNewHz({ ...newHz, height: e.target.value })} title="Height above the panels (m)" className="h-8 px-2 rounded-[8px] border border-[#E1E6EC] text-[12.5px]" />
              <input value={newHz.width} onChange={(e) => setNewHz({ ...newHz, width: e.target.value })} title="Width (m)" className="h-8 px-2 rounded-[8px] border border-[#E1E6EC] text-[12.5px]" />
              <button onClick={addHorizon} className="h-8 px-3 rounded-[8px] bg-[#15223B] text-white text-[12px] font-semibold">Add</button>
            </div>
            <div className="text-[10.5px] text-muted-3 mt-1">Direction · distance m · height above panels m · width m</div>
          </Panel>
        </div>

        <Panel title="Sun-path diagrams" sub="Each block is the share of the year's sun from that part of the sky — navy blocks are blocked by an obstruction and come off the shade factor" icon={Sun}>
          <div className="grid grid-cols-2 gap-5">
            {filled.map((p, i) => (
              <div key={p.id}>
                <SunpathDiagram segments={shade[p.id]?.segments ?? []} title={`${p.name || `Array ${i + 1}`} · shade factor ${(design.shadeOverrides?.[p.id] ?? shade[p.id]?.sf ?? 1).toFixed(2)}`} />
              </div>
            ))}
          </div>
          <div className="mt-2"><Legend items={[{ label: 'Sun (brighter = more of the year)', swatch: '#62E4CC' }, { label: 'Blocked', swatch: '#15223B' }]} /></div>
        </Panel>
        <div className={classNames('text-[11.5px] text-muted-b')}>Figures follow the MCS method (kWp × Kk × shade factor; self-consumption by occupancy). The estimate is guidance for the first year and isn't a guarantee of performance.</div>
      </div>
    </div>
  )
}
