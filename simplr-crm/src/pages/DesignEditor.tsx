import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import { TopBar } from '../components/TopBar'
import { Button } from '../components/ui'
import { Sun, Radar, Check, Person, Layers, Target, Sparkle, Plus, Grid, Wrench, Bolt, Pie, File, Box } from '../components/icons'
import { useActions, useState_ } from '../store/store'
import { geocodeLocation } from '../lib/commercialFinder'
import { detectPlanes, slopedAreaM2, totalRoofArea, compass, polygonAreaM2 } from '../lib/design'
import { MODULES, moduleById, packWithSettings, autoLayout, kwpOf, planeSolarFactor, planeQuality, planeGrid, type Module, type LayoutGoal, type GridCell } from '../lib/panels'
import { regionYield, fetchBuildingHeight } from '../lib/solar'
import { parseDesignBrief } from '../lib/oviDesign'
import { designIntentFromClaude } from '../lib/oviDesignAI'
import { Design3D } from '../components/Design3D'
import { DesignCopilot } from '../components/DesignCopilot'
import type { Design, DesignPlane, PanelOrientation, RackingType } from '../store/types'

type LatLng = { lat: number; lng: number }
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
type StudioTab = 'design' | 'array' | 'production' | 'proposal'
// Pylon-style 2D tools: select/move arrays · add · remove · rotate array · draw face · edit vertices
type Tool = 'select' | 'add' | 'remove' | 'rotate' | 'draw' | 'edit'

// ── Manual array-drawing helpers ──
function pointInRing(ring: LatLng[], pt: LatLng): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    if ((ring[i].lat > pt.lat) !== (ring[j].lat > pt.lat) && pt.lng < ((ring[j].lng - ring[i].lng) * (pt.lat - ring[i].lat)) / (ring[j].lat - ring[i].lat) + ring[i].lng) inside = !inside
  }
  return inside
}
const panelCenter = (pn: { corners: LatLng[] }) => ({ lat: (pn.corners[0].lat + pn.corners[2].lat) / 2, lng: (pn.corners[0].lng + pn.corners[2].lng) / 2 })
/** Same physical module position? (centres within ~0.35 m) — used to dedupe / toggle cells. */
const sameCell = (a: LatLng, b: LatLng) => Math.abs(a.lat - b.lat) * 110540 < 0.35 && Math.abs(a.lng - b.lng) * 90000 < 0.35
const nearestCell = (cells: GridCell[], ll: { lat: number; lng: number }): GridCell | null => {
  let best: GridCell | null = null, bd = Infinity
  for (const c of cells) { const d = (c.center.lat - ll.lat) ** 2 + (c.center.lng - ll.lng) ** 2; if (d < bd) { bd = d; best = c } }
  return best
}
/** Every cell in the aligned rectangle between two grid cells (inclusive) — a roof-true block select. */
const cellBlock = (cells: GridCell[], a: GridCell, b: GridCell): GridCell[] => {
  const r0 = Math.min(a.row, b.row), r1 = Math.max(a.row, b.row), c0 = Math.min(a.col, b.col), c1 = Math.max(a.col, b.col)
  return cells.filter((c) => c.row >= r0 && c.row <= r1 && c.col >= c0 && c.col <= c1)
}

/** Effective generating tilt — tilt-racking on a flat roof beats the flat pitch. */
function effTilt(p: DesignPlane): number { return p.racking && p.racking !== 'flush' ? (p.tiltDeg ?? 10) : p.pitchDeg }
function planeYieldFactor(p: DesignPlane): number { return planeSolarFactor({ azimuthDeg: p.azimuthDeg, pitchDeg: effTilt(p) }) }

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
  const ghostLayer = useRef<L.LayerGroup | null>(null)
  const panelRenderer = useRef<L.Canvas | null>(null)
  const designRef = useRef(design)
  designRef.current = design

  const [tab, setTab] = useState<StudioTab>('design')
  const [mapReady, setMapReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [selId, setSelId] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [ghostN, setGhostN] = useState<number | null>(null)
  const [rotDeg, setRotDeg] = useState<number | null>(null)
  const [moduleId, setModuleId] = useState('m440')
  // draw/edit are geoman modes; add/remove/move/rotate are our own roof-grid tools
  const drawing = tool === 'draw', editing = tool === 'edit', adding = tool === 'add'
  const toolRef = useRef(tool); toolRef.current = tool
  const moduleIdRef = useRef(moduleId); moduleIdRef.current = moduleId
  const commitRef = useRef<(planes: DesignPlane[]) => void>(() => {})
  const [view, setView] = useState<'2d' | '3d'>('2d')
  const [targetKwp, setTargetKwp] = useState<string>('')
  const [oviOpen, setOviOpen] = useState(false)
  const module = moduleById(moduleId)
  const canvasVisible = tab === 'design' || tab === 'array'

  // ── Map init (once) ──
  useEffect(() => {
    if (map.current || !mapEl.current) return
    const m = L.map(mapEl.current, { center: [52.6, -1.9], zoom: 6, zoomControl: false, attributionControl: false })
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 21, maxNativeZoom: 19 }).addTo(m)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom: 21, maxNativeZoom: 19, opacity: 0.9 }).addTo(m)
    panelRenderer.current = L.canvas({ padding: 0.5 })
    panelLayer.current = L.layerGroup().addTo(m)
    planeLayer.current = L.layerGroup().addTo(m)
    ghostLayer.current = L.layerGroup().addTo(m)
    m.pm.setGlobalOptions({ snappable: true, snapDistance: 12 })
    m.pm.setPathOptions({ color: '#00E5FF', fillColor: '#22E0FF', fillOpacity: 0.24 })
    m.on('pm:create', (e: any) => {
      const ring = (e.layer.getLatLngs()[0] as L.LatLng[]).map((p) => ({ lat: p.lat, lng: p.lng }))
      e.layer.remove()
      addManualPlane(ring)
      m.pm.disableDraw(); setTool('select')
    })

    // ── Roof-grid tools: place / remove / move / rotate arrays. Everything snaps to the plane's own
    //    module grid (indexed by row,col) so panels always stay aligned and inside the setback. ──
    let startCell: GridCell | null = null, dragCells: GridCell[] = [], dragPid: string | null = null, moved = false
    let moveOccupied: GridCell[] = [] // select-tool: the array's current cells, dragged as a block
    let rotBase = 0, rotStart = 0, rotCen: L.Point | null = null, rotPid: string | null = null
    const cellKey = (c: GridCell) => `${c.row},${c.col}`
    const centroid = (p: DesignPlane) => p.polygon.reduce((a, v) => ({ lat: a.lat + v.lat / p.polygon.length, lng: a.lng + v.lng / p.polygon.length }), { lat: 0, lng: 0 })
    const planeAt = (ll: L.LatLng) => designRef.current?.planes.find((p) => pointInRing(p.polygon, { lat: ll.lat, lng: ll.lng }))
    const gridFor = (p: DesignPlane) => planeGrid(p.polygon, moduleById(p.moduleId ?? moduleIdRef.current), { orientation: p.orientation ?? 'portrait', setback: p.setbackM ?? designRef.current!.setbackM, rowGap: p.rowGapM, angleDeg: p.arrayAngleDeg })
    // Ghost styling — draw intended modules as real panels (dark glass + a thin intent-coloured frame)
    // so the preview reads exactly like what will land. Purple = place, teal = move, red = clear.
    const GH: Record<string, { frame: string; glass: string; fill: number; weight: number }> = {
      add: { frame: '#7C3AED', glass: '#0A0E17', fill: 0.82, weight: 1.6 },
      move: { frame: '#17B890', glass: '#0A0E17', fill: 0.82, weight: 1.6 },
      remove: { frame: '#FF5A5A', glass: '#FF6B6B', fill: 0.34, weight: 1.6 },
      bad: { frame: '#FF5A5A', glass: '#FF6B6B', fill: 0.14, weight: 1.4 },
    }
    const cellPoly = (c: GridCell, style: any) => L.polygon(c.corners.map((v) => [v.lat, v.lng]) as [number, number][], { renderer: panelRenderer.current!, pmIgnore: true, interactive: false, ...style } as any)
    const drawGhosts = (cells: GridCell[], kind: keyof typeof GH = 'add') => {
      const g = ghostLayer.current!; g.clearLayers(); const s = GH[kind]
      cells.forEach((c) => cellPoly(c, { color: s.frame, weight: s.weight, fillColor: s.glass, fillOpacity: s.fill }).addTo(g))
    }
    const hasPanelAt = (p: DesignPlane, c: GridCell) => (p.panels ?? []).some((pn) => sameCell(panelCenter(pn), c.center))
    // Add-hover: faint outline of every open slot on the plane's grid (the Pylon "here's where panels
    // can go" hint) with the solid glass ghost snapping to the nearest slot under the cursor.
    const GRID_HINT = { color: '#BFD0EC', weight: 0.7, opacity: 0.55, fill: false }
    const drawAddHover = (p: DesignPlane, grid: GridCell[], nearest: GridCell | null) => {
      const g = ghostLayer.current!; g.clearLayers()
      grid.forEach((c) => { if (!hasPanelAt(p, c)) cellPoly(c, GRID_HINT).addTo(g) })
      if (nearest) { const s = GH.add; cellPoly(nearest, { color: s.frame, weight: s.weight, fillColor: s.glass, fillOpacity: s.fill }).addTo(g) }
    }
    const repackAtAngle = (pid: string, angleDeg: number) => {
      const d = designRef.current!; const p = d.planes.find((x) => x.id === pid); if (!p) return
      const mod = moduleById(p.moduleId ?? moduleIdRef.current); const next = { ...p, arrayAngleDeg: angleDeg }
      const { panels, orientation } = packWithSettings(next, mod, d.setbackM)
      commitRef.current(d.planes.map((x) => (x.id === pid ? { ...next, panels, orientation, moduleId: p.moduleId ?? moduleIdRef.current } : x)))
    }
    const angleAt = (ll: L.LatLng) => { const pt = m.latLngToContainerPoint(ll); return Math.atan2(pt.y - rotCen!.y, pt.x - rotCen!.x) }
    const rotFrom = (ll: L.LatLng) => { let d = rotBase + ((angleAt(ll) - rotStart) * 180) / Math.PI; return ((d % 180) + 180) % 180 }

    m.on('mousedown', (e: any) => {
      const t = toolRef.current; const p = planeAt(e.latlng)
      if (t === 'rotate') {
        if (!p) return; setSelId(p.id)
        rotPid = p.id; rotBase = p.arrayAngleDeg ?? 0; rotCen = m.latLngToContainerPoint([centroid(p).lat, centroid(p).lng]); rotStart = angleAt(e.latlng)
        m.dragging.disable(); L.DomEvent.stop(e); return
      }
      if (t === 'add' || t === 'remove') {
        if (!p) return
        dragPid = p.id; dragCells = gridFor(p); startCell = nearestCell(dragCells, e.latlng); moved = false
        m.dragging.disable(); L.DomEvent.stop(e); return
      }
      if (t === 'select') {
        if (!p) return; setSelId(p.id)
        if (p.panels?.length) { // grab the whole array to drag it across the grid
          dragPid = p.id; dragCells = gridFor(p); startCell = nearestCell(dragCells, e.latlng); moved = false
          moveOccupied = dragCells.filter((c) => hasPanelAt(p, c))
          m.dragging.disable(); L.DomEvent.stop(e)
        }
      }
    })
    m.on('mousemove', (e: any) => {
      const t = toolRef.current
      if (t === 'rotate' && rotPid && rotCen) {
        const deg = rotFrom(e.latlng); setRotDeg(Math.round(deg))
        const pp = designRef.current!.planes.find((x) => x.id === rotPid)
        if (pp) drawGhosts(gridFor({ ...pp, arrayAngleDeg: deg }), 'move')
        return
      }
      if ((t === 'add' || t === 'remove') && dragPid && startCell) {
        const cur = nearestCell(dragCells, e.latlng); if (!cur) return
        if (cur.row !== startCell.row || cur.col !== startCell.col) moved = true
        drawGhosts(cellBlock(dragCells, startCell, cur), t === 'remove' ? 'remove' : 'add'); setGhostN(cellBlock(dragCells, startCell, cur).length); return
      }
      if (t === 'select' && dragPid && startCell && moveOccupied.length) {
        const cur = nearestCell(dragCells, e.latlng); if (!cur) return
        const dr = cur.row - startCell.row, dc = cur.col - startCell.col; if (dr || dc) moved = true
        const idx = new Map(dragCells.map((c) => [cellKey(c), c]))
        const dest = moveOccupied.map((c) => idx.get(`${c.row + dr},${c.col + dc}`))
        if (dest.every(Boolean)) { drawGhosts(dest as GridCell[], 'move'); setGhostN(dest.length) } else { drawGhosts(moveOccupied, 'bad'); setGhostN(null) }
        return
      }
      if (t === 'add' || t === 'remove') { // hover preview — add shows the open grid + nearest slot; remove highlights the panel under the cursor
        const p = planeAt(e.latlng)
        if (p) {
          const grid = gridFor(p), c = nearestCell(grid, e.latlng)
          if (t === 'add') drawAddHover(p, grid, c)
          else drawGhosts(c && hasPanelAt(p, c) ? [c] : [], 'remove')
        } else ghostLayer.current?.clearLayers()
        setGhostN(null)
      }
    })
    m.on('mouseup', (e: any) => {
      const t = toolRef.current
      if (t === 'rotate' && rotPid) { repackAtAngle(rotPid, rotFrom(e.latlng)); rotPid = null; rotCen = null }
      else if ((t === 'add' || t === 'remove') && dragPid && startCell) {
        const d = designRef.current!; const p = d.planes.find((x) => x.id === dragPid)
        if (p) {
          const cur = nearestCell(dragCells, e.latlng) ?? startCell
          const block = moved ? cellBlock(dragCells, startCell, cur) : [startCell]
          let panels = [...(p.panels ?? [])]
          if (t === 'remove') panels = panels.filter((pn) => !block.some((c) => sameCell(panelCenter(pn), c.center)))
          else if (!moved) { const i = panels.findIndex((pn) => sameCell(panelCenter(pn), startCell!.center)); if (i >= 0) panels.splice(i, 1); else panels.push({ id: uid('pn'), corners: startCell.corners }) }
          else for (const c of block) if (!panels.some((pn) => sameCell(panelCenter(pn), c.center))) panels.push({ id: uid('pn'), corners: c.corners })
          commitRef.current(d.planes.map((x) => (x.id === dragPid ? { ...x, panels, moduleId: p.moduleId ?? moduleIdRef.current } : x)))
        }
      } else if (t === 'select' && dragPid && startCell && moveOccupied.length && moved) {
        const d = designRef.current!; const p = d.planes.find((x) => x.id === dragPid)
        const cur = nearestCell(dragCells, e.latlng) ?? startCell
        if (p) {
          const dr = cur.row - startCell.row, dc = cur.col - startCell.col
          const idx = new Map(dragCells.map((c) => [cellKey(c), c]))
          const dest = moveOccupied.map((c) => idx.get(`${c.row + dr},${c.col + dc}`))
          if (dest.every(Boolean)) commitRef.current(d.planes.map((x) => (x.id === dragPid ? { ...x, panels: (dest as GridCell[]).map((c) => ({ id: uid('pn'), corners: c.corners })), moduleId: p.moduleId ?? moduleIdRef.current } : x)))
        }
      }
      ghostLayer.current?.clearLayers(); setGhostN(null); setRotDeg(null)
      startCell = null; dragCells = []; dragPid = null; moveOccupied = []; rotPid = null; m.dragging.enable()
    })
    map.current = m
    if ((import.meta as any).env?.DEV) (window as any).__lmap = m
    setTimeout(() => { m.invalidateSize(); setMapReady(true) }, 120)
    return () => { m.remove(); map.current = null; setMapReady(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep Leaflet sized correctly when returning to a canvas tab (it was display:none)
  useEffect(() => { if (canvasVisible && map.current) setTimeout(() => map.current!.invalidateSize(), 60) }, [canvasVisible])

  // ── Centre on the design; auto-detect the first time if empty ──
  useEffect(() => {
    if (!map.current || !design) return
    ;(async () => {
      let c = design.center
      if (!c && design.address) { const g = await geocodeLocation(design.address); if (g) { c = { lat: g.lat, lng: g.lng }; act.updateDesign(design.id, { center: c }) } }
      if (c) map.current!.setView([c.lat, c.lng], 19)
      if (c && design.planes.length === 0) runDetect(c)
      // Pull the real building height from OSM once (free, no key) so the 3D model isn't a guess.
      if (c && design.eaveHeightM == null) {
        fetchBuildingHeight(c).then((h) => { if (h && designRef.current?.id === design.id) { act.updateDesign(design.id, { eaveHeightM: h.eaveM, heightSource: h.source }); act.toast(`Building height ${h.eaveM} m from OpenStreetMap`) } }).catch(() => {})
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design?.id])

  // ── Redraw planes + panels whenever they change ──
  useEffect(() => {
    const lyr = planeLayer.current, pl = panelLayer.current
    if (!lyr || !pl || !map.current || !mapReady || !design) return
    lyr.clearLayers(); pl.clearLayers()
    design.planes.forEach((p) => {
      const on = p.id === selId
      const ring = p.polygon.map((v) => [v.lat, v.lng]) as [number, number][]
      L.polygon(ring, { pmIgnore: true, color: '#0A1B2B', weight: 6, opacity: 0.4, fill: false } as any).addTo(lyr)
      const poly = L.polygon(ring, { color: on ? '#A97BF3' : '#00E5FF', weight: on ? 4 : 2.5, fillColor: on ? '#7C3AED' : '#22E0FF', fillOpacity: p.panels?.length ? 0.06 : (on ? 0.28 : 0.2) })
      ;(poly as any)._planeId = p.id
      poly.on('click', (e) => { L.DomEvent.stopPropagation(e); setSelId(p.id) })
      poly.on('pm:edit', () => syncGeometry(p.id, poly))
      poly.bindTooltip(`${compass(p.azimuthDeg)} · ${effTilt(p)}° · ${p.panels?.length ? `${p.panels.length} panels` : `${p.areaM2} m²`}`, { permanent: true, direction: 'center', className: 'roof-label' })
      poly.addTo(lyr)
      // Sleek black modules (OpenSolar look) — near-black glass with a thin cool frame.
      p.panels?.forEach((pn) => {
        L.polygon(pn.corners.map((v) => [v.lat, v.lng]) as [number, number][], { pmIgnore: true, renderer: panelRenderer.current!, color: '#3A4A6B', weight: 0.7, fillColor: '#0A0E17', fillOpacity: 0.94 } as any).addTo(pl)
      })
      // Facing arrow — one per filled array, pointing downslope (the way the panels face).
      if (p.panels?.length) {
        const c = p.polygon.reduce((a, v) => ({ lat: a.lat + v.lat / p.polygon.length, lng: a.lng + v.lng / p.polygon.length }), { lat: 0, lng: 0 })
        const az = (p.azimuthDeg * Math.PI) / 180, len = 3.5
        const dlat = (len * Math.cos(az)) / 110540, dlng = (len * Math.sin(az)) / (111320 * Math.cos((c.lat * Math.PI) / 180))
        const tip: [number, number] = [c.lat + dlat, c.lng + dlng]
        const back = az + Math.PI, wing = 0.5
        const bl: [number, number] = [tip[0] + (1.4 * Math.cos(back + wing)) / 110540, tip[1] + (1.4 * Math.sin(back + wing)) / (111320 * Math.cos((c.lat * Math.PI) / 180))]
        const br: [number, number] = [tip[0] + (1.4 * Math.cos(back - wing)) / 110540, tip[1] + (1.4 * Math.sin(back - wing)) / (111320 * Math.cos((c.lat * Math.PI) / 180))]
        const arrowStyle = { color: '#EAF0FF', weight: 2.5, opacity: 0.9, pmIgnore: true, interactive: false } as any
        L.polyline([[c.lat, c.lng], tip], arrowStyle).addTo(pl)
        L.polyline([bl, tip, br], arrowStyle).addTo(pl)
      }
    })
    if (design.planes.length && toolRef.current === 'select') {
      const all = design.planes.flatMap((p) => p.polygon.map((v) => [v.lat, v.lng] as [number, number]))
      try { map.current.fitBounds(L.latLngBounds(all).pad(0.3), { maxZoom: 20, animate: false }) } catch { /* single point */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design?.planes, selId, mapReady])

  // ── Actions ──
  async function runDetect(center?: LatLng) {
    if (!design || busy) return
    setBusy(true); setStatus('Measuring the roof from satellite…')
    try {
      const { planes, center: c, measured } = await detectPlanes(design.address, center || design.center)
      if (c && map.current) map.current.setView([c.lat, c.lng], 19)
      if (!measured) {
        // No real measurement available (no Solar key) — don't fabricate giant boxes; ask for a trace.
        act.updateDesign(design.id, { center: c || design.center })
        act.toast('Can’t measure this roof without a Google Solar key — draw the real roof with “Draw plane”.', 'warning')
        return
      }
      // Keep hand-drawn planes, REPLACE previously-detected ones so repeated taps don't stack boxes.
      const kept = design.planes.filter((p) => p.source === 'manual')
      act.updateDesign(design.id, { planes: [...planes, ...kept], center: c || design.center })
      if (!planes.length) act.toast('No roof planes found here — draw them by hand instead', 'warning')
      else act.toast(`${planes.length} plane${planes.length === 1 ? '' : 's'} detected — refine or draw the real roof`)
    } catch { act.toast('Could not measure this roof', 'warning') } finally { setBusy(false); setStatus('') }
  }
  function addManualPlane(ring: LatLng[]) {
    const d = designRef.current; if (!d) return
    const plane: DesignPlane = { id: uid('pl'), name: `Roof plane ${d.planes.length + 1}`, polygon: ring, pitchDeg: 5, azimuthDeg: 180, areaM2: Math.round(polygonAreaM2(ring)), source: 'manual', racking: 'flush' }
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
  function updatePlane(pid: string, patch: Partial<DesignPlane>, repack = false) {
    const d = designRef.current; if (!d) return
    const planes = d.planes.map((p) => {
      if (p.id !== pid) return p
      const next = { ...p, ...patch }
      if (repack && (p.panels?.length || patch.panels === undefined && p.panels?.length)) {
        const mod = moduleById(next.moduleId ?? moduleId)
        const { panels, orientation } = packWithSettings(next, mod, d.setbackM)
        return { ...next, panels, orientation }
      }
      return next
    })
    commitSnapshot(planes)
  }
  function fillPlane(pid: string) {
    const d = designRef.current; if (!d) return
    let filled = 0
    const planes = d.planes.map((p) => {
      if (p.id !== pid) return p
      const mod = moduleById(p.moduleId ?? moduleId)
      const { panels, orientation } = packWithSettings(p, mod, d.setbackM)
      filled = panels.length
      return { ...p, panels, orientation, moduleId: p.moduleId ?? moduleId }
    })
    commitSnapshot(planes)
    if (filled === 0) act.toast('That face is too small/narrow for a full module after the setback', 'warning')
    else act.toast(`Filled ${filled} panel${filled === 1 ? '' : 's'}`, 'positive')
  }
  function clearPlane(pid: string) {
    const d = designRef.current; if (!d) return
    commitSnapshot(d.planes.map((p) => (p.id === pid ? { ...p, panels: [] } : p)))
  }
  function runAutoLayout(goal: LayoutGoal) {
    const d = designRef.current; if (!d || !d.planes.length) { act.toast('Draw or detect a roof plane first', 'warning'); return }
    setBusy(true)
    setStatus(goal.kind === 'max' ? 'Ovi is maximising coverage across every plane…' : goal.kind === 'target-kwp' ? `Ovi is sizing the array to ${goal.kwp} kWp…` : `Ovi is sizing the array to ~${goal.kwh.toLocaleString()} kWh/yr…`)
    setTimeout(() => {
      const res = autoLayout(d.planes, module, goal, d.setbackM)
      commitSnapshot(res.planes)
      setBusy(false); setStatus('')
      act.toast(res.count ? `Ovi placed ${res.count} panels — ${res.kwp} kWp across ${res.planes.filter((p) => p.panels?.length).length} plane(s)` : 'No room for panels on these planes', res.count ? 'positive' : 'warning')
    }, 700)
  }
  function commitSnapshot(planes: DesignPlane[]) {
    const d = designRef.current!
    let count = 0, kwp = 0, kwh = 0
    planes.forEach((p) => {
      const mod = moduleById(p.moduleId ?? moduleId)
      const n = p.panels?.length ?? 0
      count += n; kwp += (n * mod.watts) / 1000
      kwh += (n * mod.watts / 1000) * regionYield(d.address).yield * planeYieldFactor(p)
    })
    act.updateDesign(d.id, { planes, panels: count, systemKwp: Math.round(kwp * 10) / 10, annualKwh: Math.round(kwh) })
  }
  commitRef.current = commitSnapshot
  // Ovi conversational design — parse a brief, then size + lay out live, streaming each step.
  async function oviExecute(brief: string, emit: (line: string) => void): Promise<string> {
    const d = designRef.current!
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
    if (!d.planes.length) { emit('Looking for a roof…'); await delay(300); return 'There’s no roof captured yet. Use “Detect roof” (needs a Google Solar key) or “Draw plane” to trace it, then ask me again.' }
    emit('Reading your brief…'); await delay(300)
    const yieldPerKwp = regionYield(d.address).yield
    // Real brain: Claude reads the brief + the live roof faces; fall back to the offline parser.
    const ai = await designIntentFromClaude(brief, d, yieldPerKwp, moduleId).catch(() => null)
    const intent = ai ?? parseDesignBrief(brief, d, yieldPerKwp)
    const aiMessage = ai?.aiMessage
    if (intent.moduleId) { setModuleId(intent.moduleId); emit(`Module → ${intent.moduleLabel}`); await delay(350) }
    emit(`Goal → ${intent.goalLabel}`); await delay(350)
    if (intent.restrictLabel) { emit(`Scope → ${intent.restrictLabel}`); await delay(300) }
    intent.notes.forEach((n) => emit(n))
    emit('Ranking roofs by orientation & tilt…'); await delay(500)
    let restrict = intent.restrict
    if (intent.bestOnly) { const best = [...d.planes].sort((a, b) => planeQuality(b) - planeQuality(a))[0]; restrict = (p) => p.id === best.id }
    const mod = moduleById(intent.moduleId ?? moduleId)
    const planesIn = intent.moduleId ? d.planes.map((p) => ({ ...p, moduleId: undefined })) : d.planes
    emit('Packing panels on the best-facing planes…'); await delay(650)
    const res = autoLayout(planesIn, mod, intent.goal, d.setbackM, { restrict })
    commitSnapshot(res.planes)
    const annual = res.planes.reduce((s, p) => { const m = moduleById(p.moduleId ?? mod.id); const n = p.panels?.length ?? 0; return s + (n * m.watts / 1000) * yieldPerKwp * planeYieldFactor(p) }, 0)
    const used = res.planes.filter((p) => p.panels?.length).length
    if (res.count === 0) return 'No panels fit those constraints — the roofs may be too small or the scope too narrow. Try “maximum coverage”, or widen the setback.'
    let out = `${aiMessage ? aiMessage + '\n' : ''}Placed ${res.count} panels — ${res.kwp} kWp across ${used} plane${used === 1 ? '' : 's'} (~${Math.round(annual).toLocaleString()} kWh/yr).`
    if (intent.billKwh) out += `\nThat covers ~${Math.round((annual / intent.billKwh) * 100)}% of the ${intent.billKwh.toLocaleString()} kWh bill.`
    out += '\nOpen the Array tab to fine-tune racking, spacing or the module.'
    return out
  }
  // One entry point for the top-left tool rail. Cleans up the mode we're leaving, arms the next one.
  // Clicking the active tool drops back to Select — the safe "nothing armed" default.
  function selectTool(t: Tool) {
    const m = map.current; if (!m) return
    if (drawing) m.pm.disableDraw()
    if (editing) m.pm.disableGlobalEditMode()
    ghostLayer.current?.clearLayers(); setGhostN(null); setRotDeg(null); m.dragging.enable()
    const next: Tool = t !== 'select' && tool === t ? 'select' : t
    setTool(next)
    if (next === 'draw') m.pm.enableDraw('Polygon', { snappable: true })
    else if (next === 'edit') m.pm.enableGlobalEditMode({ allowSelfIntersection: false })
    else if ((next === 'add' || next === 'remove' || next === 'rotate') && !design?.planes.length) act.toast('Draw or detect a roof first, then use the panel tools', 'warning')
  }

  if (!design) return (<><TopBar title="Design" crumbs={['Design']} /><PageMissing onBack={() => nav('/design')} /></>)

  const roofArea = totalRoofArea(design.planes)
  const totals = design.planes.reduce((a, p) => {
    const mod = moduleById(p.moduleId ?? moduleId); const n = p.panels?.length ?? 0
    return { count: a.count + n, kwp: a.kwp + (n * mod.watts) / 1000, kwh: a.kwh + (n * mod.watts / 1000) * regionYield(design.address).yield * planeYieldFactor(p) }
  }, { count: 0, kwp: 0, kwh: 0 })
  const kwp = Math.round(totals.kwp * 10) / 10
  const sel = design.planes.find((p) => p.id === selId)

  const tabs: { id: StudioTab; label: string; icon: any }[] = [
    { id: 'design', label: 'Design', icon: Sun },
    { id: 'array', label: 'Array', icon: Grid },
    { id: 'production', label: 'Production', icon: Pie },
    { id: 'proposal', label: 'Proposal', icon: File },
  ]

  return (
    <>
      <TopBar title={design.name} crumbs={['Design', 'Studio']}
        actions={<div className="flex items-center gap-2">
          <Button variant="secondary" icon={<Radar size={15} />} onClick={() => runDetect()} className={busy ? 'opacity-60 pointer-events-none' : ''}>{busy ? 'Working…' : 'Detect roof'}</Button>
          <Button variant="primary" icon={<Sparkle size={15} />} onClick={() => runAutoLayout({ kind: 'max' })} className={busy ? 'opacity-60 pointer-events-none' : ''}>Ovi auto-layout</Button>
          <Button variant="secondary" icon={<Check size={15} />} onClick={() => act.updateDesign(design.id, { status: design.status === 'confirmed' ? 'draft' : 'confirmed' })}>{design.status === 'confirmed' ? 'Confirmed' : 'Confirm'}</Button>
        </div>} />

      {/* OpenSolar-style tab row — navigation *inside* the tool, CRM rail stays put */}
      <div className="px-5 border-b border-divider flex items-center gap-1">
        {tabs.map((t) => {
          const on = t.id === tab
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`relative h-11 px-3.5 text-[13.5px] font-semibold inline-flex items-center gap-2 transition-colors ${on ? 'text-accent' : 'text-muted-b hover:text-ink-3'}`}>
              <t.icon size={15} />{t.label}
              {on && <span className="absolute left-2 right-2 -bottom-px h-[2.5px] rounded-full" style={{ background: 'linear-gradient(90deg,#3B6BF5,#7C3AED)' }} />}
            </button>
          )
        })}
        <div className="ml-auto flex items-center gap-3">
          <button onClick={() => setOviOpen(true)} className="h-8 px-3 rounded-full text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 shadow-primary" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Sparkle size={13} />Design with Ovi</button>
          <div className="flex items-center gap-2 text-[12px] text-muted-b">
            <span className="font-bold text-ink tabular-nums">{kwp || '—'}</span> kWp
            <span className="w-px h-4 bg-divider" />
            <span className="font-bold text-ink tabular-nums">{totals.count || '—'}</span> panels
            <span className="w-px h-4 bg-divider" />
            <span className="font-bold text-ink tabular-nums">{totals.kwh ? Math.round(totals.kwh).toLocaleString() : '—'}</span> kWh/yr
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {/* Canvas + inspector — always mounted, hidden (not unmounted) on info tabs so Leaflet survives */}
        <div className={`absolute inset-0 flex gap-4 px-5 py-4 ${canvasVisible ? '' : 'invisible pointer-events-none'}`}>
          <div className="relative flex-1 min-h-0 rounded-card overflow-hidden border border-border">
            <div ref={mapEl} className="absolute inset-0" style={{ background: '#0b1220', isolation: 'isolate' }} />
            {view === '3d' && canvasVisible && <Design3D design={design} adding={adding} moduleId={moduleId} onCommitPanels={(pid, panels) => commitSnapshot(design.planes.map((p) => (p.id === pid ? { ...p, panels, moduleId: p.moduleId ?? moduleId } : p)))} onCapture={() => { setView('2d'); setTimeout(() => selectTool('draw'), 80) }} />}
            {view === '2d' && (
              <div className="absolute top-3 left-3 z-[500] flex flex-col gap-1 bg-white/95 backdrop-blur border border-border rounded-control shadow-modal p-1">
                <ToolBtn on={tool === 'select'} onClick={() => selectTool('select')} icon={<CursorIcon />} label="Select / move array" />
                <ToolBtn on={tool === 'add'} onClick={() => selectTool('add')} icon={<Grid size={15} />} label="Add panels" />
                <ToolBtn on={tool === 'remove'} onClick={() => selectTool('remove')} icon={<EraseIcon />} label="Remove panels" />
                <ToolBtn on={tool === 'rotate'} onClick={() => selectTool('rotate')} icon={<RotateIcon />} label="Rotate array" />
                <span className="h-px mx-1.5 my-0.5 bg-divider" />
                <ToolBtn on={tool === 'draw'} onClick={() => selectTool('draw')} icon={<Plus size={15} />} label="Draw roof face" />
                <ToolBtn on={tool === 'edit'} onClick={() => selectTool('edit')} icon={<Wrench size={14} />} label="Edit vertices" />
              </div>
            )}
            <div className="absolute top-3 right-3 z-[550] flex items-center bg-white/95 backdrop-blur border border-border rounded-control shadow-modal p-1">
              {(['2d', '3d'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`h-8 px-3 rounded-[8px] text-[12.5px] font-bold ${view === v ? 'text-white' : 'text-ink-3 hover:bg-control'}`} style={view === v ? { background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' } : undefined}>{v.toUpperCase()}</button>
              ))}
            </div>
            {busy && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] h-9 px-4 rounded-full bg-black/75 text-white text-[12.5px] font-semibold flex items-center gap-2 shadow-modal"><span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />{status}</div>
            )}
            {drawing && !busy && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] h-9 px-4 rounded-full text-white text-[12.5px] font-semibold flex items-center gap-2 shadow-modal" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Target size={14} />Click each corner of the roof, then click the first point to close</div>
            )}
            {view === '2d' && !busy && !drawing && (tool === 'add' || tool === 'remove' || tool === 'rotate' || (tool === 'select' && ghostN != null)) && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] h-9 px-4 rounded-full text-white text-[12.5px] font-semibold flex items-center gap-2 shadow-modal" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}>
                {tool === 'add' && <><Grid size={14} />Click to place a module · drag for a block{ghostN != null ? ` · ${ghostN}` : ''}</>}
                {tool === 'remove' && <><EraseIcon />Click a panel to remove · drag to clear a block{ghostN != null ? ` · ${ghostN}` : ''}</>}
                {tool === 'rotate' && <><RotateIcon />Drag around the array to spin the grid{rotDeg != null ? ` · ${rotDeg}°` : ''}</>}
                {tool === 'select' && <><CursorIcon />Drag the array to move it{ghostN != null ? ` · ${ghostN}` : ''}</>}
              </div>
            )}
            {design.planes.length === 0 && !busy && !drawing && (
              <div className="absolute inset-0 z-[400] flex items-center justify-center pointer-events-none">
                <div className="bg-surface/95 backdrop-blur border border-border rounded-card px-6 py-5 text-center shadow-modal max-w-[380px] pointer-events-auto">
                  <span className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-white mb-3" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Sun size={22} /></span>
                  <div className="text-[15px] font-bold text-ink">Capture the roof</div>
                  <div className="text-[12.5px] text-muted-b mt-1">Try <b>Detect roof</b> for Google's read, or <b>Draw plane</b> to trace the real roof — best for big commercial sheds. Then hit <b>Ovi auto-layout</b>.</div>
                  <div className="flex items-center gap-2 justify-center mt-3">
                    <button onClick={() => runDetect()} className="h-9 px-3.5 rounded-control border border-border text-[13px] font-semibold text-ink-3 hover:bg-control inline-flex items-center gap-1.5"><Radar size={14} />Detect</button>
                    <button onClick={() => selectTool('draw')} className="h-9 px-3.5 rounded-control text-white text-[13px] font-semibold inline-flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Plus size={14} />Draw plane</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right inspector — switches depth by tab */}
          {tab === 'array'
            ? <ArrayInspector design={design} sel={sel} moduleId={moduleId} setModuleId={setModuleId} onSelect={setSelId} onUpdate={updatePlane} onFill={fillPlane} onClear={clearPlane} onDelete={deletePlane}
                targetKwp={targetKwp} setTargetKwp={setTargetKwp} onGoal={runAutoLayout} kwp={kwp} count={totals.count} />
            : <DesignInspector design={design} selId={selId} onSelect={setSelId} onUpdate={updatePlane} onFill={fillPlane} onClear={clearPlane} onDelete={deletePlane} moduleId={moduleId} setModuleId={setModuleId} kwp={kwp} totalPanels={totals.count} roofArea={roofArea} module={module} onHeight={(m) => act.updateDesign(design.id, { eaveHeightM: m, heightSource: 'manual' })} onBackToProspect={design.prospectId ? () => nav('/tools/company-search') : undefined} />
          }
        </div>

        {tab === 'production' && <ProductionPane design={design} moduleId={moduleId} kwp={kwp} count={totals.count} annualKwh={Math.round(totals.kwh)} />}
        {tab === 'proposal' && <ProposalPane design={design} kwp={kwp} count={totals.count} annualKwh={Math.round(totals.kwh)} onOpen={() => nav('/studio/proposals')} onConfirm={() => act.updateDesign(design.id, { status: 'confirmed', systemKwp: kwp, panels: totals.count, annualKwh: Math.round(totals.kwh) })} />}
        <DesignCopilot open={oviOpen} onClose={() => setOviOpen(false)} onExecute={oviExecute} />
      </div>
    </>
  )
}

/* ── Design-tab inspector: plane list + quick pitch/azimuth + fill ── */
function DesignInspector({ design, selId, onSelect, onUpdate, onFill, onClear, onDelete, moduleId, setModuleId, kwp, totalPanels, roofArea, module, onHeight, onBackToProspect }: {
  design: Design; selId: string | null; onSelect: (id: string) => void; onUpdate: (id: string, patch: Partial<DesignPlane>, repack?: boolean) => void
  onFill: (id: string) => void; onClear: (id: string) => void; onDelete: (id: string) => void; moduleId: string; setModuleId: (v: string) => void
  kwp: number; totalPanels: number; roofArea: number; module: Module; onHeight: (m: number) => void; onBackToProspect?: () => void
}) {
  return (
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
            {MODULES.map((m) => <option key={m.id} value={m.id}>{m.watts} W · {m.brand}</option>)}
          </select>
        </label>
      </div>
      <div className="flex-1 overflow-y-auto">
        {design.planes.length === 0 ? (
          <div className="p-4 text-[12.5px] text-muted-b">No planes yet. Detect the roof or draw a plane, then fill it with panels.</div>
        ) : design.planes.map((p) => (
          <div key={p.id} className={`px-4 py-3 border-b border-divider cursor-pointer ${p.id === selId ? 'bg-accent-wash' : 'hover:bg-control/40'}`} onClick={() => onSelect(p.id)}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-[13px] text-ink-2 flex items-center gap-1.5 min-w-0"><span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.id === selId ? '#7C3AED' : '#00E5FF' }} /><span className="truncate">{p.name}</span></div>
              <button onClick={(e) => { e.stopPropagation(); onDelete(p.id) }} className="text-muted-2 hover:text-negative text-[15px] leading-none shrink-0">✕</button>
            </div>
            <div className="grid grid-cols-4 gap-1.5 mt-2 text-center">
              <Metric v={`${effTilt(p)}°`} u="pitch" small />
              <Metric v={compass(p.azimuthDeg)} u="facing" small />
              <Metric v={`${Math.round(slopedAreaM2(p.areaM2, p.pitchDeg))}`} u="m²" small />
              <Metric v={p.panels?.length ? String(p.panels.length) : '—'} u="panels" small />
            </div>
            {p.id === selId && (
              <div className="mt-3 flex flex-col gap-2.5">
                <Slider label="Pitch" value={p.pitchDeg} min={0} max={60} suffix="°" onChange={(v) => onUpdate(p.id, { pitchDeg: v }, true)} />
                <Slider label="Azimuth" value={p.azimuthDeg} min={0} max={359} suffix="°" onChange={(v) => onUpdate(p.id, { azimuthDeg: v })} />
                <Slider label="Array angle" value={Math.round(p.arrayAngleDeg ?? 0)} min={0} max={179} suffix="°" onChange={(v) => onUpdate(p.id, { arrayAngleDeg: v }, true)} />
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); onFill(p.id) }} className="flex-1 h-8 rounded-control text-white text-[12px] font-semibold inline-flex items-center justify-center gap-1.5" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Grid size={13} />Fill panels</button>
                  {p.panels?.length ? <button onClick={(e) => { e.stopPropagation(); onClear(p.id) }} className="h-8 px-3 rounded-control border border-border text-[12px] font-semibold text-muted-b hover:bg-control">Clear</button> : null}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-divider flex flex-col gap-2.5">
        <Slider label={`Height${design.heightSource === 'osm' ? ' · OSM' : ''}`} value={Math.round(design.eaveHeightM ?? 5)} min={2} max={30} suffix=" m" onChange={onHeight} />
        <div className="text-[11px] text-muted-b flex items-center gap-1.5"><Layers size={12} />Open the <b>Array</b> tab for racking, module &amp; row settings.</div>
        {onBackToProspect && <Button variant="secondary" icon={<Person size={14} />} onClick={onBackToProspect}>Back to prospect</Button>}
      </div>
    </div>
  )
}

/* ── Array-tab inspector: full OpenSolar-style Panel Group depth ── */
function ArrayInspector({ design, sel, moduleId, setModuleId, onSelect, onUpdate, onFill, onClear, onDelete, targetKwp, setTargetKwp, onGoal, kwp, count }: {
  design: Design; sel: DesignPlane | undefined; moduleId: string; setModuleId: (v: string) => void; onSelect: (id: string) => void
  onUpdate: (id: string, patch: Partial<DesignPlane>, repack?: boolean) => void; onFill: (id: string) => void; onClear: (id: string) => void; onDelete: (id: string) => void
  targetKwp: string; setTargetKwp: (v: string) => void; onGoal: (g: LayoutGoal) => void; kwp: number; count: number
}) {
  const mod = moduleById(sel?.moduleId ?? moduleId)
  const rackingOpts: { id: RackingType; label: string }[] = [{ id: 'flush', label: 'Flush' }, { id: 'single-tilt', label: 'Single-tilt' }, { id: 'dual-tilt', label: 'Dual-tilt' }]
  return (
    <div className="w-[360px] shrink-0 rounded-card bg-surface border border-border flex flex-col overflow-hidden">
      {/* Goal-driven auto-layout */}
      <div className="p-3.5 border-b border-divider">
        <div className="eyebrow text-muted-3 mb-2">Ovi auto-layout</div>
        <button onClick={() => onGoal({ kind: 'max' })} className="w-full h-9 rounded-control text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2 mb-2" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Sparkle size={14} />Maximum coverage</button>
        <div className="flex items-center gap-2">
          <input value={targetKwp} onChange={(e) => setTargetKwp(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Target kWp" className="flex-1 h-9 px-3 rounded-control border border-input-border bg-white text-[13px] outline-none focus:border-accent" />
          <button onClick={() => { const v = parseFloat(targetKwp); if (v > 0) onGoal({ kind: 'target-kwp', kwp: v }) }} className="h-9 px-3.5 rounded-control border border-border text-[12.5px] font-semibold text-ink-3 hover:bg-control inline-flex items-center gap-1.5"><Bolt size={13} />Size it</button>
        </div>
        <div className="mt-2 text-[11.5px] text-muted-b flex items-center gap-1.5"><Target size={12} />Now: <b className="text-ink-2">{kwp || 0} kWp · {count} panels</b> — best-facing planes filled first.</div>
      </div>
      {/* Group list */}
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <div className="eyebrow text-muted-3">Panel groups</div>
        <span className="text-[11px] text-muted-2">{design.planes.length}</span>
      </div>
      <div className="px-2 flex flex-col gap-1 max-h-[26%] overflow-y-auto">
        {design.planes.map((p) => (
          <button key={p.id} onClick={() => onSelect(p.id)} className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 ${p.id === sel?.id ? 'bg-accent-wash-2 text-accent-700' : 'hover:bg-control text-ink-3'}`}>
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.id === sel?.id ? '#7C3AED' : '#00E5FF' }} />
            <span className="flex-1 truncate text-[12.5px] font-medium">{p.name}</span>
            <span className="text-[11px] tabular-nums text-muted-2">{p.panels?.length ?? 0}</span>
          </button>
        ))}
      </div>
      {/* Selected group depth */}
      <div className="flex-1 overflow-y-auto border-t border-divider mt-2">
        {!sel ? (
          <div className="p-4 text-[12.5px] text-muted-b">Select a panel group to edit its module, racking, orientation and spacing.</div>
        ) : (
          <div className="p-3.5 flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-[14px] text-ink truncate">{sel.name}</div>
              <button onClick={() => onDelete(sel.id)} className="text-muted-2 hover:text-negative text-[13px]">Delete</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Metric v={sel.panels?.length ? String(sel.panels.length) : '—'} u="modules" small />
              <Metric v={`${kwpOf(sel.panels?.length ?? 0, mod.watts)}`} u="kWp" small />
              <Metric v={`${Math.round(planeYieldFactor(sel) * 100)}%`} u="of ideal" small />
            </div>

            {/* Module */}
            <Field label="Module">
              <select value={sel.moduleId ?? moduleId} onChange={(e) => onUpdate(sel.id, { moduleId: e.target.value }, true)} className="w-full h-9 px-2 rounded-control border border-input-border bg-white text-[12.5px] outline-none focus:border-accent">
                {MODULES.map((m) => <option key={m.id} value={m.id}>{m.brand} {m.name} · {m.watts} W</option>)}
              </select>
              <div className="text-[11px] text-muted-2 mt-1">{mod.cell} · {mod.effPct}% · {mod.w}×{mod.h} m · £{mod.priceGbp}/panel · {mod.warrantyYr} yr</div>
            </Field>

            {/* Racking */}
            <Field label="Racking">
              <div className="grid grid-cols-3 gap-1.5">
                {rackingOpts.map((r) => {
                  const on = (sel.racking ?? 'flush') === r.id
                  return <button key={r.id} onClick={() => onUpdate(sel.id, { racking: r.id }, true)} className={`h-8 rounded-control text-[12px] font-semibold ${on ? 'text-white' : 'border border-border text-ink-3 hover:bg-control'}`} style={on ? { background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' } : undefined}>{r.label}</button>
                })}
              </div>
            </Field>

            {/* Orientation */}
            <Field label="Orientation">
              <div className="grid grid-cols-3 gap-1.5">
                {([['auto', 'Auto'], ['portrait', 'Portrait'], ['landscape', 'Landscape']] as const).map(([id, label]) => {
                  const cur = sel.orientation ?? 'auto'
                  const on = cur === id
                  return <button key={id} onClick={() => onUpdate(sel.id, { orientation: id === 'auto' ? undefined : (id as PanelOrientation) }, true)} className={`h-8 rounded-control text-[12px] font-semibold ${on ? 'text-white' : 'border border-border text-ink-3 hover:bg-control'}`} style={on ? { background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' } : undefined}>{label}</button>
                })}
              </div>
            </Field>

            <Slider label="Azimuth" value={sel.azimuthDeg} min={0} max={359} suffix="°" onChange={(v) => onUpdate(sel.id, { azimuthDeg: v })} />
            {(sel.racking ?? 'flush') === 'flush'
              ? <Slider label="Roof pitch" value={sel.pitchDeg} min={0} max={60} suffix="°" onChange={(v) => onUpdate(sel.id, { pitchDeg: v }, true)} />
              : <Slider label="Frame tilt" value={sel.tiltDeg ?? 10} min={5} max={35} suffix="°" onChange={(v) => onUpdate(sel.id, { tiltDeg: v })} />}
            <Slider label="Row gap" value={Math.round((sel.rowGapM ?? 0.02) * 100)} min={2} max={80} suffix=" cm" onChange={(v) => onUpdate(sel.id, { rowGapM: v / 100 }, true)} />
            <Slider label="Setback" value={Math.round((sel.setbackM ?? design.setbackM) * 100)} min={0} max={100} suffix=" cm" onChange={(v) => onUpdate(sel.id, { setbackM: v / 100 }, true)} />

            <label className="flex items-center justify-between text-[12.5px] text-ink-3">
              <span className="flex items-center gap-1.5"><Bolt size={13} className="text-muted-2" />Module optimisers</span>
              <input type="checkbox" checked={!!sel.optimisers} onChange={(e) => onUpdate(sel.id, { optimisers: e.target.checked })} className="accent-accent w-4 h-4" />
            </label>

            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => onFill(sel.id)} className="flex-1 h-9 rounded-control text-white text-[12.5px] font-semibold inline-flex items-center justify-center gap-1.5" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Grid size={13} />Fill this group</button>
              {sel.panels?.length ? <button onClick={() => onClear(sel.id)} className="h-9 px-3 rounded-control border border-border text-[12.5px] font-semibold text-muted-b hover:bg-control">Clear</button> : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Production tab: yield estimate + per-plane breakdown ── */
function ProductionPane({ design, moduleId, kwp, count, annualKwh }: { design: Design; moduleId: string; kwp: number; count: number; annualKwh: number }) {
  const region = regionYield(design.address)
  const specific = kwp ? Math.round(annualKwh / kwp) : 0
  return (
    <div className="absolute inset-0 overflow-y-auto px-5 py-5">
      <div className="max-w-[880px] mx-auto flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-3">
          <BigStat v={kwp ? `${kwp}` : '—'} u="kWp system" />
          <BigStat v={annualKwh ? annualKwh.toLocaleString() : '—'} u="kWh / year" />
          <BigStat v={specific ? `${specific}` : '—'} u="kWh / kWp (yield)" />
          <BigStat v={count ? String(count) : '—'} u="modules" />
        </div>
        <div className="rounded-card bg-surface border border-border p-4">
          <div className="flex items-center gap-2 mb-3"><Pie size={16} className="text-accent" /><div className="font-bold text-[14px] text-ink">Generation by roof plane</div><span className="ml-auto text-[12px] text-muted-b">{region.name} · {region.yield} kWh/kWp baseline</span></div>
          {design.planes.filter((p) => p.panels?.length).length === 0 ? (
            <div className="text-[13px] text-muted-b py-6 text-center">No panels placed yet — run <b>Ovi auto-layout</b> or fill a group in the Array tab.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {design.planes.filter((p) => p.panels?.length).map((p) => {
                const mod = moduleById(p.moduleId ?? moduleId); const n = p.panels!.length
                const pkwp = kwpOf(n, mod.watts); const factor = planeYieldFactor(p); const pkwh = Math.round(pkwp * region.yield * factor)
                const pct = annualKwh ? Math.round((pkwh / annualKwh) * 100) : 0
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <div className="w-40 shrink-0 text-[12.5px] font-medium text-ink-2 truncate">{p.name} <span className="text-muted-2">· {compass(p.azimuthDeg)} {effTilt(p)}°</span></div>
                    <div className="flex-1 h-6 rounded-md bg-control overflow-hidden"><div className="h-full rounded-md flex items-center px-2 text-[10.5px] font-bold text-white" style={{ width: `${Math.max(pct, 6)}%`, background: 'linear-gradient(90deg,#3B6BF5,#7C3AED)' }}>{pct}%</div></div>
                    <div className="w-32 shrink-0 text-right text-[12.5px] tabular-nums text-ink-2"><b>{pkwh.toLocaleString()}</b> kWh · {n}×</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="text-[11.5px] text-muted-b flex items-center gap-1.5"><Box size={12} />Estimate uses MCS regional yield × each plane's orientation/tilt factor. Shading &amp; inter-row losses refine this in a later pass.</div>
      </div>
    </div>
  )
}

/* ── Proposal tab: summary + handoff ── */
function ProposalPane({ design, kwp, count, annualKwh, onOpen, onConfirm }: { design: Design; kwp: number; count: number; annualKwh: number; onOpen: () => void; onConfirm: () => void }) {
  return (
    <div className="absolute inset-0 overflow-y-auto px-5 py-5">
      <div className="max-w-[720px] mx-auto flex flex-col gap-4">
        <div className="rounded-card bg-surface border border-border p-5">
          <div className="text-[12px] eyebrow text-muted-3">Design summary</div>
          <div className="text-[20px] font-bold text-ink mt-1">{design.name}</div>
          <div className="text-[13px] text-muted-b">{design.address}</div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <BigStat v={kwp ? `${kwp}` : '—'} u="kWp" />
            <BigStat v={count ? String(count) : '—'} u="modules" />
            <BigStat v={annualKwh ? annualKwh.toLocaleString() : '—'} u="kWh / yr" />
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button onClick={onConfirm} className="h-10 px-4 rounded-control text-white text-[13px] font-semibold inline-flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Check size={15} />Confirm design {design.status === 'confirmed' && '✓'}</button>
            <button onClick={onOpen} className="h-10 px-4 rounded-control border border-border text-[13px] font-semibold text-ink-3 hover:bg-control inline-flex items-center gap-2"><File size={15} />Open proposals</button>
          </div>
        </div>
        <div className="text-[11.5px] text-muted-b">Pricing, finance options and the branded PDF live in <b>Design → Proposals</b>. Confirming the design snapshots the kWp, module count and yield onto the deal.</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-[11px] font-semibold text-muted-b uppercase tracking-wide mb-1.5">{label}</div>{children}</div>
}
function BigStat({ v, u }: { v: string; u: string }) {
  return <div className="rounded-card bg-surface border border-border px-4 py-3.5"><div className="text-[24px] font-bold text-ink leading-none tabular-nums">{v}</div><div className="text-[11px] text-muted-b mt-1.5">{u}</div></div>
}
function ToolBtn({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} title={label} className={`h-8 w-[168px] px-2.5 rounded-[8px] text-[12.5px] font-semibold inline-flex items-center gap-2 ${on ? 'text-white' : 'text-ink-3 hover:bg-control'}`} style={on ? { background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' } : undefined}><span className="w-4 flex justify-center shrink-0">{icon}</span>{label}</button>
  )
}
// Tiny inline glyphs for the tools the icon set doesn't cover (cursor / eraser / rotate).
function CursorIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3l7 17 2.5-6.5L20 11 4 3z" /></svg> }
function EraseIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 21h13" /><path d="M4.5 15.5l6-6 5 5-4.5 4.5H8l-3.5-3.5z" /><path d="M10.5 9.5l5-5 4 4-5 5" /></svg> }
function RotateIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v5h-5" /></svg> }
function Metric({ v, u, small, hero }: { v: string; u: string; small?: boolean; hero?: boolean }) {
  return <div className={`rounded-lg bg-control ${small ? 'py-1' : 'py-2'}`}><div className={`${small ? 'text-[12px]' : hero ? 'text-[18px]' : 'text-[16px]'} font-bold text-ink leading-none`}>{v}</div><div className="text-[8.5px] text-muted-2 mt-1 uppercase tracking-wide">{u}</div></div>
}
function Slider({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-[11.5px] text-muted-b">
      <span className="w-16 shrink-0">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)} className="flex-1 accent-accent" onClick={(e) => e.stopPropagation()} />
      <b className="text-ink-2 w-12 text-right tabular-nums">{value}{suffix}</b>
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
