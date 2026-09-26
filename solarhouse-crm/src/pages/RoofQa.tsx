/**
 * Roof QA — the accuracy bench for roof-pane detection.
 *
 * Runs the live detector over a fixed benchmark of real houses (every roof type we meet) plus every saved design,
 * scores each one (lib/roofQa.ts: shape rules, overlaps, gaps, agreement with Google's own roof segments), keeps the
 * previous run so a change to the detector shows up as better or worse house by house, and reads the correction log
 * (what people changed after detection) — the ground truth for tuning and, later, training.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Panel, StatTile } from '../components/ui'
import { Target, Check, Sparkle, Layers } from '../components/icons'
import { useState_ } from '../store/store'
import { auditRoof, correctionDelta, type RoofAudit } from '../lib/roofQa'
import { metricFrame } from '../lib/paneShape'
import { geocodeLocation } from '../lib/commercialFinder'
import type { DesignPlane } from '../store/types'

type Case = { id: string; label: string; kind: string; lat: number; lng: number; designId?: string }

// The fixed benchmark — real houses around the showrooms, chosen to cover the roof types we meet.
const BENCH: Case[] = [
  { id: 'b-semi-gable', label: '10 Cefn Penuel, Cardiff', kind: 'Semi · gable + rear lean-to', lat: 51.5274866, lng: -3.2992451 },
  { id: 'b-terrace', label: '13 Kelston Road, Cardiff', kind: 'Terrace · party walls both sides', lat: 51.51511562857143, lng: -3.225213085714285 },
  { id: 'b-hip-l', label: 'Radyr — detached L-plan', kind: 'Detached · hipped L', lat: 51.499215, lng: -3.233403 },
  { id: 'b-hip-big', label: 'Llandaff — large detached', kind: 'Detached · hipped, extensions', lat: 51.49896, lng: -3.234109 },
  { id: 'b-det-1', label: 'Morganstown — detached', kind: 'Detached · gable + garage', lat: 51.526912, lng: -3.30053 },
  { id: 'b-det-2', label: 'Morganstown — detached 2', kind: 'Detached · cross-gable', lat: 51.524993, lng: -3.300938 },
  { id: 'b-det-3', label: 'Morganstown — detached 3', kind: 'Detached · dormers + rooflights', lat: 51.524797, lng: -3.301053 },
  { id: 'b-cyncoed-1', label: 'Cyncoed — detached', kind: 'Detached · low-pitch hips', lat: 51.507646, lng: -3.164676 },
  { id: 'b-cyncoed-2', label: 'Cyncoed — detached 2', kind: 'Detached · flat + pitched mix', lat: 51.507807, lng: -3.164951 },
  { id: 'b-llandaff-n', label: 'Llandaff North — semi', kind: 'Semi · hipped', lat: 51.50938, lng: -3.250559 },
]

// Every situation the detector has to cope with, what handles it today, and how well.
const SCENARIOS: { s: string; how: string; state: 'ok' | 'part' | 'todo' }[] = [
  { s: 'Simple gable (2 panes)', how: 'Height-model planes, ridge = plane intersection, rectangles enforced', state: 'ok' },
  { s: 'Hipped roof (4 panes, triangles at the ends)', how: 'Plane intersections give the hip lines; 45° directions allowed', state: 'ok' },
  { s: 'L / T plans, valleys', how: 'Per-plane pixel regions; straight edges only where ≥80% is really that pane', state: 'ok' },
  { s: 'Traced noise — extra corners, tiny edges, skew', how: 'Shape rules on every pane (paneShape.ts) + Tidy button / T key', state: 'ok' },
  { s: 'Overlapping or sliver panes', how: 'Final pass cuts overlaps apart; scraps < 2.5 m² or < 1 m wide dropped', state: 'ok' },
  { s: 'Terraces & semis (party walls)', how: 'OSM per-house outline; Google mask cut to the Land Registry title', state: 'ok' },
  { s: 'Wrong house picked', how: 'Rooftop geocode, ≤3 m pin rule, street picker; no guessing', state: 'ok' },
  { s: 'Rear lean-to / conservatory / garage', how: 'Separate plane if ≥ 4 m²; low-pitch panes skipped by Ovi unless asked', state: 'part' },
  { s: 'Dormers', how: 'Detected as their own small planes; small cheeks dropped as slivers', state: 'part' },
  { s: 'Rooflights, chimneys, vents', how: 'Not planes — keep-outs added by hand (auto-detection gave false positives)', state: 'part' },
  { s: 'Existing panels on the roof', how: 'Height model sees them as roof; no automatic flag yet', state: 'todo' },
  { s: 'Trees over the roof', how: 'Tree canopy distorts heights; pitch/azimuth QA flags disagreement with Google', state: 'part' },
  { s: 'Flat roofs', how: '< 6° treated as flat (faces south for racking)', state: 'ok' },
  { s: 'Mansard / curved / very steep (> 52°)', how: 'Steep faces dropped as walls; mansards need hand drawing', state: 'todo' },
  { s: 'New build not in the imagery yet', how: 'No height data → skeleton split from outline at 35° assumed, flagged', state: 'part' },
  { s: 'No Google height data (England)', how: 'Environment Agency LiDAR 1 m fallback', state: 'ok' },
  { s: 'No Google height data (Wales)', how: 'Outline skeleton only, pitch assumed — flagged for survey', state: 'part' },
  { s: 'Photo and height model misaligned', how: 'Checked: Google DSM georeferencing within 8 cm; imagery offset shows in QA overlay', state: 'ok' },
]

const LS = 'roofqa.lastRun'
const readLast = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(LS) || '{}') } catch { return {} } }
const COLS = ['#0E9A82', '#4F46E5', '#D97706', '#DB2777', '#0891B2', '#65A30D', '#7C3AED', '#DC2626', '#0D9488', '#CA8A04', '#2563EB', '#9333EA']
const scoreTone = (s: number) => (s >= 85 ? { bg: '#E7F7F2', fg: '#0E7A66' } : s >= 65 ? { bg: '#FFF7E6', fg: '#92400E' } : { bg: '#FDECEC', fg: '#B42318' })

export function RoofQa() {
  const st = useState_()
  const nav = useNavigate()
  const designs = st.designs ?? []
  const saved: Case[] = useMemo(() => designs.filter((d) => d.center && d.planes.length).map((d) => ({ id: `d-${d.id}`, label: d.name, kind: 'Saved design', lat: d.center!.lat, lng: d.center!.lng, designId: d.id })), [designs])
  const [extra, setExtra] = useState<Case[]>([])
  const cases = [...BENCH, ...saved, ...extra]
  const [results, setResults] = useState<Record<string, RoofAudit>>({})
  const [running, setRunning] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [addr, setAddr] = useState('')
  const [last] = useState(readLast)

  async function runAll(list = cases) {
    const scores: Record<string, number> = { ...readLast() }
    for (const c of list) {
      setRunning(c.id)
      const a = await auditRoof({ lat: c.lat, lng: c.lng })
      scores[c.id] = a.score
      setResults((r) => ({ ...r, [c.id]: a }))
    }
    setRunning(null)
    try { localStorage.setItem(LS, JSON.stringify(scores)) } catch { /* private window */ }
  }
  async function addHouse() {
    const g = await geocodeLocation(addr.trim()); if (!g) return
    const c: Case = { id: `x-${Date.now()}`, label: addr.trim(), kind: 'Added', lat: g.lat, lng: g.lng }
    setExtra((e) => [...e, c]); setAddr(''); runAll([c])
  }

  const done = cases.map((c) => results[c.id]).filter(Boolean) as RoofAudit[]
  const avg = (f: (a: RoofAudit) => number | null) => { const v = done.map(f).filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }
  const gm = done.reduce((s, a) => s + a.googleMatched, 0), gb = done.reduce((s, a) => s + a.googleBig, 0)
  const corrected = designs.filter((d) => d.detected && d.center && d.planes.length)

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Roof QA" crumbs={['Design']} identity={{ icon: Target, accent: '#0E9A82' }}
        actions={<button onClick={() => runAll()} disabled={!!running} className="h-9 px-4 rounded-[10px] text-white text-[13px] font-semibold inline-flex items-center gap-2 disabled:opacity-60" style={{ background: '#15223B' }}><Sparkle size={14} />{running ? `Checking ${done.length + 1} of ${cases.length}…` : done.length ? 'Run again' : `Run all ${cases.length} houses`}</button>} />
      <div className="p-5 flex flex-col gap-5 max-w-[1400px] w-full mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatTile label="Average score" value={avg((a) => a.score)?.toFixed(0) ?? '—'} sub={done.length ? `${done.length} of ${cases.length} houses` : 'not run yet'} icon={Target} />
          <StatTile label="Houses flagged" value={done.length ? String(done.filter((a) => a.flags.some((f) => f.level === 'bad')).length) : '—'} sub="at least one serious flag" icon={Layers} tone="warn" />
          <StatTile label="Corners per pane" value={avg((a) => a.cornersAvg)?.toFixed(1) ?? '—'} sub={done.length ? `worst ${Math.max(...done.map((a) => a.cornersMax))}` : 'rectangles = 4'} icon={Check} />
          <StatTile label="Agrees with Google" value={gb ? `${Math.round((gm / gb) * 100)}%` : '—'} sub={gb ? `${gm} of ${gb} big segments matched` : 'independent check'} icon={Sparkle} />
          <StatTile label="Pitch error" value={avg((a) => a.pitchErr) != null ? `${avg((a) => a.pitchErr)!.toFixed(1)}°` : '—'} sub="vs Google, mean" icon={Target} />
        </div>

        <Panel title="Houses" sub="Benchmark roofs + every saved design. Click a row to see the panes against Google's own segments." icon={Target} pad={false}
          action={<div className="flex items-center gap-2"><input value={addr} onChange={(e) => setAddr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addHouse()} placeholder="Add an address to test…" className="h-8 w-60 px-2.5 rounded-control border border-input-border text-[12.5px] outline-none focus:border-accent" /><button onClick={addHouse} className="h-8 px-3 rounded-control border border-border text-[12px] font-semibold hover:bg-control">Add</button></div>}>
          <table className="w-full text-[12.5px]">
            <thead><tr className="text-left text-muted-3 text-[11px] uppercase tracking-wide border-b border-divider">
              <th className="px-4 py-2 font-semibold">House</th><th className="px-2 font-semibold">Score</th><th className="px-2 font-semibold">Panes</th><th className="px-2 font-semibold">Corners</th>
              <th className="px-2 font-semibold">Overlap</th><th className="px-2 font-semibold">Gaps</th><th className="px-2 font-semibold">Google</th><th className="px-2 font-semibold">Pitch Δ</th><th className="px-4 font-semibold">Flags</th>
            </tr></thead>
            <tbody>
              {cases.map((c) => {
                const a = results[c.id], prev = last[c.id], tone = a ? scoreTone(a.score) : null
                return [
                  <tr key={c.id} onClick={() => a && setOpen(open === c.id ? null : c.id)} className={`border-b border-divider ${a ? 'cursor-pointer hover:bg-control/40' : ''} ${open === c.id ? 'bg-accent-wash' : ''}`}>
                    <td className="px-4 py-2.5"><div className="font-semibold text-ink-2">{c.label}</div><div className="text-[11px] text-muted-b">{c.kind}</div></td>
                    <td className="px-2">{running === c.id ? <span className="text-muted-b">checking…</span> : a ? <span className="inline-flex items-center gap-1.5"><span className="px-2 py-0.5 rounded-full text-[12px] font-bold" style={{ background: tone!.bg, color: tone!.fg }}>{a.score}</span>{prev != null && prev !== a.score && <span className={`text-[11px] font-semibold ${a.score > prev ? 'text-[#0E7A66]' : 'text-[#B42318]'}`}>{a.score > prev ? '▲' : '▼'}{Math.abs(a.score - prev)}</span>}</span> : <span className="text-muted-3">{prev != null ? `last ${prev}` : '—'}</span>}</td>
                    <td className="px-2">{a ? a.panes : ''}</td>
                    <td className="px-2">{a ? `${a.cornersAvg.toFixed(1)} · max ${a.cornersMax}` : ''}</td>
                    <td className="px-2">{a ? `${a.overlapM2.toFixed(1)} m²` : ''}</td>
                    <td className="px-2">{a ? `${Math.round(a.gapPct)}%` : ''}</td>
                    <td className="px-2">{a ? (a.googleBig ? `${a.googleMatched}/${a.googleBig}` : 'n/a') : ''}</td>
                    <td className="px-2">{a && a.pitchErr != null ? `${a.pitchErr.toFixed(1)}°` : ''}</td>
                    <td className="px-4 py-2 text-[11.5px]">{a ? (a.flags.length ? a.flags.map((f, i) => <div key={i} className={f.level === 'bad' ? 'text-[#B42318]' : 'text-[#92400E]'}>{f.text}</div>) : <span className="text-[#0E7A66] font-semibold">Clean</span>) : ''}</td>
                  </tr>,
                  open === c.id && a ? <tr key={c.id + '-x'} className="border-b border-divider bg-[#FAFBFC]"><td colSpan={9} className="px-4 py-4"><AuditView a={a} onOpen={c.designId ? () => nav(`/design/${c.designId}`) : undefined} /></td></tr> : null,
                ]
              })}
            </tbody>
          </table>
        </Panel>

        <div className="grid lg:grid-cols-2 gap-5">
          <Panel title="Correction log" sub="What people changed after detection — the ground truth that tunes the detector" icon={Check}>
            {corrected.length === 0 ? <div className="text-[12.5px] text-muted-b">No corrected designs yet. Every detection from now on is saved with the design, so each face someone moves, adds or deletes becomes a measured correction here.</div> : (
              <table className="w-full text-[12.5px]"><thead><tr className="text-left text-muted-3 text-[11px] uppercase tracking-wide"><th className="py-1.5">Design</th><th>Panes</th><th>Removed</th><th>Added</th><th>Corner shift</th><th>Pitch edits</th></tr></thead>
                <tbody>{corrected.map((d) => { const x = correctionDelta(d.detected!.planes as DesignPlane[], d.planes, d.center!); return (
                  <tr key={d.id} className="border-t border-divider cursor-pointer hover:bg-control/40" onClick={() => nav(`/design/${d.id}`)}><td className="py-2 font-semibold text-ink-2">{d.name}</td><td>{d.detected!.planes.length} → {d.planes.length}</td><td>{x.removed}</td><td>{x.added}</td><td>{x.medianCornerShiftM.toFixed(2)} m <span className="text-muted-3">(max {x.maxCornerShiftM.toFixed(1)})</span></td><td>{x.pitchChanged}</td></tr>) })}</tbody></table>
            )}
          </Panel>
          <Panel title="Scenarios" sub="Every roof situation the detector has to handle, and where it stands" icon={Layers}>
            <div className="flex flex-col divide-y divide-divider">
              {SCENARIOS.map((x) => (
                <div key={x.s} className="py-2 flex items-start gap-2.5">
                  <span className={`mt-0.5 shrink-0 px-1.5 py-0.5 rounded-[5px] text-[10px] font-bold uppercase ${x.state === 'ok' ? 'bg-[#E7F7F2] text-[#0E7A66]' : x.state === 'part' ? 'bg-[#FFF7E6] text-[#92400E]' : 'bg-[#EEF1F5] text-muted-b'}`}>{x.state === 'ok' ? 'Handled' : x.state === 'part' ? 'Partly' : 'Not yet'}</span>
                  <div className="min-w-0"><div className="text-[12.5px] font-semibold text-ink-2">{x.s}</div><div className="text-[11.5px] text-muted-b leading-snug">{x.how}</div></div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

/** Plan view of one audit: outline (dashed), our panes (coloured, with pitch/facing), Google's segment centres
 *  (black dots with a facing tick) — so a disagreement is visible at a glance. */
function AuditView({ a, onOpen }: { a: RoofAudit; onOpen?: () => void }) {
  const f = metricFrame(a.center)
  const rings = a.planes.map((p) => p.polygon.map(f.toXY)), out = a.outline.map(f.toXY)
  const pts = [...rings.flat(), ...out]
  if (!pts.length) return <div className="text-[12.5px] text-muted-b">{a.message}</div>
  const x0 = Math.min(...pts.map((p) => p.x)) - 2, x1 = Math.max(...pts.map((p) => p.x)) + 2, y0 = Math.min(...pts.map((p) => p.y)) - 2, y1 = Math.max(...pts.map((p) => p.y)) + 2
  const S = 340 / Math.max(x1 - x0, y1 - y0), P = (p: { x: number; y: number }) => `${((p.x - x0) * S).toFixed(1)},${((y1 - p.y) * S).toFixed(1)}`
  return (
    <div className="flex gap-6 items-start flex-wrap">
      <svg width={(x1 - x0) * S} height={(y1 - y0) * S} className="rounded-[10px] bg-white border border-border shrink-0">
        {out.length > 2 && <polygon points={out.map(P).join(' ')} fill="none" stroke="#15223B" strokeDasharray="5 4" strokeWidth={1.5} />}
        {rings.map((r, i) => <polygon key={i} points={r.map(P).join(' ')} fill={COLS[i % COLS.length]} fillOpacity={0.22} stroke={COLS[i % COLS.length]} strokeWidth={1.6} />)}
        {rings.map((r, i) => { const c = { x: r.reduce((s, q) => s + q.x, 0) / r.length, y: r.reduce((s, q) => s + q.y, 0) / r.length }; const [px, py] = P(c).split(',').map(Number); return <text key={'t' + i} x={px} y={py} fontSize={10} fontWeight={700} textAnchor="middle" fill="#15223B">{a.planes[i].pitchDeg}°·{Math.round(a.planes[i].azimuthDeg)}</text> })}
        {a.google.filter((s) => s.center && s.groundAreaM2 >= 5).map((s, i) => { const c = f.toXY(s.center!); const [px, py] = P(c).split(',').map(Number); const r = (s.azimuthDeg * Math.PI) / 180; return <g key={'g' + i}><circle cx={px} cy={py} r={3.5} fill="#15223B" /><line x1={px} y1={py} x2={px + Math.sin(r) * 14} y2={py - Math.cos(r) * 14} stroke="#15223B" strokeWidth={1.5} /></g> })}
      </svg>
      <div className="flex-1 min-w-[260px] text-[12.5px] flex flex-col gap-2">
        <div className="text-muted-b">{a.message} · {a.ms} ms</div>
        <div><b>Google's segments</b> (dots, tick = facing): {a.google.filter((s) => s.groundAreaM2 >= 5).map((s) => `${Math.round(s.pitchDeg)}°/${Math.round(s.azimuthDeg)}° ${Math.round(s.groundAreaM2)} m²`).join(' · ') || 'none returned'}</div>
        <div><b>Ours:</b> {a.planes.map((p) => `${p.pitchDeg}°/${Math.round(p.azimuthDeg)}° ${p.areaM2} m² (${p.polygon.length} corners)`).join(' · ')}</div>
        {onOpen && <button onClick={onOpen} className="self-start h-8 px-3 rounded-control border border-border text-[12px] font-semibold hover:bg-control">Open the design</button>}
      </div>
    </div>
  )
}
