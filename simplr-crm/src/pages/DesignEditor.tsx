import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { TopBar } from '../components/TopBar'
import { Button } from '../components/ui'
import { Sun, Radar, Check, Person, Layers, Target } from '../components/icons'
import { useActions, useState_ } from '../store/store'
import { geocodeLocation } from '../lib/commercialFinder'
import { detectPlanes, slopedAreaM2, totalRoofArea, compass } from '../lib/design'
import type { DesignPlane } from '../store/types'

type LatLng = { lat: number; lng: number }

export function DesignEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const act = useActions()
  const { designs } = useState_()
  const design = designs.find((d) => d.id === id)

  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const planeLayer = useRef<L.LayerGroup | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [selId, setSelId] = useState<string | null>(null)

  // ── Map init (once) ──
  useEffect(() => {
    if (map.current || !mapEl.current) return
    const m = L.map(mapEl.current, { center: [52.6, -1.9], zoom: 6, zoomControl: true })
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 21, maxNativeZoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' }).addTo(m)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom: 21, maxNativeZoom: 19, opacity: 0.9 }).addTo(m)
    planeLayer.current = L.layerGroup().addTo(m)
    map.current = m
    setTimeout(() => m.invalidateSize(), 120)
    return () => { m.remove(); map.current = null }
  }, [])

  // ── Centre on the design; auto-detect the first time if empty ──
  useEffect(() => {
    if (!map.current || !design) return
    ;(async () => {
      let c = design.center
      if (!c && design.address) { const g = await geocodeLocation(design.address); if (g) { c = { lat: g.lat, lng: g.lng }; act.updateDesign(design.id, { center: c }) } }
      if (c) map.current!.setView([c.lat, c.lng], 19)
      if (c && design.planes.length === 0 && !design.center) runDetect(c)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design?.id])

  // ── Redraw planes whenever they change ──
  useEffect(() => {
    const lyr = planeLayer.current; if (!lyr || !map.current || !design) return
    lyr.clearLayers()
    design.planes.forEach((p) => {
      const on = p.id === selId
      const ring = p.polygon.map((v) => [v.lat, v.lng]) as [number, number][]
      L.polygon(ring, { color: '#0A1B2B', weight: 6, opacity: 0.45, fill: false }).addTo(lyr)
      const poly = L.polygon(ring, { color: on ? '#7C3AED' : '#00E5FF', weight: on ? 4 : 3, fillColor: on ? '#7C3AED' : '#22E0FF', fillOpacity: on ? 0.3 : 0.24 }).addTo(lyr)
      poly.on('click', (e) => { L.DomEvent.stopPropagation(e); setSelId(p.id) })
      poly.bindTooltip(`${compass(p.azimuthDeg)} · ${p.pitchDeg}° · ${p.areaM2} m²`, { permanent: true, direction: 'center', className: 'roof-label' })
    })
    if (design.planes.length) {
      const all = design.planes.flatMap((p) => p.polygon.map((v) => [v.lat, v.lng] as [number, number]))
      try { map.current.fitBounds(L.latLngBounds(all).pad(0.35), { maxZoom: 20 }) } catch { /* single point */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design?.planes, selId])

  async function runDetect(center?: LatLng) {
    if (!design || busy) return
    setBusy(true); setStatus('Measuring the roof from satellite…')
    try {
      const { planes, center: c, measured } = await detectPlanes(design.address, center || design.center)
      act.updateDesign(design.id, { planes, center: c || design.center })
      if (c && map.current) map.current.setView([c.lat, c.lng], 19)
      if (!planes.length) act.toast('No roof planes found here — you can draw them manually (coming next)', 'warning')
      else act.toast(`${planes.length} roof plane${planes.length === 1 ? '' : 's'} detected${measured ? '' : ' (estimated)'}`)
    } catch { act.toast('Could not measure this roof', 'warning') } finally { setBusy(false); setStatus('') }
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

  if (!design) return (
    <><TopBar title="Design" crumbs={['Design']} /><PageMissing onBack={() => nav('/design')} /></>
  )

  const roofArea = totalRoofArea(design.planes)
  const sel = design.planes.find((p) => p.id === selId) || null

  return (
    <>
      <TopBar title={design.name} crumbs={['Design', 'Studio']}
        actions={<div className="flex items-center gap-2">
          <Button variant="secondary" icon={<Radar size={15} />} onClick={() => runDetect()} className={busy ? 'opacity-60 pointer-events-none' : ''}>{busy ? 'Measuring…' : design.planes.length ? 'Re-detect roof' : 'Detect roof'}</Button>
          <Button variant={design.status === 'confirmed' ? 'secondary' : 'primary'} icon={<Check size={15} />} onClick={() => act.updateDesign(design.id, { status: design.status === 'confirmed' ? 'draft' : 'confirmed' })}>{design.status === 'confirmed' ? 'Confirmed' : 'Confirm design'}</Button>
        </div>} />
      <div className="flex-1 min-h-0 flex gap-4 px-5 pb-5">
        {/* Canvas */}
        <div className="relative flex-1 min-h-0 rounded-card overflow-hidden border border-border">
          <div ref={mapEl} className="absolute inset-0" style={{ background: '#0b1220' }} />
          {busy && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] h-9 px-4 rounded-full bg-black/75 text-white text-[12.5px] font-semibold flex items-center gap-2 shadow-modal"><span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />{status}</div>
          )}
          {design.planes.length === 0 && !busy && (
            <div className="absolute inset-0 z-[400] flex items-center justify-center pointer-events-none">
              <div className="bg-surface/95 backdrop-blur border border-border rounded-card px-6 py-5 text-center shadow-modal max-w-[360px] pointer-events-auto">
                <span className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-white mb-3" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Sun size={22} /></span>
                <div className="text-[15px] font-bold text-ink">Measure the roof</div>
                <div className="text-[12.5px] text-muted-b mt-1">Ovi reads the roof planes — pitch, orientation and area — from satellite. Hit detect to begin.</div>
                <button onClick={() => runDetect()} className="mt-3 h-9 px-4 rounded-control text-white text-[13px] font-semibold inline-flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Radar size={15} />Detect roof</button>
              </div>
            </div>
          )}
        </div>

        {/* Inspector */}
        <div className="w-[300px] shrink-0 rounded-card bg-surface border border-border flex flex-col overflow-hidden">
          <div className="p-4 border-b border-divider">
            <div className="eyebrow text-[10px] text-muted-3">Roof</div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Metric v={String(design.planes.length)} u="planes" />
              <Metric v={`${roofArea}`} u="m² roof" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {design.planes.length === 0 ? (
              <div className="p-4 text-[12.5px] text-muted-b">No planes yet. Detect the roof, or draw planes manually (next update).</div>
            ) : design.planes.map((p) => (
              <div key={p.id} className={`px-4 py-3 border-b border-divider cursor-pointer ${p.id === selId ? 'bg-accent-wash' : 'hover:bg-control/40'}`} onClick={() => setSelId(p.id)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-[13px] text-ink-2 flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.id === selId ? '#7C3AED' : '#00E5FF' }} />{p.name}</div>
                  <button onClick={(e) => { e.stopPropagation(); deletePlane(p.id) }} className="text-muted-2 hover:text-negative text-[15px] leading-none">✕</button>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                  <Metric v={`${p.pitchDeg}°`} u="pitch" small />
                  <Metric v={compass(p.azimuthDeg)} u="facing" small />
                  <Metric v={`${Math.round(slopedAreaM2(p.areaM2, p.pitchDeg))}`} u="m²" small />
                </div>
                {p.id === selId && (
                  <div className="mt-3 flex flex-col gap-2">
                    <Slider label="Pitch" value={p.pitchDeg} min={0} max={60} suffix="°" onChange={(v) => updatePlane(p.id, { pitchDeg: v })} />
                    <Slider label="Azimuth" value={p.azimuthDeg} min={0} max={359} suffix="°" onChange={(v) => updatePlane(p.id, { azimuthDeg: v })} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-divider flex flex-col gap-2">
            <div className="text-[11px] text-muted-b flex items-center gap-1.5"><Layers size={12} />Panels & strings arrive in the next phase.</div>
            {design.prospectId && <Button variant="secondary" icon={<Person size={14} />} onClick={() => nav('/tools/company-search')}>Back to prospect</Button>}
          </div>
        </div>
      </div>
    </>
  )
}

function Metric({ v, u, small }: { v: string; u: string; small?: boolean }) {
  return <div className="rounded-lg bg-control py-1.5"><div className={`${small ? 'text-[13px]' : 'text-[17px]'} font-bold text-ink leading-none`}>{v}</div><div className="text-[9px] text-muted-2 mt-1 uppercase tracking-wide">{u}</div></div>
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
