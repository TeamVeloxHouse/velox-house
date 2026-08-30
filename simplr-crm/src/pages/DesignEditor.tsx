import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import { TopBar } from '../components/TopBar'
import { Button } from '../components/ui'
import { Sun, Radar, Check, Person, Layers, Target, Sparkle, Plus, Grid, Wrench } from '../components/icons'
import { useActions, useState_ } from '../store/store'
import { geocodeLocation } from '../lib/commercialFinder'
import { detectPlanes, slopedAreaM2, totalRoofArea, compass, polygonAreaM2 } from '../lib/design'
import { MODULES, moduleById, autoPackPlane, packPlane, kwpOf } from '../lib/panels'
import { Design3D } from '../components/Design3D'
import type { DesignPlane, PanelOrientation } from '../store/types'

type LatLng = { lat: number; lng: number }
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`

export function DesignEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const act = useActions()
  const { designs } = useState_()
  const design = designs.find((d) => d.id === id)

  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const planeLayer = useRef<L.LayerGroup | null>(null)
  const panelLayer = useRef<L.LayerGroup | null>(null)
  const panelRenderer = useRef<L.Canvas | null>(null)
  const designRef = useRef(design)
  designRef.current = design

  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [selId, setSelId] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [moduleId, setModuleId] = useState('m440')
  const [view, setView] = useState<'2d' | '3d'>('2d')
  const module = moduleById(moduleId)

  // ── Map init (once) ──
  useEffect(() => {
    if (map.current || !mapEl.current) return
    const m = L.map(mapEl.current, { center: [52.6, -1.9], zoom: 6, zoomControl: true })
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 21, maxNativeZoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' }).addTo(m)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom: 21, maxNativeZoom: 19, opacity: 0.9 }).addTo(m)
    panelRenderer.current = L.canvas({ padding: 0.5 })
    panelLayer.current = L.layerGroup().addTo(m)
    planeLayer.current = L.layerGroup().addTo(m)
    m.pm.setGlobalOptions({ snappable: true, snapDistance: 12 })
    m.pm.setPathOptions({ color: '#00E5FF', fillColor: '#22E0FF', fillOpacity: 0.24 })
    m.on('pm:create', (e: any) => {
      const ring = (e.layer.getLatLngs()[0] as L.LatLng[]).map((p) => ({ lat: p.lat, lng: p.lng }))
      e.layer.remove()
      addManualPlane(ring)
      m.pm.disableDraw(); setDrawing(false)
    })
    map.current = m
    setTimeout(() => m.invalidateSize(), 120)
    return () => { m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Centre on the design; auto-detect the first time if empty ──
  useEffect(() => {
    if (!map.current || !design) return
    ;(async () => {
      let c = design.center
      if (!c && design.address) { const g = await geocodeLocation(design.address); if (g) { c = { lat: g.lat, lng: g.lng }; act.updateDesign(design.id, { center: c }) } }
      if (c) map.current!.setView([c.lat, c.lng], 19)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design?.id])

  // ── Redraw planes + panels whenever they change ──
  useEffect(() => {
    const lyr = planeLayer.current, pl = panelLayer.current
    if (!lyr || !pl || !map.current || !design) return
    lyr.clearLayers(); pl.clearLayers()
    design.planes.forEach((p) => {
      const on = p.id === selId
      const ring = p.polygon.map((v) => [v.lat, v.lng]) as [number, number][]
      L.polygon(ring, { pmIgnore: true, color: '#0A1B2B', weight: 6, opacity: 0.4, fill: false } as any).addTo(lyr)
      const poly = L.polygon(ring, { color: on ? '#A97BF3' : '#00E5FF', weight: on ? 4 : 2.5, fillColor: on ? '#7C3AED' : '#22E0FF', fillOpacity: p.panels?.length ? 0.06 : (on ? 0.28 : 0.2) })
      ;(poly as any)._planeId = p.id
      poly.on('click', (e) => { L.DomEvent.stopPropagation(e); setSelId(p.id) })
      poly.on('pm:edit', () => syncGeometry(p.id, poly))
      poly.bindTooltip(`${compass(p.azimuthDeg)} · ${p.pitchDeg}° · ${p.panels?.length ? `${p.panels.length} panels` : `${p.areaM2} m²`}`, { permanent: true, direction: 'center', className: 'roof-label' })
      poly.addTo(lyr)
      // panels
      p.panels?.forEach((pn) => {
        L.polygon(pn.corners.map((v) => [v.lat, v.lng]) as [number, number][], { pmIgnore: true, renderer: panelRenderer.current!, color: '#0A2A5E', weight: 0.6, fillColor: '#1E3A8A', fillOpacity: 0.9 } as any).addTo(pl)
      })
    })
    if (design.planes.length && !editing && !drawing) {
      const all = design.planes.flatMap((p) => p.polygon.map((v) => [v.lat, v.lng] as [number, number]))
      try { map.current.fitBounds(L.latLngBounds(all).pad(0.3), { maxZoom: 20, animate: false }) } catch { /* single point */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design?.planes, selId])

  // ── Actions ──
  async function runDetect(center?: LatLng) {
    if (!design || busy) return
    setBusy(true); setStatus('Measuring the roof from satellite…')
    try {
      const { planes, center: c, measured } = await detectPlanes(design.address, center || design.center)
      act.updateDesign(design.id, { planes: [...planes, ...design.planes], center: c || design.center })
      if (c && map.current) map.current.setView([c.lat, c.lng], 19)
      if (!planes.length) act.toast('No roof planes found here — draw them by hand instead', 'warning')
      else act.toast(`${planes.length} plane${planes.length === 1 ? '' : 's'} detected${measured ? '' : ' (estimated)'} — refine or draw the real roof`)
    } catch { act.toast('Could not measure this roof', 'warning') } finally { setBusy(false); setStatus('') }
  }
  function addManualPlane(ring: LatLng[]) {
    const d = designRef.current; if (!d) return
    const plane: DesignPlane = { id: uid('pl'), name: `Roof plane ${d.planes.length + 1}`, polygon: ring, pitchDeg: 5, azimuthDeg: 180, areaM2: Math.round(polygonAreaM2(ring)), source: 'manual' }
    act.updateDesign(d.id, { planes: [...d.planes, plane] })
    setSelId(plane.id)
  }
  function syncGeometry(pid: string, poly: L.Polygon) {
    const d = designRef.current; if (!d) return
    const ring = (poly.getLatLngs()[0] as L.LatLng[]).map((p) => ({ lat: p.lat, lng: p.lng }))
    act.updateDesign(d.id, { planes: d.planes.map((p) => (p.id === pid ? { ...p, polygon: ring, areaM2: Math.round(polygonAreaM2(ring)), panels: [] } : p)) })
  }
  function deletePlane(pid: string) {
    if (!design) return
    act.updateDesign(design.id, { planes: design.planes.filter((p) => p.id !== pid) })
    if (selId === pid) setSelId(null)
  }
  function updatePlane(pid: string, patch: Partial<DesignPlane>) {
    if (!design) return
    act.updateDesign(design.id, { planes: design.planes.map((p) => (p.id === pid ? { ...p, ...patch } : p)) })
  }
  function fillPlane(pid: string) {
    const d = designRef.current; if (!d) return
    const planes = d.planes.map((p) => {
      if (p.id !== pid) return p
      const { panels, orientation } = autoPackPlane(p, module, d.setbackM)
      return { ...p, panels, orientation, moduleId }
    })
    commitSnapshot(planes)
  }
  function clearPlane(pid: string) {
    const d = designRef.current; if (!d) return
    commitSnapshot(d.planes.map((p) => (p.id === pid ? { ...p, panels: [] } : p)))
  }
  function aiLayout() {
    const d = designRef.current; if (!d || !d.planes.length) { act.toast('Draw or detect a roof plane first', 'warning'); return }
    setBusy(true); setStatus('Ovi is laying out the optimal array…')
    setTimeout(() => {
      const planes = d.planes.map((p) => {
        const { panels, orientation } = autoPackPlane(p, module, d.setbackM)
        return { ...p, panels, orientation, moduleId }
      })
      commitSnapshot(planes)
      const total = planes.reduce((s, p) => s + (p.panels?.length ?? 0), 0)
      setBusy(false); setStatus('')
      act.toast(total ? `Ovi placed ${total} panels — ${kwpOf(total, module.watts)} kWp` : 'No room for panels on these planes', total ? 'positive' : 'warning')
    }, 650)
  }
  function commitSnapshot(planes: DesignPlane[]) {
    const total = planes.reduce((s, p) => s + (p.panels?.length ?? 0), 0)
    act.updateDesign(designRef.current!.id, { planes, panels: total, systemKwp: kwpOf(total, module.watts) })
  }
  function toggleDraw() {
    const m = map.current; if (!m) return
    if (editing) toggleEdit()
    if (drawing) { m.pm.disableDraw(); setDrawing(false) }
    else { m.pm.enableDraw('Polygon', { snappable: true }); setDrawing(true) }
  }
  function toggleEdit() {
    const m = map.current; if (!m) return
    if (drawing) { m.pm.disableDraw(); setDrawing(false) }
    if (editing) { m.pm.disableGlobalEditMode(); setEditing(false) }
    else { m.pm.enableGlobalEditMode({ allowSelfIntersection: false }); setEditing(true) }
  }

  if (!design) return (<><TopBar title="Design" crumbs={['Design']} /><PageMissing onBack={() => nav('/design')} /></>)

  const roofArea = totalRoofArea(design.planes)
  const totalPanels = design.planes.reduce((s, p) => s + (p.panels?.length ?? 0), 0)
  const kwp = kwpOf(totalPanels, module.watts)

  return (
    <>
      <TopBar title={design.name} crumbs={['Design', 'Studio']}
        actions={<div className="flex items-center gap-2">
          <Button variant="secondary" icon={<Radar size={15} />} onClick={() => runDetect()} className={busy ? 'opacity-60 pointer-events-none' : ''}>{busy ? 'Working…' : 'Detect roof'}</Button>
          <Button variant="primary" icon={<Sparkle size={15} />} onClick={aiLayout} className={busy ? 'opacity-60 pointer-events-none' : ''}>AI auto-layout</Button>
          <Button variant={design.status === 'confirmed' ? 'secondary' : 'secondary'} icon={<Check size={15} />} onClick={() => act.updateDesign(design.id, { status: design.status === 'confirmed' ? 'draft' : 'confirmed' })}>{design.status === 'confirmed' ? 'Confirmed' : 'Confirm'}</Button>
        </div>} />
      <div className="flex-1 min-h-0 flex gap-4 px-5 pb-5">
        {/* Canvas */}
        <div className="relative flex-1 min-h-0 rounded-card overflow-hidden border border-border">
          <div ref={mapEl} className="absolute inset-0" style={{ background: '#0b1220' }} />
          {view === '3d' && <Design3D design={design} />}
          {/* Draw toolbar (2D only) */}
          {view === '2d' && (
            <div className="absolute top-3 left-3 z-[500] flex items-center gap-1.5 bg-white/95 backdrop-blur border border-border rounded-control shadow-modal p-1">
              <ToolBtn on={drawing} onClick={toggleDraw} icon={<Plus size={15} />} label="Draw plane" />
              <ToolBtn on={editing} onClick={toggleEdit} icon={<Wrench size={14} />} label="Edit" />
            </div>
          )}
          {/* 2D / 3D toggle */}
          <div className="absolute top-3 right-3 z-[550] flex items-center bg-white/95 backdrop-blur border border-border rounded-control shadow-modal p-1">
            {(['2d', '3d'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`h-8 px-3 rounded-[8px] text-[12.5px] font-bold ${view === v ? 'text-white' : 'text-ink-3 hover:bg-control'}`} style={view === v ? { background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' } : undefined}>{v.toUpperCase()}</button>
            ))}
          </div>
          {busy && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] h-9 px-4 rounded-full bg-black/75 text-white text-[12.5px] font-semibold flex items-center gap-2 shadow-modal"><span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />{status}</div>
          )}
          {drawing && !busy && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] h-9 px-4 rounded-full bg-accent text-white text-[12.5px] font-semibold flex items-center gap-2 shadow-modal" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Target size={14} />Click each corner of the roof, then click the first point to close</div>
          )}
          {design.planes.length === 0 && !busy && !drawing && (
            <div className="absolute inset-0 z-[400] flex items-center justify-center pointer-events-none">
              <div className="bg-surface/95 backdrop-blur border border-border rounded-card px-6 py-5 text-center shadow-modal max-w-[380px] pointer-events-auto">
                <span className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-white mb-3" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Sun size={22} /></span>
                <div className="text-[15px] font-bold text-ink">Capture the roof</div>
                <div className="text-[12.5px] text-muted-b mt-1">Try <b>Detect roof</b> for Google's read, or <b>Draw plane</b> to trace the real roof — best for big commercial sheds. Then hit <b>AI auto-layout</b>.</div>
                <div className="flex items-center gap-2 justify-center mt-3">
                  <button onClick={() => runDetect()} className="h-9 px-3.5 rounded-control border border-border text-[13px] font-semibold text-ink-3 hover:bg-control inline-flex items-center gap-1.5"><Radar size={14} />Detect</button>
                  <button onClick={toggleDraw} className="h-9 px-3.5 rounded-control text-white text-[13px] font-semibold inline-flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Plus size={14} />Draw plane</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Inspector */}
        <div className="w-[310px] shrink-0 rounded-card bg-surface border border-border flex flex-col overflow-hidden">
          <div className="p-4 border-b border-divider">
            <div className="grid grid-cols-3 gap-2">
              <Metric v={kwp ? `${kwp}` : '—'} u="kWp" hero />
              <Metric v={totalPanels ? String(totalPanels) : '—'} u="panels" hero />
              <Metric v={`${roofArea}`} u="m² roof" hero />
            </div>
            <label className="flex items-center gap-2 mt-3 text-[12px] text-muted-b">
              <Grid size={13} />Module
              <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} className="flex-1 h-8 px-2 rounded-control border border-input-border bg-white text-[12.5px] outline-none focus:border-accent">
                {MODULES.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          </div>
          <div className="flex-1 overflow-y-auto">
            {design.planes.length === 0 ? (
              <div className="p-4 text-[12.5px] text-muted-b">No planes yet. Detect the roof or draw a plane, then fill it with panels.</div>
            ) : design.planes.map((p) => (
              <div key={p.id} className={`px-4 py-3 border-b border-divider cursor-pointer ${p.id === selId ? 'bg-accent-wash' : 'hover:bg-control/40'}`} onClick={() => setSelId(p.id)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-[13px] text-ink-2 flex items-center gap-1.5 min-w-0"><span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.id === selId ? '#7C3AED' : '#00E5FF' }} /><span className="truncate">{p.name}</span></div>
                  <button onClick={(e) => { e.stopPropagation(); deletePlane(p.id) }} className="text-muted-2 hover:text-negative text-[15px] leading-none shrink-0">✕</button>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mt-2 text-center">
                  <Metric v={`${p.pitchDeg}°`} u="pitch" small />
                  <Metric v={compass(p.azimuthDeg)} u="facing" small />
                  <Metric v={`${Math.round(slopedAreaM2(p.areaM2, p.pitchDeg))}`} u="m²" small />
                  <Metric v={p.panels?.length ? String(p.panels.length) : '—'} u="panels" small />
                </div>
                {p.id === selId && (
                  <div className="mt-3 flex flex-col gap-2.5">
                    <Slider label="Pitch" value={p.pitchDeg} min={0} max={60} suffix="°" onChange={(v) => updatePlane(p.id, { pitchDeg: v })} />
                    <Slider label="Azimuth" value={p.azimuthDeg} min={0} max={359} suffix="°" onChange={(v) => updatePlane(p.id, { azimuthDeg: v })} />
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); fillPlane(p.id) }} className="flex-1 h-8 rounded-control text-white text-[12px] font-semibold inline-flex items-center justify-center gap-1.5" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Grid size={13} />Fill panels</button>
                      {p.panels?.length ? <button onClick={(e) => { e.stopPropagation(); clearPlane(p.id) }} className="h-8 px-3 rounded-control border border-border text-[12px] font-semibold text-muted-b hover:bg-control">Clear</button> : null}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-divider flex flex-col gap-2">
            <div className="text-[11px] text-muted-b flex items-center gap-1.5"><Layers size={12} />Strings, inverters &amp; yield come next.</div>
            {design.prospectId && <Button variant="secondary" icon={<Person size={14} />} onClick={() => nav('/tools/company-search')}>Back to prospect</Button>}
          </div>
        </div>
      </div>
    </>
  )
}

function ToolBtn({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`h-8 px-2.5 rounded-[8px] text-[12.5px] font-semibold inline-flex items-center gap-1.5 ${on ? 'text-white' : 'text-ink-3 hover:bg-control'}`} style={on ? { background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' } : undefined}>{icon}{label}</button>
  )
}
function Metric({ v, u, small, hero }: { v: string; u: string; small?: boolean; hero?: boolean }) {
  return <div className={`rounded-lg bg-control ${small ? 'py-1' : 'py-2'}`}><div className={`${small ? 'text-[12px]' : hero ? 'text-[18px]' : 'text-[16px]'} font-bold text-ink leading-none`}>{v}</div><div className="text-[8.5px] text-muted-2 mt-1 uppercase tracking-wide">{u}</div></div>
}
function Slider({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-[11.5px] text-muted-b">
      <span className="w-12 shrink-0">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)} className="flex-1 accent-accent" onClick={(e) => e.stopPropagation()} />
      <b className="text-ink-2 w-9 text-right tabular-nums">{value}{suffix}</b>
    </label>
  )
}
function PageMissing({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
      <Target size={26} className="text-muted-2" />
      <div className="text-[15px] font-bold text-ink">Design not found</div>
      <Button variant="secondary" onClick={onBack}>Back to Design Studio</Button>
    </div>
  )
}
