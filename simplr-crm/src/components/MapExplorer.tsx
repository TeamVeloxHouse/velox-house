import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useActions } from '../store/store'
import { measureRoof } from '../lib/commercialSolar'
import { revealContactsFor } from '../lib/commercialFinder'
import { money } from '../lib/format'
import { Search, Sun, Person, Check, Building, Bolt, Target } from './icons'
import type { SolarProspect, SolarContact } from '../store/types'

const TOOL = 'company-search'
type LatLng = { lat: number; lng: number }

/** A measured pick sitting on the map (before/after it's committed to the pipeline). */
type Pick = Partial<SolarProspect> & { id: string; company: string; address: string; center?: LatLng; domain?: string; added?: boolean; contacts?: SolarContact[] }

const scoreFrom = (kwp: number, payback: number) => Math.round(Math.max(45, Math.min(96, 52 + Math.min(30, kwp / 18) + (payback > 0 && payback <= 8 ? 8 : 0))))

export function MapExplorer({ onOpenProspect }: { onOpenProspect?: (id: string) => void }) {
  const act = useActions()
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const bizLayer = useRef<L.LayerGroup | null>(null)
  const measureMarker = useRef<L.Marker | null>(null)
  const campaignId = useRef<string | null>(null)

  const [picks, setPicks] = useState<Pick[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [revealing, setRevealing] = useState(false)
  const sel = picks.find((p) => p.id === selId) || null

  // Keep a ref of the click handler so the (once-created) map always calls the latest logic.
  const onPick = useRef<(ll: LatLng) => void>(() => {})

  useEffect(() => {
    if (map.current || !mapEl.current) return
    const m = L.map(mapEl.current, { center: [52.6, -1.9], zoom: 6, zoomControl: true, attributionControl: true })
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 21, maxNativeZoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    }).addTo(m)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 21, maxNativeZoom: 19, opacity: 0.9,
    }).addTo(m)
    bizLayer.current = L.layerGroup().addTo(m)
    layer.current = L.layerGroup().addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => onPick.current({ lat: e.latlng.lat, lng: e.latlng.lng }))
    map.current = m
    setTimeout(() => m.invalidateSize(), 120)
    return () => { m.remove(); map.current = null }
  }, [])

  async function resolveCompany(ll: LatLng): Promise<{ name?: string; address?: string; domain?: string; center?: LatLng; category?: string; distanceM?: number }> {
    try {
      const r = await fetch('/api/places', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: ll.lat, lng: ll.lng, radius: 90, count: 5, industry: 'business' }) })
      const j = await r.json()
      const b = (j.buildings || [])[0]
      return b ? { name: b.name, address: b.address, domain: b.domain, center: b.center, category: b.category, distanceM: b.distanceM } : {}
    } catch { return {} }
  }

  function showMeasuring(at: LatLng) {
    if (!map.current) return
    clearMeasuring()
    const icon = L.divIcon({ className: '', html: '<div class="roof-measuring"><span></span></div>', iconSize: [18, 18], iconAnchor: [9, 9] })
    measureMarker.current = L.marker([at.lat, at.lng], { icon, interactive: false, zIndexOffset: 1000 }).addTo(map.current)
  }
  function clearMeasuring() { if (measureMarker.current) { measureMarker.current.remove(); measureMarker.current = null } }

  async function handlePick(ll: LatLng) {
    if (busy) return
    setBusy(true); setStatus('Identifying building…'); showMeasuring(ll)
    if (map.current && map.current.getZoom() < 17) map.current.flyTo([ll.lat, ll.lng], 18, { duration: 0.7 })
    // Measure EXACTLY where they clicked — Google Solar finds the building under the cursor. Places is
    // used only to put a name on it (the nearest business), never to relocate the measurement.
    const co = await resolveCompany(ll)
    // Only trust the name if that business actually sits on what you clicked (~70 m).
    const named = (co.name && (co.distanceM == null || co.distanceM <= 70) ? co : {}) as typeof co
    setStatus(`Measuring roof${named.name ? ` at ${named.name}` : ''}…`)
    try {
      const patch = await measureRoof(named.address || '', ll, named.category)
      const id = `map-${Date.now().toString(36)}`
      const pick: Pick = { ...patch, id, company: named.name || 'Selected building', address: named.address || `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`, domain: named.domain, center: patch.center || ll }
      setPicks((ps) => [pick, ...ps]); setSelId(id)
      drawPick(pick, true)
    } catch {
      act.toast('Could not measure that spot — try clicking on the roof', 'warning')
    } finally { clearMeasuring(); setBusy(false); setStatus('') }
  }
  onPick.current = handlePick

  function drawPick(p: Pick, fly = false) {
    if (!layer.current || !map.current) return
    const c = p.center
    // The highlighted usable roof: the real OSM footprint when we have it, else Google's plane boxes.
    const rings: [number, number][][] = p.roofFootprint?.length
      ? [p.roofFootprint.map((v) => [v.lat, v.lng] as [number, number])]
      : (p.roofSegments ?? []).map(({ box }) => [[box.sw.lat, box.sw.lng], [box.sw.lat, box.ne.lng], [box.ne.lat, box.ne.lng], [box.ne.lat, box.sw.lng]] as [number, number][])
    rings.forEach((ring) => {
      L.polygon(ring, { color: '#0A1B2B', weight: 6, opacity: 0.5, fill: false }).addTo(layer.current!) // dark under-stroke
      L.polygon(ring, { color: '#00E5FF', weight: 3, fillColor: '#22E0FF', fillOpacity: 0.28 }).addTo(layer.current!)
    })
    if (c) {
      const marker = L.circleMarker([c.lat, c.lng], { radius: 7, color: '#0A1B2B', weight: 2, fillColor: '#00E5FF', fillOpacity: 1 }).addTo(layer.current)
      marker.bindTooltip(`${p.company} · ${Math.round(p.systemKwp ?? 0)} kWp`, { permanent: true, direction: 'top', offset: [0, -6], className: 'roof-label' })
      marker.on('click', (e) => { L.DomEvent.stopPropagation(e); setSelId(p.id) })
      if (fly) map.current.flyTo([c.lat, c.lng], Math.max(map.current.getZoom(), 18), { duration: 0.8 })
    }
  }

  /** Drop name labels for the businesses around the current view — so you can see what to click. */
  async function labelNearby() {
    if (!map.current || !bizLayer.current) return
    const ctr = map.current.getCenter()
    setStatus('Labelling businesses…')
    try {
      const r = await fetch('/api/places', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: ctr.lat, lng: ctr.lng, radius: 500, count: 24, industry: 'business' }) })
      const j = await r.json()
      bizLayer.current.clearLayers()
      let n = 0
      for (const b of (j.buildings || [])) {
        if (!b.center) continue
        const m = L.marker([b.center.lat, b.center.lng], { icon: L.divIcon({ className: '', html: '<div style="width:8px;height:8px;border-radius:9999px;background:#fff;border:2px solid #3B6BF5;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>', iconSize: [8, 8], iconAnchor: [4, 4] }) }).addTo(bizLayer.current)
        m.bindTooltip(b.name, { permanent: true, direction: 'top', offset: [0, -4], className: 'roof-label biz-label' })
        m.on('click', (e) => { L.DomEvent.stopPropagation(e); onPick.current({ lat: b.center.lat, lng: b.center.lng }) })
        n++
      }
      if (!n) act.toast('No businesses found here — zoom to an industrial area', 'warning')
    } catch { act.toast('Could not label businesses', 'warning') } finally { setStatus('') }
  }

  async function flyToQuery() {
    const q = query.trim(); if (!q || !map.current) return
    setStatus(`Finding ${q}…`)
    try {
      const r = await fetch('/api/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: q }) })
      const j = await r.json()
      if (typeof j.lat === 'number') map.current.flyTo([j.lat, j.lng], 17, { duration: 1 })
      else act.toast('Could not find that place', 'warning')
    } catch { act.toast('Search failed', 'warning') } finally { setStatus('') }
  }

  function ensureCampaign(): string {
    if (campaignId.current) return campaignId.current
    const c = act.createSolarCampaign({ name: 'Map explorer', tool: TOOL, targetKwp: 250, status: 'complete' })
    campaignId.current = c.id
    return c.id
  }
  function toProspect(p: Pick): SolarProspect {
    return {
      id: p.id, campaignId: ensureCampaign(), tool: TOOL, company: p.company, address: p.address, domain: p.domain,
      center: p.center, category: (p as any).category, roofSegments: p.roofSegments, roofFootprint: p.roofFootprint,
      systemKwp: p.systemKwp ?? 0, roofMaxKwp: p.roofMaxKwp, roofAreaM2: p.roofAreaM2, panels: p.panels ?? 0,
      annualGenKwh: p.annualGenKwh ?? 0, year1Saving: p.year1Saving ?? 0, lifetimeSaving: p.lifetimeSaving ?? 0,
      paybackYears: p.paybackYears ?? 0, npv: p.npv ?? 0, co2PerYearTonnes: p.co2PerYearTonnes ?? 0,
      selfConsumptionPct: p.selfConsumptionPct, demandOffsetPct: p.demandOffsetPct, roofMeasured: !!p.roofMeasured,
      imageUrl: p.imageUrl, roofZoom: p.roofZoom, calc: p.calc, epcRating: null,
      score: scoreFrom(p.systemKwp ?? 0, p.paybackYears ?? 0),
      reasons: [`${Math.round(p.roofMaxKwp ?? p.systemKwp ?? 0)} kWp roof capacity`, p.roofMeasured ? 'Roof measured from satellite (Google Solar)' : 'Roof estimated', 'Selected on the map'],
      status: 'prospected', contacts: p.contacts ?? [], contactsRevealed: !!p.contacts?.length, createdAt: Date.now(), updatedAt: Date.now(),
    }
  }
  function addToPipeline(p: Pick) {
    if (p.added) { onOpenProspect?.(p.id); return }
    act.addSolarProspects([toProspect(p)])
    setPicks((ps) => ps.map((x) => (x.id === p.id ? { ...x, added: true } : x)))
    act.toast(`${p.company} added to pipeline`)
  }
  async function findPeople(p: Pick) {
    if (revealing) return; setRevealing(true)
    const contacts = await revealContactsFor(toProspect(p))
    setPicks((ps) => ps.map((x) => (x.id === p.id ? { ...x, contacts, added: true } : x)))
    if (!p.added) act.addSolarProspects([toProspect({ ...p, contacts })])
    else act.revealSolarContacts(p.id, contacts)
    setRevealing(false)
    if (!contacts.length) act.toast('No contacts found for this company', 'warning')
  }

  return (
    <div className="relative flex-1 min-h-0 rounded-card overflow-hidden border border-border">
      <div ref={mapEl} className="absolute inset-0" style={{ background: '#0b1220' }} />

      {/* Search / fly-to */}
      <div className="absolute top-3 left-3 z-[500] flex items-center gap-2">
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-2" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && flyToQuery()}
            placeholder="Fly to a place — town, postcode, address…" className="h-10 w-[300px] pl-8 pr-3 rounded-control border border-border bg-white/95 backdrop-blur shadow-modal text-[13px] outline-none focus:border-accent" />
        </div>
        <button onClick={flyToQuery} className="h-10 px-3.5 rounded-control text-white text-[13px] font-semibold shadow-modal" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}>Go</button>
        <button onClick={labelNearby} title="Label the businesses around this view" className="h-10 px-3.5 rounded-control bg-white/95 backdrop-blur border border-border shadow-modal text-[13px] font-semibold text-ink-2 hover:bg-white flex items-center gap-1.5"><Building size={14} className="text-accent" />Label</button>
      </div>

      {/* Hint / status */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500]">
        {busy ? (
          <div className="h-9 px-4 rounded-full bg-black/75 text-white text-[12.5px] font-semibold flex items-center gap-2 shadow-modal"><span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />{status}</div>
        ) : (
          <div className="h-9 px-4 rounded-full bg-white/95 backdrop-blur text-ink-2 text-[12.5px] font-semibold flex items-center gap-2 shadow-modal border border-border"><Target size={14} className="text-accent" />Click any building to measure its roof</div>
        )}
      </div>

      {/* Measured-building card */}
      {sel && (
        <div className="absolute top-3 right-3 bottom-3 z-[500] w-[330px] bg-surface rounded-card shadow-modal border border-border flex flex-col overflow-hidden">
          <div className="relative aspect-[16/9] bg-control shrink-0">
            {sel.imageUrl && <img src={sel.imageUrl} alt="" className="w-full h-full object-cover" />}
            <button onClick={() => setSelId(null)} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/75">✕</button>
            <span className="absolute top-2 left-2 text-[11px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}>Score {scoreFrom(sel.systemKwp ?? 0, sel.paybackYears ?? 0)}</span>
            {sel.roofMeasured && <span className="absolute bottom-2 left-2 text-[10px] font-bold text-white bg-black/55 px-2 py-1 rounded backdrop-blur-sm">◆ MEASURED</span>}
          </div>
          <div className="p-3.5 flex flex-col gap-3 overflow-y-auto">
            <div className="flex items-start gap-2.5">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold shrink-0" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}>{sel.company.charAt(0)}</span>
              <div className="min-w-0">
                <div className="font-bold text-[14.5px] leading-tight text-ink truncate">{sel.company}</div>
                <div className="text-[11.5px] text-muted-2 truncate">{sel.address}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat v={`${Math.round(sel.systemKwp ?? 0)} kWp`} u="recommended system" />
              <Stat v={sel.roofAreaM2 ? `${sel.roofAreaM2.toLocaleString()} m²` : '—'} u="roof measured" />
              <Stat v={String(sel.panels ?? 0)} u="panels" />
              <Stat v={`${sel.paybackYears ?? 0}y`} u="payback" />
              <Stat v={money(sel.year1Saving ?? 0, { compact: true })} u="year-1 saving" pos />
              <Stat v={`${sel.co2PerYearTonnes ?? 0} t`} u="CO₂ / year" />
            </div>
            {sel.contacts?.length ? (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-2.5 py-1.5 bg-control/50 text-[11px] font-bold text-ink-2">People ({sel.contacts.length})</div>
                {sel.contacts.slice(0, 4).map((c) => (
                  <div key={c.id} className="px-2.5 py-1.5 border-t border-divider flex items-center gap-2 text-[12px]"><Person size={12} className="text-muted-2 shrink-0" /><span className="truncate"><b className="font-semibold text-ink-2">{c.name}</b> <span className="text-muted-2">· {c.title}</span></span></div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="mt-auto p-3 border-t border-divider flex flex-col gap-2 shrink-0">
            <button onClick={() => addToPipeline(sel)} className="h-9 rounded-control text-white text-[13px] font-semibold flex items-center justify-center gap-2" style={{ background: sel.added ? '#0E9F6E' : 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}>
              {sel.added ? <><Check size={15} />Added — open in pipeline</> : <><Bolt size={15} />Add to pipeline</>}
            </button>
            <button onClick={() => findPeople(sel)} disabled={revealing} className="h-9 rounded-control border border-border text-[13px] font-semibold text-ink-3 hover:bg-control flex items-center justify-center gap-2 disabled:opacity-60">
              {revealing ? <span className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" /> : <Person size={14} />}{sel.contacts?.length ? 'Refresh people' : 'Find people (1 credit)'}
            </button>
          </div>
        </div>
      )}

      {/* Session picks strip */}
      {picks.length > 0 && !sel && (
        <div className="absolute bottom-3 left-3 z-[500] flex items-center gap-2 max-w-[60%] overflow-x-auto">
          {picks.map((p) => (
            <button key={p.id} onClick={() => { setSelId(p.id); if (p.center && map.current) map.current.flyTo([p.center.lat, p.center.lng], 18, { duration: 0.6 }) }}
              className="h-9 px-3 rounded-full bg-white/95 backdrop-blur border border-border shadow-modal text-[12px] font-semibold text-ink-2 whitespace-nowrap flex items-center gap-1.5">
              <Building size={13} className="text-accent" />{p.company.slice(0, 22)} · {Math.round(p.systemKwp ?? 0)} kWp
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ v, u, pos }: { v: string; u: string; pos?: boolean }) {
  return <div className="rounded-lg bg-control px-2.5 py-2"><div className={`text-[15px] font-bold leading-none ${pos ? 'text-positive' : 'text-ink'}`}>{v}</div><div className="text-[9.5px] text-muted-2 mt-1 uppercase tracking-wide">{u}</div></div>
}
