import { HomeEnergy } from '../components/HomeEnergy'
import { BatteryDesigner } from '../components/BatteryDesigner'
import { EvDesigner } from '../components/EvDesigner'
import { ScopePicker } from '../components/ScopePicker'
import { scopeOf } from '../lib/homeSystem'
import { designPrice } from '../lib/designPrice'
import { McsProduction, estimateDesign } from '../components/McsProduction'
import { systemPrice } from '../lib/finance'
import { Savings } from '../components/Savings'
import { Electrical } from '../components/Electrical'
import { KitList } from '../components/KitList'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import { TopBar } from '../components/TopBar'
import { Button } from '../components/ui'
import { Sun, Radar, Check, Person, Layers, Target, Sparkle, Plus, Grid, Wrench, Bolt, Pie, File, Box, Home } from '../components/icons'
import { useActions, useState_ } from '../store/store'
import { geocodeLocation } from '../lib/commercialFinder'
import { detectPlanes, slopedAreaM2, totalRoofArea, compass, polygonAreaM2 } from '../lib/design'
import { MODULES, moduleById, packWithSettings, autoLayout, kwpOf, planeSolarFactor, planeQuality, planeGrid, type Module, type LayoutGoal, type GridCell } from '../lib/panels'
import { regionYield, fetchBuildingHeight, fetchBuildingFootprint } from '../lib/solar'
import { fetchRgbOverlay, fetchBuildingOutline } from '../lib/dsm'
import { detectRoofPanes, resplitRoof, roofStyleOf, ASSUMED_PITCH, type RoofStyle } from '../lib/roofPanes'
import { parseDesignBrief } from '../lib/oviDesign'
import { designIntentFromClaude } from '../lib/oviDesignAI'
import { Design3D } from '../components/Design3D'
import { PanelCanvasLayer } from '../components/PanelCanvas'
import { DesignCopilot } from '../components/DesignCopilot'
import { EnergyPanel } from '../components/EnergyPanel'
import type { Design, DesignObstacle, DesignObstacleKind, DesignPanel, DesignPlane, PanelOrientation, RackingType } from '../store/types'
import { Dropdown } from '../components/Dropdown'
import { tidyPolygon, paneQuality, tidyRoofLL } from '../lib/paneShape'
import { oviDesign, type OviGoal, type OviResult } from '../lib/oviLayout'
import { mergeFaces, neighbours } from '../lib/faceOps'

type LatLng = { lat: number; lng: number }
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
type StudioTab = 'design' | 'array' | 'home' | 'battery' | 'ev' | 'production' | 'savings' | 'electrical' | 'kit' | 'proposal'
// Pylon-style 2D tools: select/move arrays · add · remove · rotate array · draw face · edit vertices
type Tool = 'pan' | 'select' | 'add' | 'remove' | 'rotate' | 'draw' | 'edit' | 'pin' | 'note'

// Obstruction styling — colour + label per kind (detected or hand-placed keep-outs).
const OBST: Record<'chimney' | 'skylight' | 'hvac' | 'keepout', { c: string; label: string }> = {
  chimney: { c: '#F97316', label: 'Chimney' },
  hvac: { c: '#EF4444', label: 'HVAC / plant' },
  skylight: { c: '#38BDF8', label: 'Skylight' },
  keepout: { c: '#F59E0B', label: 'Keep-out' },
}

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

const DEGr = Math.PI / 180
const mLngAt = (lat: number) => 111320 * Math.cos(lat * DEGr)
/** Rotate a panel's corners about a centre by delta radians (metric-accurate). */
function rotateCorners(corners: LatLng[], c: LatLng, delta: number): LatLng[] {
  const mLat = 110540, mLng = mLngAt(c.lat), ca = Math.cos(delta), sa = Math.sin(delta)
  return corners.map((p) => {
    const ex = (p.lng - c.lng) * mLng, ny = (p.lat - c.lat) * mLat
    return { lat: c.lat + (ex * sa + ny * ca) / mLat, lng: c.lng + (ex * ca - ny * sa) / mLng }
  })
}
/** Translate corners by a lat/lng delta. */
const translateCorners = (corners: LatLng[], dLat: number, dLng: number): LatLng[] => corners.map((p) => ({ lat: p.lat + dLat, lng: p.lng + dLng }))
/** Metric bearing (rad) from a centre to a point. */
const bearingTo = (c: LatLng, ll: { lat: number; lng: number }) => Math.atan2((ll.lat - c.lat) * 110540, (ll.lng - c.lng) * mLngAt(c.lat))
/** A panel's own bearing (rad) — the direction of its first edge. */
const panelAngle = (corners: LatLng[]) => Math.atan2((corners[1].lat - corners[0].lat) * 110540, (corners[1].lng - corners[0].lng) * mLngAt(corners[0].lat))
/** Do two panel quads overlap? Corner-containment either way — enough for near-equal rectangles. */
const anyCornerInside = (p: LatLng[], q: LatLng[]) => p.some((c) => pointInRing(q, c))
const quadsOverlap = (a: LatLng[], b: LatLng[]) => anyCornerInside(a, b) || anyCornerInside(b, a)
// A circular-arrow "rotate" cursor shown when hovering a selection's corner node / rotate handle.
const ROTATE_CURSOR = (() => {
  try { const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#62E4CC" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v5h-5"/></svg>`; return `url("data:image/svg+xml;base64,${btoa(svg)}") 13 13, auto` } catch { return 'grab' }
})()

/** Effective generating tilt — tilt-racking on a flat roof beats the flat pitch. */
function effTilt(p: DesignPlane): number { return p.racking && p.racking !== 'flush' ? (p.tiltDeg ?? 10) : p.pitchDeg }
function planeYieldFactor(p: DesignPlane): number { return planeSolarFactor({ azimuthDeg: p.azimuthDeg, pitchDeg: effTilt(p) }) }

export function DesignEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const act = useActions()
  const { designs, deals, showroom, studioConfig } = useState_()
  const design = designs.find((d) => d.id === id)

  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const planeLayer = useRef<L.LayerGroup | null>(null)
  const panelLayer = useRef<L.LayerGroup | null>(null)
  const ghostLayer = useRef<L.LayerGroup | null>(null)
  const previewLayer = useRef<L.LayerGroup | null>(null) // suggested-layout ghosts, click to drop one before accepting
  const detectingRef = useRef(false) // StrictMode mounts twice — without this, auto-detect ran (and toasted) twice
  const rgbLayer = useRef<L.ImageOverlay | null>(null)
  const gTiles = useRef<L.TileLayer | null>(null)
  const aerialKey = useRef<string | null>(null)
  const fittedRef = useRef<string | null>(null) // last framed design:planeCount — refit on structure change only
  const undoStack = useRef<DesignPlane[][]>([])
  const redoStack = useRef<DesignPlane[][]>([])
  const undoRef = useRef<() => void>(() => {})
  const redoRef = useRef<() => void>(() => {})
  const onPinRef = useRef<(ll: LatLng) => void>(() => {})
  const onNoteRef = useRef<(ll: LatLng) => void>(() => {})
  const [noteDraft, setNoteDraft] = useState<{ lat: number; lng: number; text: string } | null>(null)
  const panelRenderer = useRef<L.Canvas | null>(null)
  const panelCanvas = useRef<PanelCanvasLayer | null>(null) // photoreal module renderer
  const obstacleLayer = useRef<L.LayerGroup | null>(null)
  const measureLayer = useRef<L.LayerGroup | null>(null)
  const editMeasureLayer = useRef<L.LayerGroup | null>(null) // live edge/area labels shown while dragging a vertex
  const designRef = useRef(design)
  designRef.current = design

  const [tab, setTab] = useState<StudioTab>('design')
  const [scopeOpen, setScopeOpen] = useState(false)
  const [seeThrough, setSeeThrough] = useState(false) // X — panels translucent so the roof shows through
  // Never sit on a step the scope doesn't have (e.g. the roof tabs on a battery-only retrofit).
  useEffect(() => {
    if (!design) return
    const s = scopeOf(design)
    const gone = ((tab === 'design' || tab === 'array' || tab === 'production' || tab === 'electrical') && !s.pv) || (tab === 'battery' && !s.battery) || (tab === 'ev' && !s.ev)
    if (gone) setTab(s.pv ? 'design' : 'home')
  }, [design?.scope, tab]) // eslint-disable-line react-hooks/exhaustive-deps
  const [mapReady, setMapReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [selId, setSelId] = useState<string | null>(null)
  const [selObsId, setSelObsId] = useState<string | null>(null)
  const selObsRef = useRef<string | null>(null); selObsRef.current = selObsId
  const [selPanelIds, setSelPanelIds] = useState<string[]>([])
  const selPanelRef = useRef<string[]>([]); selPanelRef.current = selPanelIds
  const selIdRef = useRef<string | null>(null); selIdRef.current = selId
  // Corner editing for ONE face (double-click it) — replaces the old global "Edit vertices" mode.
  const [editPlaneId, setEditPlaneId] = useState<string | null>(null)
  const editPlaneRef = useRef<string | null>(null); editPlaneRef.current = editPlaneId
  // Right-click menu: what was under the pointer, and where to draw the menu.
  const [ctx, setCtx] = useState<{ x: number; y: number; ll: LatLng; pid?: string; panelId?: string } | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [ghostN, setGhostN] = useState<number | null>(null)
  const [preview, setPreview] = useState<{ planes: DesignPlane[]; removed: Set<string> } | null>(null)
  // "Preview Ovi's design": the goal picked, and what Ovi decided face by face (drives the review card)
  const [ovi, setOvi] = useState<{ goal: 'max' | 'kwp' | 'usage'; kwp: number; result: OviResult } | null>(null)
  const [oviMin, setOviMin] = useState(false)
  const [rotDeg, setRotDeg] = useState<number | null>(null)
  const [hdReady, setHdReady] = useState(false)
  const [hdOn, setHdOn] = useState(true)
  const rootRef = useRef<HTMLDivElement>(null)
  const [isFs, setIsFs] = useState(false)
  const boundaryLayer = useRef<L.LayerGroup | null>(null)
  const [boundaryOn, setBoundaryOn] = useState(true) // title boundary on by default (Land Registry INSPIRE)
  const [measureOn, setMeasureOn] = useState(false)
  const [boundaryInfo, setBoundaryInfo] = useState<{ source: 'inspire' | 'footprint'; found: boolean } | null>(null)
  const [, setHistTick] = useState(0) // bump re-renders so undo/redo buttons re-evaluate enablement
  const [moduleId, setModuleId] = useState('m440')
  // draw/edit are geoman modes; add/remove/move/rotate are our own roof-grid tools
  const drawing = tool === 'draw', editing = tool === 'edit', adding = tool === 'add'
  const toolRef = useRef(tool); toolRef.current = tool
  const moduleIdRef = useRef(moduleId); moduleIdRef.current = moduleId
  const commitRef = useRef<(planes: DesignPlane[]) => void>(() => {})
  const selectArrayRef = useRef<(ll: LatLng) => boolean>(() => false)
  const tidyRef = useRef<(ids?: string[], opts?: { silent?: boolean }) => void>(() => {})
  const autoTidied = useRef<string | null>(null)
  const [view, setView] = useState<'2d' | '3d'>('2d')
  const [targetKwp, setTargetKwp] = useState<string>('')
  const [oviOpen, setOviOpen] = useState(false)
  const module = moduleById(moduleId)
  const canvasVisible = tab === 'design' || tab === 'array'

  // ── Map init (once) ──
  useEffect(() => {
    if (map.current || !mapEl.current) return
    const m = L.map(mapEl.current, { center: [52.6, -1.9], zoom: 6, maxZoom: 23, zoomControl: false, attributionControl: false, doubleClickZoom: false })
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 23, maxNativeZoom: 19 }).addTo(m)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom: 23, maxNativeZoom: 19, opacity: 0.9 }).addTo(m)
    panelRenderer.current = L.canvas({ padding: 0.5 })
    panelLayer.current = L.layerGroup().addTo(m)
    planeLayer.current = L.layerGroup().addTo(m)
    obstacleLayer.current = L.layerGroup().addTo(m)
    measureLayer.current = L.layerGroup().addTo(m)
    editMeasureLayer.current = L.layerGroup().addTo(m)
    ghostLayer.current = L.layerGroup().addTo(m)
    previewLayer.current = L.layerGroup().addTo(m)
    boundaryLayer.current = L.layerGroup().addTo(m)
    // Dedicated pane for the Google high-res aerial overlay: above the base tiles, below the vectors.
    m.createPane('rgb'); const rp = m.getPane('rgb'); if (rp) { rp.style.zIndex = '250'; rp.style.pointerEvents = 'none' }
    // Modules draw on their own canvas just above the roof faces, below ghosts/handles.
    m.createPane('panels'); const pp = m.getPane('panels'); if (pp) { pp.style.zIndex = '405'; pp.style.pointerEvents = 'none' }
    panelCanvas.current = new PanelCanvasLayer().addTo(m)
    m.pm.setGlobalOptions({ snappable: true, snapDistance: 16, allowSelfIntersection: false })
    m.pm.setPathOptions({ color: '#62E4CC', fillColor: '#62E4CC', fillOpacity: 0.24 })
    m.on('pm:create', (e: any) => {
      const ring = (e.layer.getLatLngs()[0] as L.LatLng[]).map((p) => ({ lat: p.lat, lng: p.lng }))
      e.layer.remove()
      addManualPlane(ring)
      m.pm.disableDraw(); setTool('select')
    })
    // ── Live dimensions while editing a roof face — every edge length + the face area follow the vertex
    //    you're dragging in real time, so you can shape the plane precisely against the imagery. ──
    const lbl = (lat: number, lng: number, text: string, area = false) => L.marker([lat, lng], {
      interactive: false, pmIgnore: true, keyboard: false,
      icon: L.divIcon({ className: '', html: `<div style="transform:translate(-50%,-50%);white-space:nowrap;font:700 11px/1 system-ui;color:#fff;background:${area ? 'rgba(21,34,59,.96)' : 'rgba(10,14,23,.9)'};padding:2px 5px;border-radius:5px;box-shadow:0 1px 3px rgba(0,0,0,.45)">${text}</div>`, iconSize: [0, 0] }),
    })
    const drawLiveEdges = (layer: any) => {
      const el = editMeasureLayer.current; if (!el) return; el.clearLayers()
      const lls = (layer?.getLatLngs?.()[0] || []) as L.LatLng[]
      if (lls.length < 2) return
      const mLat = 110540, mLng = 111320 * Math.cos((lls[0].lat * Math.PI) / 180)
      for (let i = 0; i < lls.length; i++) {
        const a = lls[i], b = lls[(i + 1) % lls.length]
        const len = Math.hypot((b.lng - a.lng) * mLng, (b.lat - a.lat) * mLat)
        if (len < 0.25) continue
        lbl((a.lat + b.lat) / 2, (a.lng + b.lng) / 2, `${len.toFixed(2)} m`).addTo(el)
      }
      const ring = lls.map((p) => ({ lat: p.lat, lng: p.lng }))
      const c = ring.reduce((s, v) => ({ lat: s.lat + v.lat / ring.length, lng: s.lng + v.lng / ring.length }), { lat: 0, lng: 0 })
      lbl(c.lat, c.lng, `${Math.round(polygonAreaM2(ring))} m² plan`, true).addTo(el)
    }
    m.on('pm:markerdragstart', (e: any) => drawLiveEdges(e.layer))
    m.on('pm:markerdrag', (e: any) => drawLiveEdges(e.layer))
    m.on('pm:markerdragend', () => editMeasureLayer.current?.clearLayers())
    m.on('pm:vertexadded', (e: any) => drawLiveEdges(e.layer))
    m.on('pm:vertexremoved', (e: any) => drawLiveEdges(e.layer))

    // ── Roof-grid tools: place / remove / move / rotate arrays. Everything snaps to the plane's own
    //    module grid (indexed by row,col) so panels always stay aligned and inside the setback. ──
    let startCell: GridCell | null = null, dragCells: GridCell[] = [], dragPid: string | null = null, moved = false
    let moveOccupied: GridCell[] = [] // select-tool: the array's current cells, dragged as a block
    // Rotate-array: spin the EXISTING panels as a rigid group about their centroid (never a repack).
    let rotPid: string | null = null, rotPanels0: DesignPanel[] = [], rotCenLL: LatLng | null = null, rotBear0 = 0
    const cellKey = (c: GridCell) => `${c.row},${c.col}`
    const arrayCentroid = (pans: DesignPanel[]): LatLng => { const cs = pans.map((pn) => panelCenter(pn)); return { lat: cs.reduce((s, c) => s + c.lat, 0) / cs.length, lng: cs.reduce((s, c) => s + c.lng, 0) / cs.length } }
    const planeAt = (ll: L.LatLng) => designRef.current?.planes.find((p) => pointInRing(p.polygon, { lat: ll.lat, lng: ll.lng }))
    // Manual placement uses NO setback — you can drop panels right to the roof edge (Pylon-style). A
    // fire setback, if wanted, is a per-plane slider that only trims auto-fill, never manual placement.
    const gridFor = (p: DesignPlane) => planeGrid(p.polygon, moduleById(p.moduleId ?? moduleIdRef.current), { orientation: p.orientation ?? 'portrait', setback: 0, rowGap: p.rowGapM, gap: p.panelGapM, angleDeg: p.arrayAngleDeg, pitchDeg: p.racking && p.racking !== 'flush' ? (p.tiltDeg ?? 10) : p.pitchDeg, azimuthDeg: p.azimuthDeg })
    // Ghost styling — draw intended modules as real panels (dark glass + a thin intent-coloured frame)
    // so the preview reads exactly like what will land. Purple = place, teal = move, red = clear.
    const GH: Record<string, { frame: string; glass: string; fill: number; weight: number }> = {
      add: { frame: '#62E4CC', glass: '#15223B', fill: 0.78, weight: 1.6 },
      move: { frame: '#62E4CC', glass: '#62E4CC', fill: 0.16, weight: 2 }, // light teal outline — the originals fade underneath
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
    const GRID_HINT = { color: '#E6F2FF', weight: 0.8, opacity: 0.5, dashArray: '2 3', fill: false }
    const drawAddHover = (p: DesignPlane, grid: GridCell[], nearest: GridCell | null) => {
      const g = ghostLayer.current!; g.clearLayers()
      // only the open slots near the cursor — a quiet local hint, not a grid over the whole roof
      const near = (c: GridCell) => !nearest || (Math.abs(c.center.lat - nearest.center.lat) * 110540 < 3.2 && Math.abs(c.center.lng - nearest.center.lng) * mLngAt(c.center.lat) < 3.2)
      grid.forEach((c) => { if (!hasPanelAt(p, c) && near(c)) cellPoly(c, GRID_HINT).addTo(g) })
      if (nearest) { const s = GH.add; cellPoly(nearest, { color: s.frame, weight: s.weight, fillColor: s.glass, fillOpacity: s.fill }).addTo(g) }
    }
    const drawGhostSet = (sets: LatLng[][], kind: keyof typeof GH = 'move') => {
      const g = ghostLayer.current!; g.clearLayers(); const s = GH[kind]
      sets.forEach((corners) => L.polygon(corners.map((v) => [v.lat, v.lng]) as [number, number][], { renderer: panelRenderer.current!, pmIgnore: true, interactive: false, color: s.frame, weight: s.weight, fillColor: s.glass, fillOpacity: s.fill } as any).addTo(g))
    }

    // ── Selection & free manipulation (Pylon-style). A selection is a SET of panels (1 = a single
    //    module, many = a marquee'd array). Drag inside the box to move the whole set, drag a corner
    //    node or the rotate handle to spin it, Del to remove. Drag empty roof = marquee-select. ──
    type GrpItem = { pid: string; panelId: string; corners0: LatLng[] }
    let grp: { items: GrpItem[]; center: LatLng } | null = null
    let grpMode: 'move' | 'rotate' | null = null
    let grpStart: L.LatLng | null = null, grpRot0 = 0, grpInvalid = false
    let marqStart: L.LatLng | null = null
    let marqPid: string | null = null, marqAdd = false, pendingToggle: string | null = null
    // Working on a face locks everything else: while a face is selected only ITS panels can be hit, dragged or
    // box-selected — panels on the neighbouring faces can't be grabbed by accident. Click another face to switch.
    const findPanelAt = (ll: { lat: number; lng: number }, any = false) => {
      const planes = designRef.current?.planes ?? [], lock = any ? null : selIdRef.current
      for (let i = planes.length - 1; i >= 0; i--) { if (lock && planes[i].id !== lock) continue; const pans = planes[i].panels ?? []; for (let j = pans.length - 1; j >= 0; j--) if (pointInRing(pans[j].corners, ll)) return { pid: planes[i].id, panel: pans[j] } }
      return null
    }
    // the whole array a panel belongs to: every panel on the face joined to it (corners within 30 cm), transitively
    const arrayOf = (pid: string, panelId: string): string[] => {
      const pans = designRef.current?.planes.find((x) => x.id === pid)?.panels ?? []
      const mLat = 110540, mLng = mLngAt(pans[0]?.corners[0].lat ?? 52)
      const touch = (a: DesignPanel, b: DesignPanel) => a.corners.some((u) => b.corners.some((v) => Math.hypot((u.lat - v.lat) * mLat, (u.lng - v.lng) * mLng) < 0.3))
      const out = new Set([panelId]), queue = [panelId]
      while (queue.length) { const cur = pans.find((x) => x.id === queue.pop()); if (!cur) continue; for (const o of pans) if (!out.has(o.id) && touch(cur, o)) { out.add(o.id); queue.push(o.id) } }
      return [...out]
    }
    selectArrayRef.current = (ll: LatLng) => { const hit = findPanelAt(ll, true); if (!hit) return false; setSelId(hit.pid); setSelPanelIds(arrayOf(hit.pid, hit.panel.id)); return true }
    const selectionItems = () => { const ids = new Set(selPanelRef.current); const out: { pid: string; panel: DesignPanel }[] = []; for (const p of designRef.current?.planes ?? []) for (const pn of p.panels ?? []) if (ids.has(pn.id)) out.push({ pid: p.id, panel: pn }); return out }
    const panelsOutside = (ids: Set<string>) => (designRef.current?.planes.flatMap((p) => p.panels ?? []) ?? []).filter((pn) => !ids.has(pn.id))
    // Oriented bounding box of the current selection, aligned to the first panel's angle (so a joined
    // array's nodes sit at the ARRAY's ends, and a lone panel's nodes sit on its own corners).
    const selectionBox = (): { corners: LatLng[]; center: LatLng } | null => {
      const items = selectionItems(); if (!items.length) return null
      const angle = panelAngle(items[0].panel.corners), c0 = items[0].panel.corners[0]
      const mLat = 110540, mLng = mLngAt(c0.lat), ca = Math.cos(angle), sa = Math.sin(angle)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const { panel } of items) for (const v of panel.corners) {
        const ex = (v.lng - c0.lng) * mLng, ny = (v.lat - c0.lat) * mLat
        const rx = ex * ca + ny * sa, ry = -ex * sa + ny * ca // rotate by -angle → axis-aligned frame
        minX = Math.min(minX, rx); maxX = Math.max(maxX, rx); minY = Math.min(minY, ry); maxY = Math.max(maxY, ry)
      }
      const back = (rx: number, ry: number): LatLng => ({ lat: c0.lat + (rx * sa + ry * ca) / mLat, lng: c0.lng + (rx * ca - ry * sa) / mLng })
      return { corners: [back(minX, minY), back(maxX, minY), back(maxX, maxY), back(minX, maxY)], center: back((minX + maxX) / 2, (minY + maxY) / 2) }
    }
    const boxHandlePt = (corners: LatLng[]) => { const pts = corners.map((c) => m.latLngToContainerPoint([c.lat, c.lng])); const minx = Math.min(...pts.map((p) => p.x)), maxx = Math.max(...pts.map((p) => p.x)), miny = Math.min(...pts.map((p) => p.y)); return L.point((minx + maxx) / 2, miny - 24) }
    const startGroupWith = (items: GrpItem[], mode: 'move' | 'rotate', ll: L.LatLng) => {
      const cs = items.map((i) => panelCenter({ corners: i.corners0 }))
      const center = { lat: cs.reduce((s, c) => s + c.lat, 0) / cs.length, lng: cs.reduce((s, c) => s + c.lng, 0) / cs.length }
      grp = { items, center }; grpMode = mode; grpStart = ll; grpRot0 = bearingTo(center, ll); m.dragging.disable()
      panelCanvas.current?.setDim(items.map((i) => i.panelId)) // originals fade; the light preview shows where they'll land
    }
    const startGroup = (mode: 'move' | 'rotate', ll: L.LatLng) => { const items = selectionItems(); if (!items.length) return; startGroupWith(items.map((i) => ({ pid: i.pid, panelId: i.panel.id, corners0: i.panel.corners })), mode, ll) }
    // Magnetic align: nudge a move so the selection snaps onto the NEAREST other panel's module lattice
    // (edge-to-edge with a standard gap) — the "suggested placement" that lines panels up neatly.
    const snapMove = (dLat: number, dLng: number): [number, number] => {
      if (!grp) return [dLat, dLng]
      const ids = new Set(grp.items.map((i) => i.panelId)); const others = panelsOutside(ids); if (!others.length) return [dLat, dLng]
      const ref0 = panelCenter({ corners: grp.items[0].corners0 }); const refC = { lat: ref0.lat + dLat, lng: ref0.lng + dLng }
      let N: DesignPanel | null = null, bd = Infinity
      for (const pn of others) { const c = panelCenter(pn); const d2 = (c.lat - refC.lat) ** 2 + (c.lng - refC.lng) ** 2; if (d2 < bd) { bd = d2; N = pn } }
      if (!N) return [dLat, dLng]
      const Nc = panelCenter(N), Na = panelAngle(N.corners), mLat = 110540, mLng = mLngAt(Nc.lat), ca = Math.cos(Na), sa = Math.sin(Na)
      const edgeU = Math.hypot((N.corners[1].lng - N.corners[0].lng) * mLng, (N.corners[1].lat - N.corners[0].lat) * mLat)
      const edgeV = Math.hypot((N.corners[2].lng - N.corners[1].lng) * mLng, (N.corners[2].lat - N.corners[1].lat) * mLat)
      const GAP = 0.02, pu = edgeU + GAP, pv = edgeV + GAP, SNAP = 0.32
      const ex = (refC.lng - Nc.lng) * mLng, ny = (refC.lat - Nc.lat) * mLat
      const du = ex * ca + ny * sa, dv = -ex * sa + ny * ca
      const su = Math.round(du / pu) * pu, sv = Math.round(dv / pv) * pv
      const adu = Math.abs(du - su) < SNAP ? su : du, adv = Math.abs(dv - sv) < SNAP ? sv : dv
      if (adu === du && adv === dv) return [dLat, dLng]
      const nex = adu * ca - adv * sa, nny = adu * sa + adv * ca
      return [dLat + (Nc.lat + nny / mLat - refC.lat), dLng + (Nc.lng + nex / mLng - refC.lng)]
    }
    const drawGroupGhost = (transform: (c: LatLng[]) => LatLng[], checkOverlap: boolean) => {
      const outside = checkOverlap ? panelsOutside(new Set(grp!.items.map((i) => i.panelId))) : []
      const sets = grp!.items.map((i) => transform(i.corners0))
      grpInvalid = checkOverlap && sets.some((s) => outside.some((pn) => quadsOverlap(s, pn.corners)))
      drawGhostSet(sets, grpInvalid ? 'bad' : 'move')
    }

    let painting = false // select tool, shift-drag on the selected face: paint a block of panels
    let pendingAdd: { cp: L.Point } | null = null // pressed on open roof of the selected face: a click adds a panel, a drag becomes a box-select
    m.on('mousedown', (e: any) => {
      setCtx(null)
      if (e.originalEvent?.button === 2) return // right button → context menu, never a drag
      // a press on the map never starts a browser text/image selection (the blue wash across the page)
      try { (document.activeElement as HTMLElement | null)?.blur?.(); window.getSelection()?.removeAllRanges() } catch { /* */ }
      if (editPlaneRef.current) return // reshaping a face — geoman owns the pointer
      const t = toolRef.current; const p = planeAt(e.latlng)
      if (t === 'pin') { L.DomEvent.stop(e); onPinRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }); return }
      if (t === 'note') { L.DomEvent.stop(e); onNoteRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }); return }
      if (t === 'rotate') {
        if (!p || !p.panels?.length) return; setSelId(p.id)
        rotPid = p.id; rotPanels0 = p.panels; rotCenLL = arrayCentroid(p.panels); rotBear0 = bearingTo(rotCenLL, { lat: e.latlng.lat, lng: e.latlng.lng })
        m.dragging.disable(); L.DomEvent.stop(e); return
      }
      if (t === 'add' || t === 'remove') {
        if (!p) return
        dragPid = p.id; dragCells = gridFor(p); startCell = nearestCell(dragCells, e.latlng); moved = false
        m.dragging.disable(); L.DomEvent.stop(e); return
      }
      if (t === 'select') {
        const ll = { lat: e.latlng.lat, lng: e.latlng.lng }
        const box = selectionBox(), cp = m.latLngToContainerPoint(e.latlng)
        // 1) rotate handle above the selection, or one of its corner nodes → rotate the whole set
        if (box && (cp.distanceTo(boxHandlePt(box.corners)) < 16 || box.corners.some((c) => cp.distanceTo(m.latLngToContainerPoint([c.lat, c.lng])) < 12))) { startGroup('rotate', e.latlng); L.DomEvent.stop(e); return }
        // 2) inside the current selection box → move the whole set
        if (box && selPanelRef.current.length && pointInRing(box.corners, ll)) { startGroup('move', e.latlng); L.DomEvent.stop(e); return }
        // 3) a panel under the cursor → select just it, then free-drag it
        const hit = findPanelAt(ll)
        const shift = !!e.originalEvent?.shiftKey
        const ctrl = !!(e.originalEvent?.ctrlKey || e.originalEvent?.metaKey)
        if (hit) {
          e.originalEvent?.preventDefault?.()
          if (ctrl) { const cur = selPanelRef.current; setSelPanelIds(cur.includes(hit.panel.id) ? cur.filter((x) => x !== hit.panel.id) : [...cur, hit.panel.id]); setSelId(hit.pid); L.DomEvent.stop(e); return }
          if (shift) { pendingToggle = hit.panel.id; marqStart = e.latlng; marqPid = hit.pid; marqAdd = true; m.dragging.disable(); L.DomEvent.stop(e); return }
          setSelPanelIds([hit.panel.id]); setSelId(hit.pid); startGroupWith([{ pid: hit.pid, panelId: hit.panel.id, corners0: hit.panel.corners }], 'move', e.latlng); L.DomEvent.stop(e); return
        }
        // 4) open roof on the face you're working on: a click drops one panel, a drag box-selects panels
        //    (the standard design-tool gesture), and shift-drag paints a block of new panels
        if (p && p.id === selIdRef.current) {
          dragPid = p.id; dragCells = gridFor(p); startCell = nearestCell(dragCells, e.latlng); moved = false
          if (shift && !(p.panels ?? []).length) painting = true
          else if (shift) { marqStart = e.latlng; marqPid = p.id; marqAdd = true } // shift-drag on a face with panels = add to the selection
          else { pendingAdd = { cp: m.latLngToContainerPoint(e.latlng) }; marqStart = e.latlng; marqPid = p.id; marqAdd = false; setSelPanelIds([]) }
          m.dragging.disable(); L.DomEvent.stop(e); return
        }
        // 5) another face → select it (dragging from here box-selects panels); shift-drag box-selects anywhere
        if (p || shift) {
          setSelPanelIds([]); if (p) { setSelId(p.id); setSelObsId(null) }
          marqStart = e.latlng; marqPid = p?.id ?? null; marqAdd = false; m.dragging.disable(); L.DomEvent.stop(e); return
        }
        // 6) open ground → Leaflet pans the map on drag; a plain click clears the selection ('click' below)
      }
    })
    m.on('mousemove', (e: any) => {
      const t = toolRef.current
      if (t === 'rotate' && rotPid && rotCenLL) {
        const delta = bearingTo(rotCenLL, e.latlng) - rotBear0
        setRotDeg(Math.round((((-delta * 180) / Math.PI) % 360 + 360) % 360))
        drawGhostSet(rotPanels0.map((pn) => rotateCorners(pn.corners, rotCenLL!, delta)), 'move')
        return
      }
      if ((t === 'add' || t === 'remove' || painting) && dragPid && startCell) {
        const cur = nearestCell(dragCells, e.latlng); if (!cur) return
        if (cur.row !== startCell.row || cur.col !== startCell.col) moved = true
        const pl = designRef.current?.planes.find((x) => x.id === dragPid)
        const block = cellBlock(dragCells, startCell, cur).filter((c) => t === 'remove' || !pl || !hasPanelAt(pl, c))
        drawGhosts(block, t === 'remove' ? 'remove' : 'add'); setGhostN(block.length); return
      }
      if (t === 'select' && grpMode && grp) {
        if (grpMode === 'move' && grpStart) { const [sd1, sd2] = snapMove(e.latlng.lat - grpStart.lat, e.latlng.lng - grpStart.lng); drawGroupGhost((c) => translateCorners(c, sd1, sd2), true) }
        else if (grpMode === 'rotate') { const delta = bearingTo(grp.center, e.latlng) - grpRot0; setRotDeg(Math.round((((-delta * 180) / Math.PI) % 360 + 360) % 360)); drawGroupGhost((c) => rotateCorners(c, grp!.center, delta), false) }
        return
      }
      if (t === 'select' && pendingAdd && pendingAdd.cp.distanceTo(e.containerPoint) > 6) pendingAdd = null // moved → it's a box-select
      if (t === 'select' && pendingAdd) return
      if (t === 'select' && marqStart) { // marquee rectangle
        const a = marqStart, b = e.latlng
        const g = ghostLayer.current!; g.clearLayers()
        L.polygon([[a.lat, a.lng], [a.lat, b.lng], [b.lat, b.lng], [b.lat, a.lng]] as [number, number][], { renderer: panelRenderer.current!, pmIgnore: true, interactive: false, color: '#62E4CC', weight: 1.4, dashArray: '5 3', fillColor: '#62E4CC', fillOpacity: 0.08 } as any).addTo(g)
        return
      }
      if (t === 'select' && !grpMode && !marqStart) {
        // Idle hover says what a click will do: rotate (selection corners/handle), move (a panel),
        // add (open roof on the face you're working on — a ghost module shows where it lands),
        // select (any other face), or pan (open ground).
        if (editPlaneRef.current) return
        const ll = { lat: e.latlng.lat, lng: e.latlng.lng }, box = selectionBox(); let cur = ''
        if (box) { const cp = m.latLngToContainerPoint(e.latlng); if (box.corners.some((c) => cp.distanceTo(m.latLngToContainerPoint([c.lat, c.lng])) < 12) || cp.distanceTo(boxHandlePt(box.corners)) < 16) cur = ROTATE_CURSOR; else if (selPanelRef.current.length && pointInRing(box.corners, ll)) cur = 'move' }
        const hovHit = findPanelAt(ll); panelCanvas.current?.setHover(hovHit?.panel.id ?? null)
        if (!cur && hovHit) cur = 'move'
        const p = !cur ? planeAt(e.latlng) : undefined
        if (p && p.id === selIdRef.current) { const grid = gridFor(p); drawAddHover(p, grid, nearestCell(grid, e.latlng)); cur = 'copy' }
        else { ghostLayer.current?.clearLayers(); if (!cur && p) cur = 'pointer' }
        m.getContainer().style.cursor = cur
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
      if (t === 'rotate' && rotPid && rotCenLL) {
        const delta = bearingTo(rotCenLL, e.latlng) - rotBear0
        const d = designRef.current!
        commitRef.current(d.planes.map((x) => (x.id === rotPid ? { ...x, panels: rotPanels0.map((pn) => ({ ...pn, corners: rotateCorners(pn.corners, rotCenLL!, delta) })) } : x)))
        rotPid = null; rotCenLL = null; rotPanels0 = []
      }
      else if ((t === 'add' || t === 'remove' || painting) && dragPid && startCell) {
        const d = designRef.current!; const p = d.planes.find((x) => x.id === dragPid)
        if (p) {
          const cur = nearestCell(dragCells, e.latlng) ?? startCell
          const block = moved ? cellBlock(dragCells, startCell, cur) : [startCell]
          let panels = [...(p.panels ?? [])]
          if (t === 'remove') {
            if (!moved) { const hit = findPanelAt({ lat: e.latlng.lat, lng: e.latlng.lng }); panels = hit ? panels.filter((pn) => pn.id !== hit.panel.id) : panels }
            else panels = panels.filter((pn) => !block.some((c) => sameCell(panelCenter(pn), c.center)))
          }
          else if (painting) { // select-tool placement: only ever ADDS, and never on top of an existing module
            for (const c of block) if (!panels.some((pn) => sameCell(panelCenter(pn), c.center) || quadsOverlap(pn.corners, c.corners))) panels.push({ id: uid('pn'), corners: c.corners })
          }
          else if (!moved) { const i = panels.findIndex((pn) => sameCell(panelCenter(pn), startCell!.center)); if (i >= 0) panels.splice(i, 1); else panels.push({ id: uid('pn'), corners: startCell.corners }) }
          else for (const c of block) if (!panels.some((pn) => sameCell(panelCenter(pn), c.center))) panels.push({ id: uid('pn'), corners: c.corners })
          commitRef.current(d.planes.map((x) => (x.id === dragPid ? { ...x, panels, moduleId: p.moduleId ?? moduleIdRef.current } : x)))
        }
      } else if (t === 'select' && grpMode && grp) {
        let transform: ((c: LatLng[]) => LatLng[]) | null = null
        if (grpMode === 'move' && grpStart) { const [dLat, dLng] = snapMove(e.latlng.lat - grpStart.lat, e.latlng.lng - grpStart.lng); transform = (c) => translateCorners(c, dLat, dLng) }
        else if (grpMode === 'rotate') { const delta = bearingTo(grp.center, e.latlng) - grpRot0; transform = (c) => rotateCorners(c, grp!.center, delta) }
        if (transform) {
          const outside = panelsOutside(new Set(grp.items.map((i) => i.panelId)))
          const moved2 = grp.items.map((i) => ({ panelId: i.panelId, corners: transform!(i.corners0) }))
          if (moved2.some((mv) => outside.some((pn) => quadsOverlap(mv.corners, pn.corners)))) act.toast('Panels can’t overlap — dropped back', 'warning')
          else { const d = designRef.current!; const byId = new Map(moved2.map((mv) => [mv.panelId, mv.corners])); commitRef.current(d.planes.map((x) => ({ ...x, panels: (x.panels ?? []).map((pn) => (byId.has(pn.id) ? { ...pn, corners: byId.get(pn.id)! } : pn)) }))) }
        }
      } else if (t === 'select' && pendingAdd && dragPid && startCell) {
        // a click (no drag) on open roof of the selected face → one panel in that slot, unless something's there
        const d = designRef.current!; const p = d.planes.find((x) => x.id === dragPid)
        if (p && !(p.panels ?? []).some((pn) => sameCell(panelCenter(pn), startCell!.center) || quadsOverlap(pn.corners, startCell!.corners)))
          commitRef.current(d.planes.map((x) => (x.id === dragPid ? { ...x, panels: [...(x.panels ?? []), { id: uid('pn'), corners: startCell!.corners }], moduleId: p.moduleId ?? moduleIdRef.current } : x)))
      } else if (t === 'select' && marqStart) {
        const a = marqStart, b = e.latlng
        const latLo = Math.min(a.lat, b.lat), latHi = Math.max(a.lat, b.lat), lngLo = Math.min(a.lng, b.lng), lngHi = Math.max(a.lng, b.lng)
        const dragged = Math.abs(a.lat - b.lat) * 110540 > 0.6 || Math.abs(a.lng - b.lng) * mLngAt(a.lat) > 0.6
        if (dragged) {
          const ids: string[] = []; let firstPid: string | null = null
          const inBox = (v: LatLng) => v.lat >= latLo && v.lat <= latHi && v.lng >= lngLo && v.lng <= lngHi
          for (const p of designRef.current?.planes ?? []) {
            if (marqPid && p.id !== marqPid) continue
            for (const pn of p.panels ?? []) if (inBox(panelCenter(pn)) || pn.corners.some(inBox)) { ids.push(pn.id); if (!firstPid) firstPid = p.id }
          }
          setSelPanelIds(marqAdd ? [...new Set([...selPanelRef.current, ...ids])] : ids); if (firstPid) setSelId(firstPid)
        } else if (pendingToggle) { const cur = selPanelRef.current; setSelPanelIds(cur.includes(pendingToggle) ? cur.filter((x) => x !== pendingToggle) : [...cur, pendingToggle]) }
      }
      ghostLayer.current?.clearLayers(); setGhostN(null); setRotDeg(null)
      startCell = null; dragCells = []; dragPid = null; moveOccupied = []; rotPid = null; rotCenLL = null; rotPanels0 = []
      if (grp) panelCanvas.current?.setDim([])
      grp = null; grpMode = null; grpStart = null; grpInvalid = false; marqStart = null; marqPid = null; marqAdd = false; pendingToggle = null; painting = false; pendingAdd = null; m.dragging.enable()
    })
    // A plain click on open ground (off every roof) clears the selection and finishes corner editing.
    m.on('click', (e: any) => {
      if (toolRef.current !== 'select' || planeAt(e.latlng) || findPanelAt({ lat: e.latlng.lat, lng: e.latlng.lng })) return
      setSelId(null); setSelPanelIds([]); setSelObsId(null); setEditPlaneId(null)
    })
    // Right-click anywhere → a menu of what you can do right there.
    m.on('contextmenu', (e: any) => {
      if (toolRef.current === 'draw') return
      L.DomEvent.preventDefault(e.originalEvent)
      const ll = { lat: e.latlng.lat, lng: e.latlng.lng }
      const hit = findPanelAt(ll), p = planeAt(e.latlng)
      if (hit && !selPanelRef.current.includes(hit.panel.id)) { setSelPanelIds([hit.panel.id]); setSelId(hit.pid) }
      else if (!hit && p) { setSelId(p.id); setSelPanelIds([]) }
      setCtx({ x: e.containerPoint.x, y: e.containerPoint.y, ll, pid: hit?.pid ?? p?.id, panelId: hit?.panel.id })
    })
    map.current = m
    if ((import.meta as any).env?.DEV) (window as any).__lmap = m
    setTimeout(() => { m.invalidateSize(); setMapReady(true) }, 120)
    return () => { m.remove(); map.current = null; setMapReady(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { panelCanvas.current?.setAlpha(seeThrough ? 0.4 : 1) }, [seeThrough, mapReady])
  // Keep Leaflet sized correctly when returning to a canvas tab (it was display:none)
  useEffect(() => { if (canvasVisible && map.current) setTimeout(() => map.current!.invalidateSize(), 60) }, [canvasVisible])

  // Fullscreen the whole editor (native Fullscreen API) — the map is resized on enter/exit.
  useEffect(() => {
    const onFs = () => { setIsFs(!!document.fullscreenElement); setTimeout(() => map.current?.invalidateSize(), 90) }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])
  const toggleFs = () => { const el = rootRef.current; if (!el) return; if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.() }

  // ── High-res Google base tiles: probe once; if the Map Tiles API is enabled on the key, swap the
  //    Esri base for Google satellite everywhere. Silently keeps Esri if the probe 404s. ──
  useEffect(() => {
    if (!mapReady || !map.current || gTiles.current) return
    let cancelled = false
    fetch('/api/maptiles/2/1/1').then((r) => {
      if (cancelled || !r.ok || !map.current) return
      const g = L.tileLayer('/api/maptiles/{z}/{x}/{y}', { maxZoom: 23, maxNativeZoom: 21, keepBuffer: 3, errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=' })
      g.addTo(map.current); gTiles.current = g // sits in the tile pane, above Esri, below the RGB overlay + vectors
    }).catch(() => { /* keep Esri */ })
    return () => { cancelled = true }
  }, [mapReady])

  // ── High-res Google aerial: fetch the Solar RGB layer once per location and drape it on the 2D map
  //    (Pylon-grade sharpness where you design). Silently no-ops without a Solar key. ──
  useEffect(() => {
    const c = design?.center; if (!map.current || !c) return
    const key = `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`
    if (aerialKey.current === key && rgbLayer.current) return // already loaded for this location
    let cancelled = false
    ;(async () => {
      const ov = await fetchRgbOverlay(c.lat, c.lng)
      if (cancelled || !ov || !map.current) return // StrictMode's first pass is cancelled; the second loads
      aerialKey.current = key
      rgbLayer.current?.remove()
      const layer = L.imageOverlay(ov.dataUrl, ov.bounds, { pane: 'rgb', interactive: false } as any)
      rgbLayer.current = layer
      if (hdOn) layer.addTo(map.current)
      setHdReady(true)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design?.center?.lat, design?.center?.lng])
  // Toggle the loaded aerial on/off without refetching
  useEffect(() => {
    const m = map.current, layer = rgbLayer.current; if (!m || !layer) return
    if (hdOn) layer.addTo(m); else layer.remove()
  }, [hdOn, hdReady])

  // ── Land-ownership boundary overlay (HMLR INSPIRE, Pylon-style). Real title boundary when INSPIRE
  //    data is wired (/api/parcel); otherwise the real building footprint so the plot is still shown. ──
  useEffect(() => {
    const lyr = boundaryLayer.current; if (!lyr || !map.current) return
    lyr.clearLayers()
    if (!boundaryOn || !design?.center) { setBoundaryInfo(null); return }
    let cancelled = false
    const c = design.center
    ;(async () => {
      let ring: LatLng[] | null = null, neighbours: LatLng[][] = [], source: 'inspire' | 'footprint' = 'footprint'
      try { const r = await fetch(`/api/parcel?lat=${c.lat}&lng=${c.lng}`); const j = await r.json(); if (j.configured && j.parcel) { ring = j.parcel; neighbours = j.neighbours ?? []; source = 'inspire' } } catch { /* fall back */ }
      if (!ring) { ring = (await fetchBuildingOutline(c.lat, c.lng).catch(() => null)) || (await fetchBuildingFootprint(c).catch(() => null)); source = 'footprint' }
      if (cancelled || !boundaryLayer.current) return
      const g = boundaryLayer.current; g.clearLayers()
      if (source === 'inspire') {
        // Land Registry title boundary — teal, with a dark halo so it reads on any roof; neighbours faint
        neighbours.forEach((nr) => L.polygon(nr.map((v) => [v.lat, v.lng]) as [number, number][], { color: '#62E4CC', weight: 1, opacity: 0.35, dashArray: '4 4', fill: false, pmIgnore: true, interactive: false } as any).addTo(g))
        if (ring) {
          const ll = ring.map((v) => [v.lat, v.lng]) as [number, number][]
          L.polygon(ll, { color: '#05111D', weight: 5.5, opacity: 0.35, fill: false, pmIgnore: true, interactive: false } as any).addTo(g)
          L.polygon(ll, { color: '#62E4CC', weight: 2.6, opacity: 1, fillColor: '#62E4CC', fillOpacity: 0.04, pmIgnore: true, interactive: false } as any).addTo(g)
        }
      } else if (ring) {
        L.polygon(ring.map((v) => [v.lat, v.lng]) as [number, number][], { color: '#F5A524', weight: 2, opacity: 0.9, dashArray: '6 4', fill: false, pmIgnore: true, interactive: false } as any).addTo(g)
      }
      setBoundaryInfo({ source, found: !!ring })
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundaryOn, design?.center?.lat, design?.center?.lng])

  // ── Centre on the design; auto-detect the first time if empty ──
  useEffect(() => {
    if (!map.current || !design) return
    // Designs saved before auto-obstruction detection was removed still carry its false positives.
    if ((design.obstacles ?? []).some((o) => o.source === 'auto')) act.updateDesign(design.id, { obstacles: (design.obstacles ?? []).filter((o) => o.source !== 'auto') })
    ;(async () => {
      let c = design.center
      if (!c && design.address) { const g = await geocodeLocation(design.address); if (g) { c = { lat: g.lat, lng: g.lng }; act.updateDesign(design.id, { center: c }) } }
      if (c) map.current!.setView([c.lat, c.lng], 20)
      if (c && design.planes.length === 0 && design.scope?.pv !== false) runDetect(c) // no roof needed for a battery/EV-only job
      // Designs detected before the roof was auto-tidied: straighten + join their faces once on open (undoable)
      if (design.planes.length > 1 && !design.detected && !design.tidiedAt && autoTidied.current !== design.id) { autoTidied.current = design.id; setTimeout(() => tidyRef.current(undefined, { silent: true }), 400) }
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
    const canvasPanels: { id: string; corners: LatLng[]; azimuthDeg: number }[] = []
    design.planes.forEach((p) => {
      const on = p.id === selId
      const ring = p.polygon.map((v) => [v.lat, v.lng]) as [number, number][]
      // Roof face: a fine teal line with a soft dark halo (reads on any imagery), a whisper of fill,
      // brighter on hover, white + corner nodes when selected. No thick neon outlines.
      L.polygon(ring, { pmIgnore: true, color: '#05111D', weight: 4.5, opacity: 0.28, fill: false, interactive: false } as any).addTo(lyr)
      const base = { color: on ? '#FFFFFF' : '#62E4CC', weight: on ? 2.2 : 1.6, opacity: 0.95, fillColor: '#62E4CC', fillOpacity: p.panels?.length ? 0.05 : (on ? 0.16 : 0.1) }
      const poly = L.polygon(ring, base as any)
      ;(poly as any)._planeId = p.id
      poly.on('click', (e) => { L.DomEvent.stopPropagation(e); if (toolRef.current !== 'pan') { setSelId(p.id); setSelObsId(null) } })
      poly.on('mouseover', () => { if (!on) poly.setStyle({ weight: 2.2, fillOpacity: (p.panels?.length ? 0.08 : 0.18) }) })
      poly.on('mouseout', () => poly.setStyle(base as any))
      poly.on('dblclick', (e: any) => { L.DomEvent.stop(e); if (toolRef.current !== 'select') return; if (selectArrayRef.current({ lat: e.latlng.lat, lng: e.latlng.lng })) return; setSelId(p.id); setSelPanelIds([]); setEditPlaneId(p.id) })
      poly.on('pm:edit', () => syncGeometry(p.id, poly))
      // A compact label chip on the face's top edge: permanent while empty, on hover once filled.
      const topPt = p.polygon.reduce((a, v) => (v.lat > a.lat ? v : a), p.polygon[0])
      const tip = poly.bindTooltip(`${compass(p.azimuthDeg)} · ${effTilt(p)}° · ${p.panels?.length ? `${p.panels.length} panels · ${kwpOf(p.panels.length, moduleById(p.moduleId ?? moduleIdRef.current).watts).toFixed(2)} kWp` : `${p.areaM2} m²`}`, { permanent: !p.panels?.length && (on || design.planes.length <= 4), direction: 'top', className: 'roof-label', offset: [0, -4] })
      if (!p.panels?.length && (on || design.planes.length <= 4)) tip.openTooltip([topPt.lat, topPt.lng])
      poly.addTo(lyr)
      if (p.id === editPlaneId) (poly as any).pm.enable({ allowSelfIntersection: false, snappable: true })
      // Selected face: every corner is a handle — grab and drag. A corner shared with a neighbouring pane (ridge end,
      // hip top) moves with it so the roof stays joined; dropped near another pane's corner, it snaps onto it.
      if (on && editPlaneId !== p.id) {
        const mLat = 110540, mLng = 111320 * Math.cos((p.polygon[0].lat * Math.PI) / 180)
        const near = (a: LatLng, b: LatLng, m: number) => Math.hypot((a.lat - b.lat) * mLat, (a.lng - b.lng) * mLng) <= m
        p.polygon.forEach((v, vi) => {
          const shared = design.planes.flatMap((q) => (q.id === p.id ? [] : q.polygon.map((w, wi) => ({ pid: q.id, wi, w })).filter((o) => near(o.w, v, 0.2))))
          const mk = L.marker([v.lat, v.lng], {
            draggable: true, keyboard: false, pmIgnore: true, zIndexOffset: 1000,
            icon: L.divIcon({ className: '', html: `<div title="Drag to move · double-click or right-click to delete" style="width:13px;height:13px;border-radius:50%;background:#fff;border:2.5px solid #15223B;box-shadow:0 1px 4px rgba(0,0,0,.55);cursor:move"></div>`, iconSize: [13, 13], iconAnchor: [6.5, 6.5] }),
          } as any)
          mk.on('drag', (e: any) => {
            const ll = e.target.getLatLng()
            poly.setLatLngs(p.polygon.map((w, i) => (i === vi ? [ll.lat, ll.lng] : [w.lat, w.lng])) as [number, number][])
          })
          mk.on('dragend', (e: any) => {
            let ll: LatLng = { lat: e.target.getLatLng().lat, lng: e.target.getLatLng().lng }
            const d = designRef.current; if (!d) return
            // magnet: onto another pane's corner within 30 cm
            const others = d.planes.flatMap((q) => (q.id === p.id ? [] : q.polygon)).filter((w) => !shared.some((s) => s.w === w))
            const snap = others.find((w) => near(w, ll, 0.3)); if (snap) ll = { lat: snap.lat, lng: snap.lng }
            const moved = (q: DesignPlane, ring: LatLng[]) => {
              const inside = (pt: LatLng) => pointInRing(ring, pt)
              // keep the modules that still sit fully on the reshaped face
              return { ...q, polygon: ring, areaM2: Math.round(polygonAreaM2(ring)), panels: (q.panels ?? []).filter((pn) => pn.corners.every(inside)) }
            }
            // commit on the next tick — rebuilding the layer while Leaflet is still finishing the drag crashes it
            setTimeout(() => commitRef.current(d.planes.map((q) => {
              if (q.id === p.id) return moved(q, q.polygon.map((w, i) => (i === vi ? ll : w)))
              const s = shared.filter((o) => o.pid === q.id)
              return s.length ? moved(q, q.polygon.map((w, i) => (s.some((o) => o.wi === i) ? ll : w))) : q
            })), 0)
          })
          // delete this corner (a triangle is the minimum) — double-click or right-click it
          const drop = (e: any) => {
            L.DomEvent.stop(e)
            const d = designRef.current; if (!d || p.polygon.length <= 3) return
            const ring = p.polygon.filter((_, i) => i !== vi)
            setTimeout(() => commitRef.current(d.planes.map((q) => (q.id === p.id ? { ...q, polygon: ring, areaM2: Math.round(polygonAreaM2(ring)), panels: (q.panels ?? []).filter((pn) => pn.corners.every((c) => pointInRing(ring, c))) } : q))), 0)
          }
          mk.on('dblclick', drop); mk.on('contextmenu', drop)
          mk.addTo(lyr)
        })
        // a faint handle on the middle of every edge: drag it (or click it) to add a corner there
        p.polygon.forEach((v, vi) => {
          const w = p.polygon[(vi + 1) % p.polygon.length]
          if (Math.hypot((v.lat - w.lat) * mLat, (v.lng - w.lng) * mLng) < 0.8) return
          const mid = { lat: (v.lat + w.lat) / 2, lng: (v.lng + w.lng) / 2 }
          const mm = L.marker([mid.lat, mid.lng], {
            draggable: true, keyboard: false, pmIgnore: true, zIndexOffset: 900,
            icon: L.divIcon({ className: '', html: `<div title="Drag to add a corner" style="width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.55);border:1.5px solid #15223B;cursor:copy"></div>`, iconSize: [9, 9], iconAnchor: [4.5, 4.5] }),
          } as any)
          const insert = (ll: LatLng) => {
            const d = designRef.current; if (!d) return
            const ring = [...p.polygon.slice(0, vi + 1), ll, ...p.polygon.slice(vi + 1)]
            setTimeout(() => commitRef.current(d.planes.map((q) => (q.id === p.id ? { ...q, polygon: ring, areaM2: Math.round(polygonAreaM2(ring)), panels: (q.panels ?? []).filter((pn) => pn.corners.every((c) => pointInRing(ring, c))) } : q))), 0)
          }
          mm.on('drag', (e: any) => { const ll = e.target.getLatLng(); poly.setLatLngs([...p.polygon.slice(0, vi + 1).map((x) => [x.lat, x.lng]), [ll.lat, ll.lng], ...p.polygon.slice(vi + 1).map((x) => [x.lat, x.lng])] as [number, number][]) })
          mm.on('dragend', (e: any) => insert({ lat: e.target.getLatLng().lat, lng: e.target.getLatLng().lng }))
          mm.on('click', (e: any) => { L.DomEvent.stop(e); insert(mid) })
          mm.addTo(lyr)
        })
      }
      // Modules go to the photoreal canvas (hidden while a suggested layout is previewed on this plane).
      const pv = preview?.planes.find((pp) => pp.id === p.id)
      if (!pv) p.panels?.forEach((pn) => canvasPanels.push({ id: pn.id, corners: pn.corners, azimuthDeg: p.azimuthDeg }))
      else pv.panels?.forEach((pn) => { if (!preview!.removed.has(pn.id)) canvasPanels.push({ id: pn.id, corners: pn.corners, azimuthDeg: p.azimuthDeg }) }) // the preview looks exactly like the real thing
    })
    panelCanvas.current?.setPanels(canvasPanels)
    panelCanvas.current?.setSelected(selPanelIds)
    // Selection — a dashed oriented box with corner nodes + a rotate handle. A lone panel's box sits on
    // its own corners; a joined array's box wraps the whole array (nodes at its ends). Drag a corner or
    // the handle to rotate, drag inside to move, Del to remove.
    const selItems: DesignPanel[] = selPanelIds.length ? design.planes.flatMap((p) => p.panels ?? []).filter((pn) => new Set(selPanelIds).has(pn.id)) : []
    if (selItems.length && map.current) {
      const mp = map.current
      const angle = panelAngle(selItems[0].corners), c0 = selItems[0].corners[0]
      const mLat = 110540, mLng = 111320 * Math.cos((c0.lat * Math.PI) / 180), ca = Math.cos(angle), sa = Math.sin(angle)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const pn of selItems) for (const v of pn.corners) { const ex = (v.lng - c0.lng) * mLng, ny = (v.lat - c0.lat) * mLat; const rx = ex * ca + ny * sa, ry = -ex * sa + ny * ca; minX = Math.min(minX, rx); maxX = Math.max(maxX, rx); minY = Math.min(minY, ry); maxY = Math.max(maxY, ry) }
      const back = (rx: number, ry: number) => ({ lat: c0.lat + (rx * sa + ry * ca) / mLat, lng: c0.lng + (rx * ca - ry * sa) / mLng })
      const corners = [back(minX, minY), back(maxX, minY), back(maxX, maxY), back(minX, maxY)]
      if (selItems.length > 1) L.polygon(corners.map((v) => [v.lat, v.lng]) as [number, number][], { pmIgnore: true, interactive: false, color: '#62E4CC', weight: 1.2, opacity: 0.8, fill: false, dashArray: '3 4' } as any).addTo(pl) // a single panel's own teal frame is enough
      // (no corner nodes — the rotate handle above is the one grip; corners still rotate if you grab them)
      // rotate handle — top-centre of the screen bounding box, offset up (matches the hit-test)
      const pts = corners.map((v) => mp.latLngToContainerPoint([v.lat, v.lng]))
      const minx = Math.min(...pts.map((p) => p.x)), maxx = Math.max(...pts.map((p) => p.x)), miny = Math.min(...pts.map((p) => p.y))
      const anchor = mp.containerPointToLatLng(L.point((minx + maxx) / 2, miny)), hp = mp.containerPointToLatLng(L.point((minx + maxx) / 2, miny - 24))
      L.polyline([[anchor.lat, anchor.lng], [hp.lat, hp.lng]], { color: '#62E4CC', weight: 1.6, opacity: 0.9, pmIgnore: true, interactive: false } as any).addTo(pl)
      L.circleMarker([hp.lat, hp.lng], { radius: 6, color: '#62E4CC', weight: 2, fillColor: '#fff', fillOpacity: 1, pmIgnore: true, interactive: false } as any).addTo(pl)
    }
    // Frame the roof only when the structure changes (detect/draw) — never on a panel edit, or the map would jump mid-drag.
    const fitKey = `${design.id}:${design.planes.length}`
    if (design.planes.length && toolRef.current === 'select' && fittedRef.current !== fitKey) {
      fittedRef.current = fitKey
      const all = design.planes.flatMap((p) => p.polygon.map((v) => [v.lat, v.lng] as [number, number]))
      try { map.current.fitBounds(L.latLngBounds(all).pad(0.3), { maxZoom: 20, animate: false }) } catch { /* single point */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design?.planes, selId, selPanelIds, mapReady, preview, editPlaneId])

  // ── Suggested-layout preview — teal-framed navy ghosts from the last auto-layout run, click one to drop it
  // before accepting. Nothing here is committed to the design until "Accept" is pressed. ──
  useEffect(() => {
    const lyr = previewLayer.current
    if (!lyr) return
    lyr.clearLayers()
    if (!preview) return
    preview.planes.forEach((p) => {
      p.panels?.forEach((pn) => {
        if (preview.removed.has(pn.id)) return
        const poly = L.polygon(pn.corners.map((v) => [v.lat, v.lng]) as [number, number][], {
          renderer: panelRenderer.current!, pmIgnore: true, interactive: true,
          color: '#62E4CC', weight: 1, opacity: 0.5, dashArray: '3 2', fillColor: '#15223B', fillOpacity: 0.01, // click target; the module itself is drawn by the photoreal canvas
        } as any)
        poly.on('click', (e) => { L.DomEvent.stopPropagation(e); setPreview((cur) => (cur ? { ...cur, removed: new Set(cur.removed).add(pn.id) } : cur)) })
        poly.addTo(lyr)
      })
    })
  }, [preview, mapReady])

  /** Ovi designs the roof toward a goal and shows it as a preview — nothing changes until it's approved. */
  function previewOvi(goalSel: 'max' | 'kwp' | 'usage' = ovi?.goal ?? 'max', kwpSel: number = ovi?.kwp ?? 6) {
    const d = designRef.current; if (!d || !d.planes.length) { act.toast('Detect or draw the roof first', 'warning'); return }
    const yieldPerKwp = regionYield(d.address).yield
    const usage = d.annualConsumptionKwh ?? d.home?.smartMeter?.annualKwh
    const goal: OviGoal = goalSel === 'kwp' ? { kind: 'target-kwp', kwp: kwpSel } : goalSel === 'usage' && usage ? { kind: 'target-kwh', kwh: usage, yieldPerKwp } : { kind: 'max' }
    const result = oviDesign(d.planes, module, goal, { obstacles: obsRings(d), setbackM: d.setbackM })
    setOvi({ goal: goalSel === 'usage' && !usage ? 'max' : goalSel, kwp: kwpSel, result })
    setPreview({ planes: result.planes, removed: new Set() })
    setSelPanelIds([])
  }
  function acceptPreview() {
    if (!preview) return
    setOvi(null)
    const planes = preview.planes.map((p) => ({ ...p, panels: (p.panels ?? []).filter((pn) => !preview.removed.has(pn.id)) }))
    commitSnapshot(planes)
    const kept = planes.reduce((s, p) => s + (p.panels?.length ?? 0), 0)
    setPreview(null)
    act.toast(`${kept} panel${kept === 1 ? '' : 's'} accepted`, 'positive')
  }
  function discardPreview() {
    setOvi(null)
    setPreview(null)
  }

  // ── Redraw obstructions whenever they change — coloured keep-outs with a draggable centroid handle ──
  useEffect(() => {
    const lyr = obstacleLayer.current
    if (!lyr || !map.current || !mapReady || !design) return
    lyr.clearLayers()
    ;(design.obstacles ?? []).forEach((o) => {
      const on = o.id === selObsId, meta = OBST[o.kind]
      const ring = o.polygon.map((v) => [v.lat, v.lng]) as [number, number][]
      const poly = L.polygon(ring, { pmIgnore: true, color: meta.c, weight: on ? 3 : 2, fillColor: meta.c, fillOpacity: on ? 0.42 : 0.28, dashArray: on ? undefined : '3 3' } as any)
      poly.on('click', (e) => { L.DomEvent.stopPropagation(e); setSelObsId(o.id); setSelId(null); setSelPanelIds([]) })
      poly.bindTooltip(`${meta.label}${o.heightM ? ` · ${o.heightM} m proud` : ''}${o.source === 'auto' ? ' · detected' : ''}`, { direction: 'top', className: 'roof-label' })
      poly.addTo(lyr)
      // draggable centroid handle → reposition the whole obstruction onto the real vent/chimney
      const cx = o.polygon.reduce((s, v) => s + v.lat, 0) / o.polygon.length
      const cy = o.polygon.reduce((s, v) => s + v.lng, 0) / o.polygon.length
      const mk = L.marker([cx, cy], { draggable: true, keyboard: false, icon: L.divIcon({ className: '', html: `<div style="width:12px;height:12px;border-radius:50%;background:${meta.c};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.55)"></div>`, iconSize: [12, 12], iconAnchor: [6, 6] }) })
      mk.on('dragstart', () => { setSelObsId(o.id) })
      mk.on('drag', (e: any) => { const ll = e.target.getLatLng(); const dLat = ll.lat - cx, dLng = ll.lng - cy; poly.setLatLngs(o.polygon.map((v) => [v.lat + dLat, v.lng + dLng] as [number, number])) })
      mk.on('dragend', (e: any) => { const ll = e.target.getLatLng(); moveObstacle(o.id, ll.lat - cx, ll.lng - cy) })
      mk.addTo(lyr)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ;(design.notes ?? []).forEach((n, i) => {
      const mk = L.marker([n.lat, n.lng], { draggable: true, keyboard: false, icon: L.divIcon({ className: '', html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 2px;transform:rotate(-45deg);background:#F59E0B;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font:700 11px Inter,sans-serif;color:#15223B">${i + 1}</span></div>`, iconSize: [22, 22], iconAnchor: [4, 20] }) })
      mk.bindTooltip(n.text, { direction: 'top', className: 'roof-label' })
      mk.on('dragend', (e: any) => { const ll = e.target.getLatLng(); act.updateDesign(design.id, { notes: (design.notes ?? []).map((x) => (x.id === n.id ? { ...x, lat: ll.lat, lng: ll.lng } : x)) }) })
      mk.addTo(lyr)
    })
  }, [design?.obstacles, design?.notes, selObsId, mapReady])

  // ── Measurements overlay — edge lengths + face area on every roof plane (for sizing / CAD) ──
  useEffect(() => {
    const lyr = measureLayer.current
    if (!lyr || !map.current || !mapReady || !design) return
    lyr.clearLayers()
    if ((!measureOn && tool !== 'edit' && !editPlaneId) || view !== '2d') return // measurements: on demand, or always while editing a face
    const label = (lat: number, lng: number, text: string, tone: 'edge' | 'area') => {
      const bg = tone === 'area' ? 'rgba(21,34,59,.96)' : 'rgba(10,14,23,.86)'
      L.marker([lat, lng], { interactive: false, pmIgnore: true, keyboard: false, icon: L.divIcon({ className: '', html: `<div style="transform:translate(-50%,-50%);white-space:nowrap;font:700 11px/1 system-ui;color:#fff;background:${bg};padding:2px 5px;border-radius:5px;box-shadow:0 1px 3px rgba(0,0,0,.4)">${text}</div>`, iconSize: [0, 0] }) }).addTo(lyr)
    }
    // Edge-length labels get unreadable fast with several small planes on screen at once — only
    // dimension the selected plane's edges (or every plane's, if there's just the one). Every
    // plane still gets its compact area+pitch badge, which is what stays legible zoomed out.
    const dimensionEdgesFor = design.planes.length <= 1 ? design.planes.map((p) => p.id) : selId ? [selId] : []
    design.planes.forEach((p) => {
      const ring = p.polygon
      const mLat = 110540, mLng = 111320 * Math.cos((ring[0].lat * Math.PI) / 180)
      if (dimensionEdgesFor.includes(p.id)) {
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], b = ring[(i + 1) % ring.length]
          const dx = (b.lng - a.lng) * mLng, dy = (b.lat - a.lat) * mLat
          const len = Math.hypot(dx, dy)
          if (len < 0.5) continue
          // plan length → true surface length up the slope (sloped edges only): approximate with pitch on
          // the up-slope component. Kept simple: show plan length, which is what a roofer measures on plan.
          label((a.lat + b.lat) / 2, (a.lng + b.lng) / 2, `${len.toFixed(1)} m`, 'edge')
        }
      }
      const cx = ring.reduce((s, v) => s + v.lat, 0) / ring.length, cy = ring.reduce((s, v) => s + v.lng, 0) / ring.length
      label(cx, cy, `${Math.round(slopedAreaM2(p.areaM2, p.pitchDeg))} m² · ${effTilt(p)}°`, 'area')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design?.planes, measureOn, view, mapReady, tool, selId, editPlaneId])

  // Delete / Backspace removes the selected panel (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { if (typing) return; e.preventDefault(); e.shiftKey ? redoRef.current() : undoRef.current(); return }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { if (typing) return; e.preventDefault(); redoRef.current(); return }
      if (!typing && (e.key === 'x' || e.key === 'X') && !e.ctrlKey && !e.metaKey) { setSeeThrough((v) => !v); return }
      if (!typing && (e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && selIdRef.current) { tidyRef.current([selIdRef.current]); return }
      // arrow keys nudge the selected panels 5 cm (shift: 25 cm) — fine placement without dragging
      if (!typing && selPanelRef.current.length && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const d0 = designRef.current; if (!d0) return
        const step = e.shiftKey ? 0.25 : 0.05, lat0 = d0.center?.lat ?? 52
        const dLat = (e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0) / 110540
        const dLng = (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0) / (111320 * Math.cos((lat0 * Math.PI) / 180))
        const ids = new Set(selPanelRef.current)
        commitRef.current(d0.planes.map((p) => ({ ...p, panels: (p.panels ?? []).map((pn) => (ids.has(pn.id) ? { ...pn, corners: pn.corners.map((c) => ({ lat: c.lat + dLat, lng: c.lng + dLng })) } : pn)) })))
        return
      }
      if (e.key === 'Escape' && !typing) {
        setCtx(null)
        if (editPlaneRef.current) { setEditPlaneId(null); return }
        if (selPanelRef.current.length) { setSelPanelIds([]); return }
        setSelId(null); setSelObsId(null); return
      }
      if (!typing && (e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A') && selIdRef.current) { // select every panel on the face
        e.preventDefault(); const pl = designRef.current?.planes.find((x) => x.id === selIdRef.current); setSelPanelIds((pl?.panels ?? []).map((pn) => pn.id)); return
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (typing) return
      if (selObsRef.current) { e.preventDefault(); deleteObstacle(selObsRef.current); return }
      if (!selPanelRef.current.length) {
        // nothing picked but a face is → Delete removes the face (Ctrl+Z brings it back)
        const d0 = designRef.current, fid = selIdRef.current
        if (d0 && fid && !editPlaneRef.current) { e.preventDefault(); commitRef.current(d0.planes.filter((p) => p.id !== fid)); setSelId(null); act.toast('Roof face removed — Ctrl+Z to undo') }
        return
      }
      e.preventDefault()
      const d = designRef.current; if (!d) return
      const ids = new Set(selPanelRef.current)
      commitRef.current(d.planes.map((p) => ({ ...p, panels: (p.panels ?? []).filter((pn) => !ids.has(pn.id)) })))
      setSelPanelIds([])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Actions ──
  async function runDetect(center?: LatLng) {
    if (!design || busy || detectingRef.current) return
    detectingRef.current = true
    setBusy(true); setStatus('Finding the building outline…')
    try {
      // 1) The outline → panes engine (Google mask or OSM outline, split along ridges/hips/valleys).
      const at = center || design.center
      const panes = at ? await detectRoofPanes(at, 'gable', setStatus).catch(() => null) : null
      if (panes && panes.planes.length) {
        const kept = design.planes.filter((p) => p.source === 'manual')
        const keptObs = (design.obstacles ?? []).filter((o) => o.source === 'manual')
        recordHistory()
        act.updateDesign(design.id, { planes: [...panes.planes, ...kept], obstacles: keptObs, center: at, roofModel: panes.model, detected: { at: Date.now(), message: panes.message, planes: panes.planes.map((p) => ({ polygon: p.polygon, pitchDeg: p.pitchDeg, azimuthDeg: p.azimuthDeg, areaM2: p.areaM2 })) } })
        setSelId(null); setSelPanelIds([])
        act.toast(panes.message + (panes.measured ? '' : ' — set each pane’s pitch on survey'), panes.measured ? 'positive' : undefined)
        return
      }
      // 2) No building under the pin: don't guess (the old fallback grabbed the biggest building nearby — often a
      //    neighbour's). Ask for the roof instead.
      if (at) { act.toast('No building right under the pin — right-click the roof you’re designing and choose “Detect the roof here”', 'warning'); return }
      setStatus('Measuring the roof from satellite…')
      const { planes, center: c, measured } = await detectPlanes(design.address, center || design.center)
      if (c && map.current) map.current.setView([c.lat, c.lng], 20)
      if (!measured) {
        // No real measurement available (no Solar key) — don't fabricate giant boxes; ask for a trace.
        act.updateDesign(design.id, { center: c || design.center })
        act.toast('Can’t measure this roof without a Google Solar key — draw the real roof with “Draw plane”.', 'warning')
        return
      }
      // Keep hand-drawn planes + user-added obstructions, REPLACE previously-detected ones so repeated
      // taps don't stack boxes. Obstructions are placed by the designer with the keep-out tool (as in
      // SolarEdge Designer) — auto-detection flagged gutters, sheds and trees as chimneys/HVAC.
      const kept = design.planes.filter((p) => p.source === 'manual')
      const keptObs = (design.obstacles ?? []).filter((o) => o.source === 'manual')
      act.updateDesign(design.id, { planes: [...planes, ...kept], obstacles: keptObs, center: c || design.center })
      if (!planes.length) act.toast('No roof planes found here — draw them by hand instead', 'warning')
      else act.toast(`${planes.length} roof face${planes.length === 1 ? '' : 's'} detected — check them against the photo`)
    } catch { act.toast('Could not measure this roof', 'warning') } finally { setBusy(false); setStatus(''); detectingRef.current = false }
  }
  function addManualPlane(ring: LatLng[]) {
    const d = designRef.current; if (!d) return
    const plane: DesignPlane = { id: uid('pl'), name: `Roof plane ${d.planes.length + 1}`, polygon: ring, pitchDeg: 30, azimuthDeg: 180, areaM2: Math.round(polygonAreaM2(ring)), source: 'manual', racking: 'flush' }
    commitSnapshot([...d.planes, plane])
    setSelId(plane.id)
  }
  function syncGeometry(pid: string, poly: L.Polygon) {
    const d = designRef.current; if (!d) return
    const ring = (poly.getLatLngs()[0] as L.LatLng[]).map((p) => ({ lat: p.lat, lng: p.lng }))
    commitSnapshot(d.planes.map((p) => (p.id === pid ? { ...p, polygon: ring, areaM2: Math.round(polygonAreaM2(ring)), panels: [] } : p)))
  }
  function deletePlane(pid: string) {
    const d = designRef.current; if (!d) return
    commitSnapshot(d.planes.filter((p) => p.id !== pid))
    if (selId === pid) setSelId(null)
  }
  // Trace the real building outline from OpenStreetMap (free, no key) — a dependable, accurate polygon
  // when Google's auto-detect is off. Drop it as a plane you then split into faces with Draw/Edit.
  async function traceBuilding() {
    const d = designRef.current; if (!d || busy) return
    const c = d.center; if (!c) { act.toast('Set the location first — drop a pin on the roof', 'warning'); return }
    setBusy(true); setStatus('Tracing the building outline…')
    try {
      // Google's DSM mask gives the true building shape wherever Solar coverage exists (most urban UK);
      // OSM is the fallback (patchy for UK houses). Either way it's free and needs no extra key.
      const ring = (await fetchBuildingOutline(c.lat, c.lng).catch(() => null)) || (await fetchBuildingFootprint(c).catch(() => null))
      if (!ring || ring.length < 3) { act.toast('No building outline found here — draw it by hand with the pen tool', 'warning'); return }
      const plane: DesignPlane = { id: uid('pl'), name: `Building outline`, polygon: ring, pitchDeg: 30, azimuthDeg: 180, areaM2: Math.round(polygonAreaM2(ring)), source: 'manual', racking: 'flush' }
      commitSnapshot([...d.planes, plane])
      setSelId(plane.id)
      act.toast('Traced the outline — split it into roof faces with Draw / Edit vertices', 'positive')
    } catch { act.toast('Could not fetch the outline', 'warning') } finally { setBusy(false); setStatus('') }
  }
  /** Tidy pane shapes to the roof rules (paneShape.ts): drop near-collinear corners and tiny edges, square the edges
   *  to the slope, make near-rectangles rectangles. Corners it moves that were shared with a neighbour snap back onto
   *  that neighbour's corner so the roof stays joined. Modules still fully on the face are kept. */
  function tidyPlanes(ids?: string[], opts?: { silent?: boolean }) {
    const d = designRef.current; if (!d || !d.planes.length) return
    // whole roof (Tidy all / auto): shape rules on every face AND mesh them — shared corners, shared edges
    if (!ids) {
      const rings = tidyRoofLL(d.planes)
      const mLat0 = 110540, mLng0 = 111320 * Math.cos(((d.center?.lat ?? 52) * Math.PI) / 180)
      const same = (a: LatLng[], b: LatLng[]) => a.length === b.length && a.every((v, i) => Math.hypot((v.lat - b[i].lat) * mLat0, (v.lng - b[i].lng) * mLng0) < 0.02)
      let removed = 0, changed = 0
      const next = d.planes.map((p, i) => {
        const poly = rings[i]; if (!poly || same(poly, p.polygon)) return p
        removed += Math.max(0, p.polygon.length - poly.length); changed++
        return { ...p, polygon: poly, areaM2: Math.round(polygonAreaM2(poly)), panels: (p.panels ?? []).filter((pn) => pn.corners.every((c) => pointInRing(poly, c))) }
      })
      if (!changed) { act.updateDesign(d.id, { tidiedAt: Date.now() }); if (!opts?.silent) act.toast('Every face is already tidy and joined'); return }
      commitSnapshot(next)
      act.updateDesign(d.id, { tidiedAt: Date.now() })
      act.toast(`${opts?.silent ? 'Roof tidied automatically' : 'Roof tidied'} · ${changed} face${changed === 1 ? '' : 's'} joined up${removed > 0 ? `, ${removed} stray corner${removed === 1 ? '' : 's'} removed` : ''} — Ctrl+Z to undo`)
      return
    }
    const want = new Set(ids)
    const mLat = 110540, mLng = 111320 * Math.cos(((d.center?.lat ?? 52) * Math.PI) / 180)
    const near = (a: LatLng, b: LatLng) => Math.hypot((a.lat - b.lat) * mLat, (a.lng - b.lng) * mLng)
    let removed = 0, changed = 0
    const next = d.planes.map((p) => {
      if (!want.has(p.id) || p.polygon.length < 4) return p
      let poly = tidyPolygon(p.polygon, p.pitchDeg >= 6 ? p.azimuthDeg : undefined)
      const others = d.planes.filter((q) => q.id !== p.id).flatMap((q) => q.polygon)
      poly = poly.map((v) => { let b: LatLng | null = null, bd = 0.4; for (const w of others) { const e = near(v, w); if (e < bd) { bd = e; b = w } } return b ? { ...b } : v })
      if (poly.length === p.polygon.length && poly.every((v, i) => near(v, p.polygon[i]) < 0.02)) return p
      removed += p.polygon.length - poly.length; changed++
      return { ...p, polygon: poly, areaM2: Math.round(polygonAreaM2(poly)), panels: (p.panels ?? []).filter((pn) => pn.corners.every((c) => pointInRing(poly, c))) }
    })
    if (!changed) { act.toast(ids?.length === 1 ? 'That face is already tidy' : 'Every face is already tidy'); return }
    commitSnapshot(next)
    act.toast(`Tidied ${changed} face${changed === 1 ? '' : 's'}${removed > 0 ? ` · ${removed} stray corner${removed === 1 ? '' : 's'} removed` : ''} — undo with Ctrl+Z`)
  }
  tidyRef.current = tidyPlanes
  /** Merge faces and/or make one flat — the fix when the height model is wrong (a flat roof with a glass lantern). */
  function mergePlanes(ids: string[], flat = false) {
    const d = designRef.current; if (!d) return
    const next = mergeFaces(d.planes, ids, flat, d.roofModel?.outline)
    if (!next) { act.toast('Those faces don’t join up — move a corner so they touch, then merge', 'warning'); return }
    commitSnapshot(next); setSelPanelIds([])
    const kept = next.find((p) => ids.includes(p.id)); if (kept) setSelId(kept.id)
    act.toast(ids.length > 1 ? `Merged ${ids.length} faces${flat ? ' into a flat roof' : ''} — Ctrl+Z to undo` : 'Made a flat roof — Ctrl+Z to undo')
  }
  function clearAllPlanes() {
    const d = designRef.current; if (!d || !d.planes.length) return
    const n = d.planes.length
    commitSnapshot([])
    setSelId(null); setSelPanelIds([])
    act.toast(`Cleared all ${n} roof plane${n === 1 ? '' : 's'} — undo with Ctrl+Z`, 'warning')
  }
  // Obstruction keep-out rings for the packer — panels flow around chimneys/vents/skylights.
  const obsRings = (d: { obstacles?: { polygon: LatLng[] }[] }) => (d.obstacles ?? []).map((o) => o.polygon)
  // ── Obstructions (chimneys / vents / HVAC / skylights) — detected or hand-placed keep-outs ──
  function setObstacles(next: DesignObstacle[]) { const d = designRef.current; if (!d) return; act.updateDesign(d.id, { obstacles: next }) }
  function addKeepout(at?: LatLng) {
    const d = designRef.current, m = map.current; if (!d || !m) return
    const c = at ?? m.getCenter(), s = 0.8 // ~0.8 m square dropped at the map centre, ready to drag onto the obstruction
    const dLat = s / 2 / 110540, dLng = s / 2 / (111320 * Math.cos((c.lat * Math.PI) / 180))
    const polygon = [{ lat: c.lat - dLat, lng: c.lng - dLng }, { lat: c.lat - dLat, lng: c.lng + dLng }, { lat: c.lat + dLat, lng: c.lng + dLng }, { lat: c.lat + dLat, lng: c.lng - dLng }]
    const ob: DesignObstacle = { id: uid('ob'), kind: 'keepout', polygon, source: 'manual' }
    setObstacles([...(d.obstacles ?? []), ob]); setSelObsId(ob.id); setSelId(null); setSelPanelIds([])
    act.toast('Keep-out added — drag it onto the obstruction; panels will avoid it')
  }
  function moveObstacle(oid: string, dLat: number, dLng: number) {
    const d = designRef.current; if (!d) return
    setObstacles((d.obstacles ?? []).map((o) => (o.id === oid ? { ...o, source: 'manual', polygon: o.polygon.map((v) => ({ lat: v.lat + dLat, lng: v.lng + dLng })) } : o)))
  }
  function deleteObstacle(oid: string) {
    const d = designRef.current; if (!d) return
    setObstacles((d.obstacles ?? []).filter((o) => o.id !== oid))
    if (selObsRef.current === oid) setSelObsId(null)
  }
  function cycleObstacleKind(oid: string) {
    const order: DesignObstacleKind[] = ['keepout', 'chimney', 'hvac', 'skylight']
    const d = designRef.current; if (!d) return
    setObstacles((d.obstacles ?? []).map((o) => (o.id === oid ? { ...o, kind: order[(order.indexOf(o.kind) + 1) % order.length] } : o)))
  }
  function updatePlane(pid: string, patch: Partial<DesignPlane>, repack = false) {
    const d = designRef.current; if (!d) return
    const planes = d.planes.map((p) => {
      if (p.id !== pid) return p
      const next = { ...p, ...patch }
      if (repack && (p.panels?.length || patch.panels === undefined && p.panels?.length)) {
        const mod = moduleById(next.moduleId ?? moduleId)
        const { panels, orientation } = packWithSettings(next, mod, d.setbackM, obsRings(d))
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
      const { panels, orientation } = packWithSettings(p, mod, d.setbackM, obsRings(d))
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
  // Centre the current selection (or the selected plane's whole array) within its roof face.
  function centreArray() {
    const d = designRef.current; if (!d) return
    const plane = d.planes.find((p) => p.id === selId); if (!plane || !plane.panels?.length) return
    const selSet = new Set(selPanelIds)
    const movers = plane.panels.filter((pn) => (selPanelIds.length ? selSet.has(pn.id) : true))
    if (!movers.length) return
    const avg = (pts: { lat: number; lng: number }[]) => ({ lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length, lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length })
    const arrC = avg(movers.map((pn) => panelCenter(pn))), planeC = avg(plane.polygon)
    const dLat = planeC.lat - arrC.lat, dLng = planeC.lng - arrC.lng
    const moved = new Map(movers.map((pn) => [pn.id, pn.corners.map((c) => ({ lat: c.lat + dLat, lng: c.lng + dLng }))]))
    commitSnapshot(d.planes.map((p) => (p.id === plane.id ? { ...p, panels: (p.panels ?? []).map((pn) => (moved.has(pn.id) ? { ...pn, corners: moved.get(pn.id)! } : pn)) } : p)))
  }
  function clearAllPanels() {
    const d = designRef.current; if (!d) return
    const n = d.planes.reduce((s, p) => s + (p.panels?.length ?? 0), 0); if (!n) return
    commitSnapshot(d.planes.map((p) => ({ ...p, panels: [] })))
    setSelPanelIds([])
    act.toast(`Cleared all ${n} panel${n === 1 ? '' : 's'} — undo with Ctrl+Z`, 'warning')
  }
  function runAutoLayout(goal: LayoutGoal) {
    const d = designRef.current; if (!d || !d.planes.length) { act.toast('Draw or detect a roof plane first', 'warning'); return }
    setBusy(true)
    setStatus(goal.kind === 'max' ? 'Ovi is maximising coverage across every plane…' : goal.kind === 'target-kwp' ? `Ovi is sizing the array to ${goal.kwp} kWp…` : `Ovi is sizing the array to ~${goal.kwh.toLocaleString()} kWh/yr…`)
    setTimeout(() => {
      const res = autoLayout(d.planes, module, goal, d.setbackM, { obstacles: obsRings(d) })
      setBusy(false); setStatus('')
      if (!res.count) { act.toast('No room for panels on these planes', 'warning'); return }
      setPreview({ planes: res.planes, removed: new Set() })
      act.toast(`Ovi suggests ${res.count} panels — ${res.kwp} kWp. Review below, then Accept.`, 'positive')
    }, 700)
  }
  function computeTotals(planes: DesignPlane[]) {
    const d = designRef.current!; let count = 0, kwp = 0, kwh = 0
    planes.forEach((p) => {
      const mod = moduleById(p.moduleId ?? moduleId); const n = p.panels?.length ?? 0
      count += n; kwp += (n * mod.watts) / 1000; kwh += (n * mod.watts / 1000) * regionYield(d.address).yield * planeYieldFactor(p)
    })
    return { panels: count, systemKwp: Math.round(kwp * 10) / 10, annualKwh: Math.round(kwh) }
  }
  // Undo/redo: every mutation snapshots the previous planes here; undo/redo swap between the stacks.
  function recordHistory() {
    const d = designRef.current; if (!d) return
    undoStack.current.push(d.planes); if (undoStack.current.length > 80) undoStack.current.shift()
    redoStack.current = []; setHistTick((t) => t + 1)
  }
  function commitSnapshot(planes: DesignPlane[]) {
    recordHistory()
    const d = designRef.current!
    act.updateDesign(d.id, { planes, ...computeTotals(planes) })
  }
  function undo() {
    const d = designRef.current; if (!d || !undoStack.current.length) return
    redoStack.current.push(d.planes)
    const prev = undoStack.current.pop()!
    act.updateDesign(d.id, { planes: prev, ...computeTotals(prev) })
    setSelPanelIds([]); setHistTick((t) => t + 1)
  }
  function redo() {
    const d = designRef.current; if (!d || !redoStack.current.length) return
    undoStack.current.push(d.planes)
    const next = redoStack.current.pop()!
    act.updateDesign(d.id, { planes: next, ...computeTotals(next) })
    setSelPanelIds([]); setHistTick((t) => t + 1)
  }
  commitRef.current = commitSnapshot
  undoRef.current = undo; redoRef.current = redo
  // Drop-pin → recentre the design on the exact roof and re-detect there (fixes an off postcode geocode).
  onNoteRef.current = (ll: LatLng) => setNoteDraft({ lat: ll.lat, lng: ll.lng, text: '' })
  onPinRef.current = (ll: LatLng) => {
    if (!design) return
    act.updateDesign(design.id, { center: ll })
    if (map.current) map.current.setView([ll.lat, ll.lng], 20)
    setTool('select')
    runDetect(ll)
  }
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
    // Ovi's installer-style designer, shown as a preview to approve — nothing changes until it's approved
    const res = oviDesign(planesIn, mod, intent.goal, { restrict, obstacles: obsRings(d), setbackM: d.setbackM })
    setOvi({ goal: intent.goal.kind === 'target-kwp' ? 'kwp' : intent.goal.kind === 'target-kwh' ? 'usage' : 'max', kwp: intent.goal.kind === 'target-kwp' ? intent.goal.kwp : 6, result: res })
    setPreview({ planes: res.planes, removed: new Set() })
    const annual = res.planes.reduce((s, p) => { const m = moduleById(p.moduleId ?? mod.id); const n = p.panels?.length ?? 0; return s + (n * m.watts / 1000) * yieldPerKwp * planeYieldFactor(p) }, 0)
    const used = res.planes.filter((p) => p.panels?.length).length
    if (res.count === 0) return 'No panels fit those constraints — the roofs may be too small or the scope too narrow. Try “maximum coverage”, or widen the setback.'
    let out = `${aiMessage ? aiMessage + '\n' : ''}Placed ${res.count} panels — ${res.kwp} kWp across ${used} plane${used === 1 ? '' : 's'} (~${Math.round(annual).toLocaleString()} kWh/yr).`
    if (intent.billKwh) out += `\nThat covers ~${Math.round((annual / intent.billKwh) * 100)}% of the ${intent.billKwh.toLocaleString()} kWh bill.`
    out += '\nIt’s on the roof as a preview — approve it there, or tell me what to change.'
    return out
  }
  // One entry point for the top-left tool rail. Cleans up the mode we're leaving, arms the next one.
  // Clicking the active tool drops back to Select — the safe "nothing armed" default.
  function selectTool(t: Tool) {
    const m = map.current; if (!m) return
    if (drawing) m.pm.disableDraw()
    if (editing) m.pm.disableGlobalEditMode()
    ghostLayer.current?.clearLayers(); editMeasureLayer.current?.clearLayers(); setGhostN(null); setRotDeg(null); m.dragging.enable(); m.getContainer().style.cursor = ''
    const next: Tool = t !== 'select' && tool === t ? 'select' : t
    setTool(next)
    if (next !== 'select') setSelPanelIds([])
    if (next === 'draw') m.pm.enableDraw('Polygon', { snappable: true })
    else if (next === 'edit') m.pm.enableGlobalEditMode({ allowSelfIntersection: false })
    else if ((next === 'add' || next === 'remove' || next === 'rotate') && !design?.planes.length) act.toast('Draw or detect a roof first, then use the panel tools', 'warning')
    setEditPlaneId(null); setCtx(null)
  }

  /** Re-split the detected roof as gabled or hipped (keeps hand-drawn faces; panels on the old panes go). */
  async function setRoofStyle(style: RoofStyle) {
    const d = designRef.current; if (!d?.roofModel || !d.center || busy) return
    if (roofStyleOf(d.roofModel) === style) return
    setBusy(true); setStatus(style === 'hip' ? 'Re-splitting as a hipped roof…' : 'Re-splitting with gable ends…')
    try {
      const res = await resplitRoof(d.center, d.roofModel, style)
      const kept = d.planes.filter((p) => p.source === 'manual')
      recordHistory()
      act.updateDesign(d.id, { planes: [...res.planes, ...kept], roofModel: res.model, ...computeTotals([...res.planes, ...kept]) })
      setSelId(null); setSelPanelIds([])
      act.toast(`${style === 'hip' ? 'Hipped' : 'Gabled'} roof — ${res.planes.length} panes`)
    } finally { setBusy(false); setStatus('') }
  }

  if (!design) return (<><TopBar title="Design" crumbs={['Design']} /><PageMissing onBack={() => nav('/design')} /></>)

  const roofArea = totalRoofArea(design.planes)
  const totals = design.planes.reduce((a, p) => {
    const mod = moduleById(p.moduleId ?? moduleId); const n = p.panels?.length ?? 0
    return { count: a.count + n, kwp: a.kwp + (n * mod.watts) / 1000, kwh: a.kwh + (n * mod.watts / 1000) * regionYield(design.address).yield * planeYieldFactor(p) }
  }, { count: 0, kwp: 0, kwh: 0 })
  const kwp = Math.round(totals.kwp * 10) / 10
  const sel = design.planes.find((p) => p.id === selId)

  /** Push this design into a showroom proposal — the customer-facing presentation. Re-pushing the
   *  same design updates its proposal rather than creating a second one. */
  async function pushToProposal() {
    if (!design || !totals.count) { act.toast('Add panels before creating a proposal', 'warning'); return }
    const deal = deals.find((d) => d.id === design.dealId)
    const j = deal?.journey
    const batteryKwh = design.batteryKwh ?? j?.system?.batteryKwh ?? 0
    // the proposal carries the design's own MCS generation and price, so every page agrees with the studio
    const mcs = await estimateDesign(design, moduleId, effTilt)
    const price = design.priceOverride ?? designPrice(design, kwp, totals.count, studioConfig).total
    const sdesign = { systemKwp: kwp, panels: totals.count, hasBattery: batteryKwh > 0, batteryKwh, hasEv: !!j?.property.hasEv, addEvCharger: !!j?.system?.evCharger, price, annualGenKwh: mcs?.annualKwh }
    const existing = showroom.find((s) => s.designId === design.id)
    if (existing) {
      act.updateShowroom(existing.id, { design: sdesign })
      act.toast(`Proposal updated · ${kwp} kWp, ${totals.count} panels`)
      nav(`/showroom/${existing.id}`)
      return
    }
    const monthly = j?.property.monthlyBill ?? 140
    const s = act.createShowroom({
      name: deal?.name ?? design.name, email: j?.email ?? '', phone: j?.phone, address: j?.address ? `${j.address}, ${j.postcode}` : design.address, postcode: j?.postcode,
      monthlySpend: monthly, annualKwh: j?.property.annualKwh ?? Math.round(((monthly - 12) * 12) / 0.245), tariffPence: 24.5, occupancy: 'in_half_day',
      design: sdesign, dealId: deal?.id, presenter: deal?.owner, designId: design.id,
      location: j ? ({ cardiff: 'Cardiff', cheltenham: 'Cheltenham', melksham: 'Melksham' } as const)[j.showroom] : undefined,
    })
    nav(`/showroom/${s.id}`)
  }

  // Steps follow the scope: solar brings the roof tabs, battery and EV bring their own; everything shares Home & usage.
  const sc = scopeOf(design)
  const tabs: { id: StudioTab; label: string; icon: any }[] = [
    ...(sc.pv ? [{ id: 'design' as const, label: 'Design', icon: Sun }, { id: 'array' as const, label: 'Array', icon: Grid }] : []),
    { id: 'home', label: 'Home & usage', icon: Home },
    ...(sc.battery ? [{ id: 'battery' as const, label: 'Battery', icon: Layers }] : []),
    ...(sc.ev ? [{ id: 'ev' as const, label: 'EV charger', icon: Bolt }] : []),
    ...(sc.pv ? [{ id: 'production' as const, label: 'Production', icon: Pie }] : []),
    { id: 'savings', label: 'Savings', icon: Target },
    ...(sc.pv ? [{ id: 'electrical' as const, label: 'Electrical', icon: Wrench }] : []),
    { id: 'kit', label: 'Kit list', icon: Box },
    { id: 'proposal', label: 'Proposal', icon: File },
  ]
  const scopeLabel = [sc.pv && 'Solar', sc.battery && 'Battery', sc.ev && 'EV'].filter(Boolean).join(' + ')

  return (
    <div ref={rootRef} className="flex flex-col flex-1 min-h-0 h-full bg-canvas">
      <TopBar title={design.name} crumbs={['Design']} identity={{ icon: Sun, accent: '#62E4CC' }} tabs={{ items: tabs, value: tabs.some((t) => t.id === tab) ? tab : tabs[0].id, onChange: (id) => setTab(id as StudioTab) }}
        actions={<div className="flex items-center gap-2">{<button onClick={() => setScopeOpen(true)} title={`${scopeLabel} — change what's being designed, or mark it surveyed`} className="h-9 px-3 rounded-[10px] inline-flex items-center gap-2 text-[12.5px] font-bold whitespace-nowrap" style={{ background: 'rgba(21,34,59,0.08)', color: '#15223B' }}><span className="inline-flex items-center gap-1" aria-label={scopeLabel || 'Choose scope'}>{sc.pv && <Sun size={14} />}{sc.battery && <Layers size={14} />}{sc.ev && <Bolt size={14} />}</span><span className="h-5 px-1.5 rounded-full text-[10.5px] inline-flex items-center" style={design.stage === 'surveyed' ? { background: '#15223B', color: '#62E4CC' } : { background: '#FEF3C7', color: '#92400E' }}>{design.stage === 'surveyed' ? 'Surveyed' : 'Estimate'}</span></button>}
          {/* Only the page-level decisions live up here — the roof/panel tools sit on the canvas where you use them. */}
          <span title={isFs ? 'Exit full screen' : 'Full screen'}><Button variant="secondary" icon={<MaximizeIcon on={isFs} />} onClick={toggleFs} className="px-2.5">{null}</Button></span>
          <Button variant="secondary" icon={<Check size={15} />} onClick={() => act.updateDesign(design.id, { status: design.status === 'confirmed' ? 'draft' : 'confirmed' })}>{design.status === 'confirmed' ? 'Confirmed' : 'Confirm'}</Button>
          <Button variant="primary" icon={<File size={15} />} onClick={pushToProposal}>{showroom.some((s) => s.designId === design.id) ? 'Update proposal' : 'Create proposal'}</Button>
        </div>} />


      <div className="flex-1 min-h-0 relative">
        {/* Canvas + inspector — always mounted, hidden (not unmounted) on info tabs so Leaflet survives */}
        <div className={`absolute inset-0 flex gap-4 px-5 py-4 ${canvasVisible ? '' : 'invisible pointer-events-none'}`}>
          <div className="relative flex-1 min-h-0 rounded-card overflow-hidden border border-border">
            <div ref={mapEl} className="absolute inset-0 select-none" style={{ background: '#0b1220', isolation: 'isolate', WebkitUserSelect: 'none', userSelect: 'none', WebkitTapHighlightColor: 'transparent' }} onMouseDown={(e) => { if (e.detail > 1) e.preventDefault() }} />
            {view === '3d' && canvasVisible && <Design3D design={design} adding={adding} selecting={tool === 'select'} moduleId={moduleId} onCommitPanels={(pid, panels) => commitSnapshot(design.planes.map((p) => (p.id === pid ? { ...p, panels, moduleId: p.moduleId ?? moduleId } : p)))} onSelectPanels={(pid, ids) => { if (pid) setSelId(pid); setSelPanelIds(ids) }} onCapture={() => { setView('2d'); setTimeout(() => selectTool('draw'), 80) }} />}
            {canvasVisible && (
              <div className="absolute top-3 left-3 z-[560] flex flex-col gap-1 bg-white/95 backdrop-blur border border-border rounded-control shadow-modal p-1 overflow-y-auto" style={{ maxHeight: 'calc(100% - 24px)' }}>
                {view === '3d' ? <>
                  <ToolBtn on={tool === 'pan'} onClick={() => selectTool('pan')} icon={<HandIcon />} label="Orbit / move the camera" />
                  <ToolBtn on={tool === 'select'} onClick={() => selectTool('select')} icon={<CursorIcon />} label="Select / move a panel" />
                  <ToolBtn on={tool === 'add'} onClick={() => selectTool('add')} icon={<Grid size={15} />} label="Add panels" />
                </> : <>
                  {/* One pointer does the everyday work (select, move, place panels, pan) — the rail is only
                      for the few things that genuinely need a mode, plus the whole-roof actions. */}
                  <ToolBtn on={tool === 'select'} onClick={() => selectTool('select')} icon={<CursorIcon />} label="Select & place — click a face, then click the roof to add panels" />
                  <ToolBtn on={tool === 'draw'} onClick={() => selectTool('draw')} icon={<Plus size={15} />} label="Draw a roof face" />
                  <ToolBtn on={false} onClick={() => addKeepout()} icon={<Box size={15} />} label="Add keep-out (vent / chimney / skylight)" />
                  <ToolBtn on={tool === 'note'} onClick={() => selectTool('note')} icon={<File size={14} />} label="Pin a site note" />
                </>}
                <span className="h-px mx-1.5 my-0.5 bg-divider" />
                <ToolBtn on={busy} onClick={() => runDetect()} icon={<Radar size={15} />} label="Detect roof — outline + panes" />
                <ToolBtn on={!!ovi} onClick={() => previewOvi()} icon={<Grid size={15} />} label="Preview Ovi's design" />
                <ToolBtn on={oviOpen} onClick={() => setOviOpen(true)} icon={<Sparkle size={15} />} label="Design with Ovi — describe the system you want" />
                {totals.count > 0 && <ToolBtn on={false} onClick={clearAllPanels} icon={<EraseIcon />} label="Clear all panels" />}
                <span className="h-px mx-1.5 my-0.5 bg-divider" />
                <ToolBtn on={false} onClick={undo} icon={<UndoIcon />} label={`Undo (Ctrl+Z)${undoStack.current.length ? '' : ' — nothing to undo'}`} />
                <ToolBtn on={false} onClick={redo} icon={<RedoIcon />} label="Redo (Ctrl+Shift+Z)" />
              </div>
            )}
            <div className={`absolute z-[550] flex items-center gap-1 bg-white/95 backdrop-blur border border-border rounded-control shadow-modal p-1 ${view === '3d' ? 'bottom-3 right-3' : 'top-3 right-3'}`}>
              {view === '2d' && (
                <>
                  <button onClick={() => (ovi ? discardPreview() : previewOvi())} title="Ovi designs the roof the way an installer would — see it first, approve it if you like it" className="h-8 px-2.5 rounded-[8px] text-[12px] font-bold inline-flex items-center gap-1 text-[#15223B]" style={{ background: '#62E4CC' }}><Sparkle size={12} />{ovi ? 'Close preview' : 'Preview Ovi’s design'}</button>
                  {hdReady && <button onClick={() => setHdOn((v) => !v)} title={hdOn ? 'High-res Google aerial — on' : 'Show high-res Google aerial'} className={`h-8 px-2.5 rounded-[8px] text-[12px] font-bold inline-flex items-center gap-1 ${hdOn ? 'text-white' : 'text-ink-3 hover:bg-control'}`} style={hdOn ? { background: '#15223B' } : undefined}><Sun size={12} />HD</button>}
                  <button onClick={() => setBoundaryOn((v) => !v)} title="Land-ownership boundary (HMLR INSPIRE, else building footprint)" className={`h-8 px-2.5 rounded-[8px] text-[12px] font-bold inline-flex items-center gap-1 ${boundaryOn ? 'text-white' : 'text-ink-3 hover:bg-control'}`} style={boundaryOn ? { background: '#15223B' } : undefined}><Target size={12} />Plot</button>
                  <button onClick={() => setSeeThrough((v) => !v)} title="See-through panels (X) — see the roof under the array" className={`h-8 px-2.5 rounded-[8px] text-[12px] font-bold inline-flex items-center gap-1 ${seeThrough ? 'text-white' : 'text-ink-3 hover:bg-control'}`} style={seeThrough ? { background: '#15223B' } : undefined}><Grid size={12} />See-through</button>
                  <button onClick={() => setMeasureOn((v) => !v)} title="Show roof measurements — edge lengths & face area" className={`h-8 px-2.5 rounded-[8px] text-[12px] font-bold inline-flex items-center gap-1 ${measureOn ? 'text-white' : 'text-ink-3 hover:bg-control'}`} style={measureOn ? { background: '#15223B' } : undefined}><Wrench size={12} />Measure</button>
                  <span className="w-px h-5 bg-divider" />
                </>
              )}
              {(['2d', '3d'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`h-8 px-3 rounded-[8px] text-[12.5px] font-bold ${view === v ? 'text-white' : 'text-ink-3 hover:bg-control'}`} style={view === v ? { background: '#15223B' } : undefined}>{v.toUpperCase()}</button>
              ))}
            </div>
            {busy && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] h-9 px-4 rounded-full bg-black/75 text-white text-[12.5px] font-semibold flex items-center gap-2 shadow-modal"><span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />{status}</div>
            )}
            {preview && ovi && (() => {
              const kept = preview.planes.reduce((s, p) => s + (p.panels ?? []).filter((pn) => !preview.removed.has(pn.id)).length, 0)
              const y = regionYield(design.address).yield
              const kwh = preview.planes.reduce((s, p) => s + (p.panels ?? []).filter((pn) => !preview.removed.has(pn.id)).length * (module.watts / 1000) * y * planeYieldFactor(p), 0)
              const usage = design.annualConsumptionKwh ?? design.home?.smartMeter?.annualKwh
              const goalBtn = (g: 'max' | 'kwp' | 'usage', label: string, disabled = false) => (
                <button disabled={disabled} onClick={() => previewOvi(g)} title={disabled ? 'Add the home’s annual usage on the Home & usage tab first' : undefined} className={`h-7 px-2.5 rounded-[6px] text-[12px] font-semibold ${ovi.goal === g ? 'bg-white text-ink font-bold shadow-sm' : 'text-muted-b hover:text-ink-3'} disabled:opacity-40`}>{label}</button>
              )
              return (
                <div className="absolute top-16 right-3 z-[520] w-[310px] max-h-[calc(100%-5rem)] overflow-y-auto rounded-[14px] bg-white shadow-modal border border-border">
                  <div className="px-4 pt-3.5 pb-3 border-b border-divider">
                    <div className="flex items-center gap-2"><span className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[#15223B]" style={{ background: '#62E4CC' }}><Sparkle size={14} /></span><div className="text-[14px] font-bold text-ink">Ovi’s design</div><span className="text-[11px] text-muted-b">{oviMin ? `· ${kept} panels · ${kwpOf(kept, module.watts)} kWp` : 'preview'}</span><button onClick={() => setOviMin((v) => !v)} title={oviMin ? 'Show details' : 'Minimise — see the roof'} className="ml-auto h-6 w-6 rounded-[6px] text-muted-b hover:bg-control text-[14px] leading-none">{oviMin ? '▾' : '▴'}</button></div>
                    {!oviMin && <>
                    <div className="mt-2.5 flex p-0.5 rounded-[8px] bg-[#E9EDF2] border border-[#DDE3EA] w-fit">
                      {goalBtn('max', 'Best fit')}{goalBtn('kwp', 'Target kWp')}{goalBtn('usage', 'Match usage', !usage)}
                    </div>
                    {ovi.goal === 'kwp' && (
                      <label className="mt-2 flex items-center gap-2 text-[12px] text-muted-b">Size
                        <input type="number" min={1} max={30} step={0.5} value={ovi.kwp} onChange={(e) => { const v = Number(e.target.value); if (v > 0) previewOvi('kwp', v) }} className="w-20 h-7 px-2 rounded-control border border-input-border text-[12.5px] text-ink outline-none focus:border-accent" />kWp
                        <span className="ml-1 text-[11px]">≈ {Math.round((ovi.kwp * 1000) / module.watts)} × {module.watts} W</span>
                      </label>
                    )}
                    {ovi.goal === 'usage' && usage ? <div className="mt-2 text-[11.5px] text-muted-b">Sized to generate the home’s {usage.toLocaleString()} kWh a year.</div> : null}
                    </>}
                  </div>
                  {!oviMin && <div className="px-4 py-3 grid grid-cols-3 gap-2 border-b border-divider text-center">
                    <div><div className="text-[18px] font-bold text-ink leading-none">{kept}</div><div className="text-[10.5px] text-muted-b mt-1">panels</div></div>
                    <div><div className="text-[18px] font-bold text-ink leading-none">{kwpOf(kept, module.watts)}</div><div className="text-[10.5px] text-muted-b mt-1">kWp</div></div>
                    <div><div className="text-[18px] font-bold text-ink leading-none">{Math.round(kwh).toLocaleString()}</div><div className="text-[10.5px] text-muted-b mt-1">kWh / yr</div></div>
                  </div>}
                  {!oviMin && <div className="px-4 py-2.5 flex flex-col gap-1.5">
                    <div className="text-[10.5px] font-bold uppercase tracking-wide text-muted-3">Face by face</div>
                    {ovi.result.notes.map((n) => (
                      <div key={n.planeId} className="flex items-start gap-2 text-[12px] leading-snug">
                        <span className={`mt-[3px] w-2 h-2 rounded-full shrink-0 ${n.used ? 'bg-[#0E9A82]' : 'bg-[#C9D1DB]'}`} />
                        <div><b className="text-ink-2">{n.name}</b> <span className="text-muted-b">— {n.text}</span></div>
                      </div>
                    ))}
                    <div className="text-[11px] text-muted-2 mt-1">Click any panel on the map to leave it out.</div>
                  </div>}
                  <div className="px-4 pb-3.5 pt-1 flex items-center gap-2">
                    <Button onClick={discardPreview}>Discard</Button>
                    <Button variant="primary" icon={<Check size={15} />} onClick={acceptPreview} className={`flex-1 justify-center ${kept === 0 ? 'opacity-40 pointer-events-none' : ''}`}>Approve Ovi’s design</Button>
                  </div>
                </div>
              )
            })()}
            {preview && !ovi && (() => {
              const kept = preview.planes.reduce((s, p) => s + (p.panels ?? []).filter((pn) => !preview.removed.has(pn.id)).length, 0)
              return (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] bg-surface rounded-card shadow-modal border border-border px-4 py-3 flex items-center gap-3">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-2"><Sparkle size={15} className="text-accent" /> {kept} panel{kept === 1 ? '' : 's'} suggested</div>
                  <div className="text-[11.5px] text-muted-2">Click a panel to drop it</div>
                  <Button onClick={discardPreview}>Discard</Button>
                  <Button variant="primary" icon={<Check size={15} />} onClick={acceptPreview} className={kept === 0 ? 'opacity-40 pointer-events-none' : ''}>Accept {kept}</Button>
                </div>
              )
            })()}
            {drawing && !busy && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[500] h-9 px-4 rounded-full text-white text-[12.5px] font-semibold flex items-center gap-2 shadow-modal" style={{ background: '#15223B' }}><Target size={14} />Click each corner of the roof, then click the first point to close</div>
            )}
            {view === '2d' && tool === 'note' && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[520] w-[340px] rounded-[12px] bg-white shadow-modal border border-border p-3">
                {noteDraft ? <>
                  <div className="text-[12px] font-bold text-ink mb-1.5">Site note {(design.notes?.length ?? 0) + 1}</div>
                  <textarea autoFocus value={noteDraft.text} onChange={(e) => setNoteDraft({ ...noteDraft, text: e.target.value })} placeholder="e.g. Scaffold access via side gate · cable route through loft · consumer unit in garage" className="w-full h-16 rounded-[8px] border border-[#E1E6EC] p-2 text-[12.5px] resize-none outline-none focus:border-[#62E4CC]" />
                  <div className="flex gap-2 mt-2 justify-end"><button onClick={() => setNoteDraft(null)} className="h-8 px-3 rounded-[8px] text-[12px] font-semibold text-ink-3 hover:bg-control">Cancel</button><button onClick={() => { if (noteDraft.text.trim()) act.updateDesign(design.id, { notes: [...(design.notes ?? []), { id: uid('n'), lat: noteDraft.lat, lng: noteDraft.lng, text: noteDraft.text.trim(), at: Date.now() }] }); setNoteDraft(null) }} className="h-8 px-3 rounded-[8px] bg-[#15223B] text-white text-[12px] font-semibold">Pin note</button></div>
                </> : <>
                  <div className="text-[12px] text-ink-3"><b className="text-ink">Click the map</b> to pin a site note. Drag a pin to move it.</div>
                  {(design.notes ?? []).map((n, i) => <div key={n.id} className="flex items-start gap-2 mt-2 text-[12px]"><span className="w-5 h-5 shrink-0 rounded-full bg-[#F59E0B] text-[#15223B] font-bold text-[10.5px] flex items-center justify-center">{i + 1}</span><span className="flex-1 text-ink-2">{n.text}</span><button onClick={() => act.updateDesign(design.id, { notes: (design.notes ?? []).filter((x) => x.id !== n.id) })} className="text-muted-3 hover:text-ink">✕</button></div>)}
                </>}
              </div>
            )}
            {view === '2d' && !busy && editPlaneId && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[510] h-10 pl-4 pr-1.5 rounded-full text-white text-[12px] font-semibold flex items-center gap-3 shadow-modal whitespace-nowrap" style={{ background: '#15223B' }}>
                <span className="flex items-center gap-2"><Wrench size={13} />Drag a corner to reshape · click an edge for a new corner · right-click a corner to remove it</span>
                <button onClick={() => setEditPlaneId(null)} className="h-7 px-3 rounded-full text-[12px] font-bold" style={{ background: '#62E4CC', color: '#15223B' }}>Done</button>
              </div>
            )}
            {!busy && sel && !editPlaneId && (
              <div className={`absolute top-3 left-[64px] z-[540] flex pointer-events-none [&>*]:pointer-events-auto overflow-x-auto ${view === '3d' ? 'right-3' : 'right-[232px]'}`}>
                <ArrayToolbar sel={sel} moduleId={moduleId} onUpdate={updatePlane} onCentre={centreArray} onFill={() => fillPlane(sel.id)} onEdit={view === '2d' ? () => setEditPlaneId(sel.id) : undefined} />
              </div>
            )}
            {ctx && view === '2d' && (() => {
              const face = design.planes.find((p) => p.id === ctx.pid)
              const nSel = selPanelIds.length
              const item = (label: string, fn: () => void, danger?: boolean) => (
                <button key={label} onClick={() => { setCtx(null); fn() }} className={`w-full text-left h-8 px-3 rounded-[7px] text-[12.5px] font-semibold whitespace-nowrap hover:bg-control ${danger ? 'text-[#E5484D]' : 'text-ink-2'}`}>{label}</button>
              )
              const deleteSelected = () => { const ids = new Set(selPanelIds); commitSnapshot(design.planes.map((p) => ({ ...p, panels: (p.panels ?? []).filter((pn) => !ids.has(pn.id)) }))); setSelPanelIds([]) }
              return (
                <div className="absolute z-[600] min-w-[200px] rounded-[10px] bg-white border border-border shadow-modal p-1" style={{ left: Math.min(ctx.x, (mapEl.current?.clientWidth ?? 800) - 210), top: Math.min(ctx.y, (mapEl.current?.clientHeight ?? 600) - 250) }} onContextMenu={(e) => e.preventDefault()}>
                  {ctx.panelId && nSel > 0 && <>
                    <div className="px-3 pt-1.5 pb-1 text-[10.5px] font-bold uppercase tracking-wide text-muted-3">{nSel} panel{nSel === 1 ? '' : 's'}</div>
                    {item('Select the whole array', () => selectArrayRef.current(ctx.ll))}
                    {face && item('Select all on this face', () => setSelPanelIds((face.panels ?? []).map((pn) => pn.id)))}
                    {item(`Delete ${nSel === 1 ? 'panel' : `${nSel} panels`}`, deleteSelected, true)}
                    <div className="h-px bg-divider my-1" />
                  </>}
                  {face && <>
                    <div className="px-3 pt-1.5 pb-1 text-[10.5px] font-bold uppercase tracking-wide text-muted-3">{face.name}</div>
                    {item('Fill with panels', () => fillPlane(face.id))}
                    {!!face.panels?.length && item('Clear panels', () => clearPlane(face.id))}
                    {item('Tidy shape (T)', () => tidyPlanes([face.id]))}
                    {face.pitchDeg > 0 && item('Make it a flat roof', () => mergePlanes([face.id], true))}
                    {neighbours(design.planes, face.id).slice(0, 4).map((nb) => item(`Merge with ${compass(nb.azimuthDeg)} ${nb.pitchDeg}° · ${nb.areaM2} m²`, () => mergePlanes([face.id, nb.id], face.pitchDeg === 0 || nb.pitchDeg === 0)))}
                    {item('Reshape corners', () => { setSelId(face.id); setEditPlaneId(face.id) })}
                    {item('Delete face', () => deletePlane(face.id), true)}
                    <div className="h-px bg-divider my-1" />
                  </>}
                  {item('Detect the roof here', () => onPinRef.current(ctx.ll))}
                  {item('Add a keep-out here', () => addKeepout(ctx.ll))}
                  {item('Pin a site note here', () => { setTool('note'); setNoteDraft({ lat: ctx.ll.lat, lng: ctx.ll.lng, text: '' }) })}
                  {!face && item('Draw a roof face', () => selectTool('draw'))}
                </div>
              )
            })()}
            {view === '2d' && !busy && selObsId && (() => {
              const o = (design.obstacles ?? []).find((x) => x.id === selObsId); if (!o) return null
              const meta = OBST[o.kind]
              return (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[540] flex items-center gap-1 bg-white/95 backdrop-blur border border-border rounded-control shadow-modal p-1">
                  <span className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-2 text-[12.5px] font-bold"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: meta.c }} />{meta.label}{o.heightM ? ` · ${o.heightM} m` : ''}</span>
                  <button onClick={() => cycleObstacleKind(o.id)} className="h-8 px-2.5 rounded-[8px] text-[12px] font-bold text-ink-3 hover:bg-control">Change type</button>
                  <span className="w-px h-5 bg-divider" />
                  <button onClick={() => deleteObstacle(o.id)} className="h-8 px-2.5 rounded-[8px] text-[12px] font-bold hover:bg-control" style={{ color: '#E5484D' }}>Delete</button>
                </div>
              )
            })()}
            {view === '2d' && boundaryOn && boundaryInfo && (
              <div className="absolute bottom-3 left-3 z-[500] h-8 px-3 rounded-full bg-white/95 backdrop-blur border border-border shadow-modal text-[11.5px] font-semibold inline-flex items-center gap-1.5 max-w-[380px]">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: boundaryInfo.source === 'inspire' ? '#62E4CC' : '#F5A524' }} />
                <span className="truncate">{boundaryInfo.source === 'inspire' ? 'Land Registry title boundary (INSPIRE)' : boundaryInfo.found ? 'Building footprint — connect INSPIRE for the legal plot' : 'No boundary found here'}</span>
              </div>
            )}
            {view === '2d' && !busy && !drawing && !editPlaneId && !preview && design.planes.length > 0 && tool === 'select' && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[500] h-9 px-4 rounded-full bg-white/95 backdrop-blur border border-border text-ink-2 text-[12.5px] font-semibold flex items-center gap-2 shadow-modal whitespace-nowrap max-w-[calc(100%-24px)] overflow-hidden">
                {selPanelIds.length
                  ? <><CursorIcon /><b className="text-ink">{selPanelIds.length} panel{selPanelIds.length === 1 ? '' : 's'}</b> · drag to move · handle rotates · arrows nudge · Del removes</>
                  : sel
                    ? <><Grid size={14} />Click the roof to add a panel · drag to select panels · shift-drag to paint a block{ghostN != null ? ` (${ghostN})` : ''} · X see-through</>
                    : <><CursorIcon />Click a roof face to work on it · drag the map to pan · double-click a face to reshape · right-click for more</>}
              </div>
            )}
            {design.planes.length === 0 && !busy && !drawing && (
              <div className="absolute inset-0 z-[400] flex items-center justify-center pointer-events-none">
                <div className="bg-surface/95 backdrop-blur border border-border rounded-card px-6 py-5 text-center shadow-modal max-w-[380px] pointer-events-auto">
                  <span className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-white mb-3" style={{ background: '#15223B' }}><Sun size={22} /></span>
                  <div className="text-[15px] font-bold text-ink">Capture the roof</div>
                  <div className="text-[12.5px] text-muted-b mt-1"><b>Detect roof</b> traces the building outline and splits it into panes along the ridges, hips and valleys. Or <b>draw</b> a face by hand. Wrong house? Right-click the right roof → <i>Detect the roof here</i>.</div>
                  <div className="flex items-center gap-2 justify-center mt-3 flex-wrap">
                    <button onClick={() => runDetect()} className="h-9 px-3.5 rounded-control text-white text-[13px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap" style={{ background: '#15223B' }}><Radar size={14} />Detect roof</button>
                    <button onClick={() => selectTool('draw')} className="h-9 px-3.5 rounded-control border border-border text-[13px] font-semibold text-ink-3 hover:bg-control inline-flex items-center gap-1.5 whitespace-nowrap"><Plus size={14} />Draw a face</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right inspector — switches depth by tab */}
          {tab === 'array'
            ? <ArrayInspector design={design} sel={sel} moduleId={moduleId} setModuleId={setModuleId} onSelect={setSelId} onUpdate={updatePlane} onFill={fillPlane} onClear={clearPlane} onDelete={deletePlane}
                targetKwp={targetKwp} setTargetKwp={setTargetKwp} onGoal={runAutoLayout} kwp={kwp} count={totals.count} />
            : <DesignInspector roofStyle={roofStyleOf(design.roofModel)} onRoofStyle={setRoofStyle} design={design} selId={selId} onSelect={setSelId} onUpdate={updatePlane} onFill={fillPlane} onClear={clearPlane} onDelete={deletePlane} moduleId={moduleId} setModuleId={setModuleId} kwp={kwp} totalPanels={totals.count} annualKwh={totals.kwh} roofArea={roofArea} module={module} onHeight={(m) => act.updateDesign(design.id, { eaveHeightM: m, heightSource: 'manual' })} onPatch={(patch) => act.updateDesign(design.id, patch)} onClearPlanes={clearAllPlanes} onTidy={tidyPlanes} onRedetect={() => runDetect(design.center)} onBackToProspect={design.prospectId ? () => nav('/tools/company-search') : undefined} />
          }
        </div>

        {tab === 'production' && <McsProduction design={design} moduleId={moduleId} effTilt={effTilt} />}
        {tab === 'savings' && <Savings design={design} moduleId={moduleId} effTilt={effTilt} />}
        {tab === 'home' && <HomeEnergy design={design} moduleId={moduleId} effTilt={effTilt} />}
        {tab === 'battery' && sc.battery && <BatteryDesigner design={design} moduleId={moduleId} effTilt={effTilt} />}
        {tab === 'ev' && sc.ev && <EvDesigner design={design} moduleId={moduleId} effTilt={effTilt} />}
        {(scopeOpen || (!design.scope && design.planes.length === 0)) && <ScopePicker design={design} onClose={() => setScopeOpen(false)} onDone={(s) => { setScopeOpen(false); if (!s.pv) setTab('home'); else if (!sc.pv) setTab('design') }} />}
        {tab === 'electrical' && <Electrical design={design} moduleId={moduleId} kwp={kwp} />}
        {tab === 'kit' && <KitList design={design} moduleId={moduleId} kwp={kwp} />}
        {tab === 'proposal' && <ProposalPane design={design} kwp={kwp} count={totals.count} annualKwh={Math.round(totals.kwh)} onPush={pushToProposal} hasProposal={showroom.some((s) => s.designId === design.id)} onOpen={() => nav('/studio/proposals')} onConfirm={() => act.updateDesign(design.id, { status: 'confirmed', systemKwp: kwp, panels: totals.count, annualKwh: Math.round(totals.kwh) })} />}
        <DesignCopilot open={oviOpen} onClose={() => setOviOpen(false)} onExecute={oviExecute} />
      </div>
    </div>
  )
}

/* ── Design-tab inspector: plane list + quick pitch/azimuth + fill ── */
function DesignInspector({ roofStyle, onRoofStyle, design, selId, onSelect, onUpdate, onFill, onClear, onDelete, moduleId, setModuleId, kwp, totalPanels, annualKwh, roofArea, module, onHeight, onPatch, onClearPlanes, onTidy, onRedetect, onBackToProspect }: {
  roofStyle: RoofStyle | null; onRoofStyle: (s: RoofStyle) => void; design: Design; selId: string | null; onSelect: (id: string) => void; onUpdate: (id: string, patch: Partial<DesignPlane>, repack?: boolean) => void
  onFill: (id: string) => void; onClear: (id: string) => void; onDelete: (id: string) => void; moduleId: string; setModuleId: (v: string) => void
  kwp: number; totalPanels: number; annualKwh: number; roofArea: number; module: Module; onHeight: (m: number) => void; onPatch: (patch: Partial<Design>) => void; onClearPlanes: () => void; onTidy: (ids?: string[]) => void; onRedetect: () => void; onBackToProspect?: () => void
}) {
  const quality = new Map(design.planes.map((p) => [p.id, paneQuality(p.polygon, p.pitchDeg >= 6 ? p.azimuthDeg : undefined, design.planes.filter((q) => q.id !== p.id).map((q) => q.polygon))]))
  // flag a face only when Tidy would actually change it — a warning the button can't clear is just noise
  const tidied = tidyRoofLL(design.planes)
  const mL = 111320 * Math.cos(((design.center?.lat ?? 52) * Math.PI) / 180)
  const wouldTidy = new Set(design.planes.filter((p, i) => { const t = tidied[i]; return !!t && (t.length !== p.polygon.length || t.some((v, k) => Math.hypot((v.lat - p.polygon[k].lat) * 110540, (v.lng - p.polygon[k].lng) * mL) > 0.05)) }).map((p) => p.id))
  const nIssues = wouldTidy.size
  return (
    <div className="w-[330px] shrink-0 rounded-card bg-surface border border-border flex flex-col overflow-hidden">
      <div className="p-4 border-b border-divider">
        <div className="grid grid-cols-3 gap-2">
          <Metric v={kwp ? `${kwp}` : '—'} u="kWp" hero />
          <Metric v={totalPanels ? String(totalPanels) : '—'} u="panels" hero />
          <Metric v={`${roofArea}`} u="m² roof" hero />
        </div>
        <label className="flex items-center gap-2 mt-3 text-[12px] text-muted-b">
          <Grid size={13} />Module
          <Dropdown value={moduleId} onChange={(e) => setModuleId(e.target.value)} className="flex-1 h-8 px-2 rounded-control border border-input-border bg-white text-[12.5px] outline-none focus:border-accent">
            {MODULES.map((m) => <option key={m.id} value={m.id}>{m.watts} W · {m.brand}</option>)}
          </Dropdown>
        </label>
      </div>
      {design.planes.length > 0 && (
        <div className="px-4 py-2 flex items-center justify-between border-b border-divider">
          <div className="eyebrow text-muted-3">Roof panes · {design.planes.length}</div>
          <div className="flex items-center gap-3">
            <button onClick={() => onTidy()} title="Straighten every face and join them up: stray corners and tiny edges removed, edges squared to the slope, near-miss corners merged into one" className="text-[11.5px] font-semibold text-[#0E7A66] hover:text-ink inline-flex items-center gap-1"><Sparkle size={12} />Tidy all{nIssues > 0 ? ` · ${nIssues}` : ''}</button>
            <button onClick={onClearPlanes} className="text-[11.5px] font-semibold text-muted-b hover:text-negative inline-flex items-center gap-1"><span className="text-[13px] leading-none">✕</span> Clear all</button>
          </div>
        </div>
      )}
      {design.planes.length > 0 && !design.detected && (
        <div className="mx-4 mt-3 rounded-[10px] bg-[#FFF7E6] border border-[#F5D9A8] px-3 py-2.5 flex items-start gap-2.5">
          <div className="text-[11.5px] text-[#92400E] leading-snug flex-1"><b>Detected with an older version.</b> The roof faces were cut before the latest detection fixes. Tidy can straighten them, but re-detecting will cut them properly. Panels on the roof are cleared.</div>
          <button onClick={onRedetect} className="shrink-0 h-7 px-2.5 rounded-[7px] text-white text-[11.5px] font-semibold" style={{ background: '#15223B' }}>Re-detect</button>
        </div>
      )}
      {design.roofModel && roofStyle && (
        <div className="px-4 py-2.5 border-b border-divider flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] text-muted-b">Roof shape</span>
            <div className="flex p-0.5 rounded-[8px] bg-[#E9EDF2] border border-[#DDE3EA]">
              {(['gable', 'hip'] as const).map((s) => (
                <button key={s} onClick={() => onRoofStyle(s)} className={`h-7 px-3 rounded-[6px] text-[12px] font-semibold ${roofStyle === s ? 'bg-white text-ink font-bold shadow-sm' : 'text-muted-b hover:text-ink-3'}`}>{s === 'gable' ? 'Gable ends' : 'Hipped'}</button>
              ))}
            </div>
          </div>
          <div className="text-[11px] text-muted-b leading-snug">
            Outline from {design.roofModel.source === 'google' ? 'Google' : 'OpenStreetMap'}
            {design.roofModel.roles.includes('party') ? ' · party wall found' : ''}
            {design.roofModel.measured ? ' · pitch measured from Google’s height model.' : <> · <b className="text-[#92400E]">pitch assumed {ASSUMED_PITCH}°</b> — no height data here, set it on survey.</>}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {design.planes.length === 0 ? (
          <div className="p-4 text-[12.5px] text-muted-b">No planes yet. Detect the roof or draw a plane, then fill it with panels.</div>
        ) : design.planes.map((p) => (
          <div key={p.id} className={`px-4 py-3 border-b border-divider cursor-pointer ${p.id === selId ? 'bg-accent-wash' : 'hover:bg-control/40'}`} onClick={() => onSelect(p.id)}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-[13px] text-ink-2 flex items-center gap-1.5 min-w-0"><span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.id === selId ? '#62E4CC' : '#62E4CC' }} /><span className="truncate">{p.name}</span></div>
              <button onClick={(e) => { e.stopPropagation(); onDelete(p.id) }} className="text-muted-2 hover:text-negative text-[15px] leading-none shrink-0">✕</button>
            </div>
            <div className="grid grid-cols-4 gap-1.5 mt-2 text-center">
              <Metric v={`${effTilt(p)}°`} u="pitch" small />
              <Metric v={compass(p.azimuthDeg)} u="facing" small />
              <Metric v={`${Math.round(slopedAreaM2(p.areaM2, p.pitchDeg))}`} u="m²" small />
              <Metric v={p.panels?.length ? String(p.panels.length) : '—'} u="panels" small />
            </div>
            {wouldTidy.has(p.id) && !quality.get(p.id)!.ok && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-[8px] bg-[#FFF7E6] border border-[#F5D9A8] px-2.5 py-1.5">
                <span className="text-[11px] text-[#92400E] leading-snug">{quality.get(p.id)!.corners} corners · {quality.get(p.id)!.summary}</span>
                <button onClick={(e) => { e.stopPropagation(); onTidy([p.id]) }} className="shrink-0 h-6 px-2 rounded-[6px] bg-white border border-[#F5D9A8] text-[11px] font-semibold text-[#92400E] hover:bg-[#FFF1D6]">Tidy</button>
              </div>
            )}
            {p.id === selId && (
              <div className="mt-3 flex flex-col gap-2.5">
                <Slider label="Pitch" value={p.pitchDeg} min={0} max={60} suffix="°" onChange={(v) => onUpdate(p.id, { pitchDeg: v }, true)} />
                <Slider label="Azimuth" value={p.azimuthDeg} min={0} max={359} suffix="°" onChange={(v) => onUpdate(p.id, { azimuthDeg: v })} />
                <Slider label="Array angle" value={Math.round(p.arrayAngleDeg ?? 0)} min={0} max={179} suffix="°" onChange={(v) => onUpdate(p.id, { arrayAngleDeg: v }, true)} />
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); onFill(p.id) }} className="flex-1 h-8 rounded-control text-white text-[12px] font-semibold inline-flex items-center justify-center gap-1.5" style={{ background: '#15223B' }}><Grid size={13} />Fill panels</button>
                  {p.panels?.length ? <button onClick={(e) => { e.stopPropagation(); onClear(p.id) }} className="h-8 px-3 rounded-control border border-border text-[12px] font-semibold text-muted-b hover:bg-control">Clear</button> : null}
                </div>
              </div>
            )}
          </div>
        ))}
        {design.planes.length > 0 && <EnergyPanel design={design} annualKwh={annualKwh} onUpdate={onPatch} />}
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
        <button onClick={() => onGoal({ kind: 'max' })} className="w-full h-9 rounded-control text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2 mb-2" style={{ background: '#15223B' }}><Sparkle size={14} />Maximum coverage</button>
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
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.id === sel?.id ? '#62E4CC' : '#62E4CC' }} />
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
              <Dropdown value={sel.moduleId ?? moduleId} onChange={(e) => onUpdate(sel.id, { moduleId: e.target.value }, true)} className="w-full h-9 px-2 rounded-control border border-input-border bg-white text-[12.5px] outline-none focus:border-accent">
                {MODULES.map((m) => <option key={m.id} value={m.id}>{m.brand} {m.name} · {m.watts} W</option>)}
              </Dropdown>
              <div className="text-[11px] text-muted-2 mt-1">{mod.cell} · {mod.effPct}% · {mod.w}×{mod.h} m · £{mod.priceGbp}/panel · {mod.warrantyYr} yr</div>
            </Field>

            {/* Racking */}
            <Field label="Racking">
              <div className="grid grid-cols-3 gap-1.5">
                {rackingOpts.map((r) => {
                  const on = (sel.racking ?? 'flush') === r.id
                  return <button key={r.id} onClick={() => onUpdate(sel.id, { racking: r.id }, true)} className={`h-8 rounded-control text-[12px] font-semibold ${on ? 'text-white' : 'border border-border text-ink-3 hover:bg-control'}`} style={on ? { background: '#15223B' } : undefined}>{r.label}</button>
                })}
              </div>
            </Field>

            {/* Orientation */}
            <Field label="Orientation">
              <div className="grid grid-cols-3 gap-1.5">
                {([['auto', 'Auto'], ['portrait', 'Portrait'], ['landscape', 'Landscape']] as const).map(([id, label]) => {
                  const cur = sel.orientation ?? 'auto'
                  const on = cur === id
                  return <button key={id} onClick={() => onUpdate(sel.id, { orientation: id === 'auto' ? undefined : (id as PanelOrientation) }, true)} className={`h-8 rounded-control text-[12px] font-semibold ${on ? 'text-white' : 'border border-border text-ink-3 hover:bg-control'}`} style={on ? { background: '#15223B' } : undefined}>{label}</button>
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
              <button onClick={() => onFill(sel.id)} className="flex-1 h-9 rounded-control text-white text-[12.5px] font-semibold inline-flex items-center justify-center gap-1.5" style={{ background: '#15223B' }}><Grid size={13} />Fill this group</button>
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
                    <div className="flex-1 h-6 rounded-md bg-control overflow-hidden"><div className="h-full rounded-md flex items-center px-2 text-[10.5px] font-bold text-white" style={{ width: `${Math.max(pct, 6)}%`, background: '#62E4CC' }}>{pct}%</div></div>
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
function ProposalPane({ design, kwp, count, annualKwh, onOpen, onConfirm, onPush, hasProposal }: { design: Design; kwp: number; count: number; annualKwh: number; onOpen: () => void; onConfirm: () => void; onPush: () => void; hasProposal: boolean }) {
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
            <button onClick={onConfirm} className="h-10 px-4 rounded-control text-white text-[13px] font-semibold inline-flex items-center gap-2" style={{ background: '#15223B' }}><Check size={15} />Confirm design {design.status === 'confirmed' && '✓'}</button>
            <button onClick={onPush} className="h-10 px-4 rounded-control bg-[#15223B] text-white text-[13px] font-semibold inline-flex items-center gap-2 hover:bg-[#1E2F4E]"><File size={15} className="text-[#62E4CC]" />{hasProposal ? 'Update showroom proposal' : 'Create showroom proposal'}</button>
            <button onClick={onOpen} className="h-10 px-4 rounded-control border border-border text-[13px] font-semibold text-ink-3 hover:bg-control inline-flex items-center gap-2">Open proposals</button>
          </div>
        </div>
        <div className="text-[11.5px] text-muted-b"><b>Create showroom proposal</b> turns this design into the customer presentation, with their bill, savings, finance and sign-off, and links it back here. Pushing again updates it.</div>
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
    <button onClick={onClick} aria-label={label} className={`group relative h-9 w-9 rounded-[8px] flex items-center justify-center ${on ? 'text-[#62E4CC]' : 'text-ink-3 hover:bg-control'}`} style={on ? { background: '#15223B' } : undefined}>
      {icon}
      <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#0A1B2B] text-white text-[11.5px] font-semibold px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-modal z-[20]">{label}</span>
    </button>
  )
}
/* ── Pylon-style top toolbar for the selected array — inline tilt, azimuth, orientation, margins, undo/redo ── */
function ArrayToolbar({ sel, moduleId, onUpdate, onCentre, onFill, onEdit }: {
  sel: DesignPlane; moduleId: string; onUpdate: (id: string, patch: Partial<DesignPlane>, repack?: boolean) => void
  onCentre: () => void; onFill: () => void; onEdit?: () => void
}) {
  const mod = moduleById(sel.moduleId ?? moduleId)
  const n = sel.panels?.length ?? 0
  const flush = (sel.racking ?? 'flush') === 'flush'
  const tilt = flush ? sel.pitchDeg : (sel.tiltDeg ?? 10)
  const orient = sel.orientation ?? 'auto'
  return (
    <div className="flex items-center gap-1 h-11 px-1.5 rounded-control bg-white/95 backdrop-blur border border-border shadow-modal whitespace-nowrap">
      <span className="pl-1.5 pr-1 text-[12px] font-bold text-ink max-w-[140px] truncate" title={sel.name}>{sel.name}</span>
      {sel.pitchSource === 'assumed' && <span title="Split from the outline without height data — confirm the pitch on survey" className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>pitch est.</span>}
      <ToolSep />
      <NumField icon={<RotateIcon />} label="Tilt" value={tilt} suffix="°" min={0} max={60} onChange={(v) => (flush ? onUpdate(sel.id, { pitchDeg: v }, true) : onUpdate(sel.id, { tiltDeg: v }))} />
      <NumField icon={<Target size={12} />} label="Azimuth" value={sel.azimuthDeg} suffix="°" min={0} max={359} onChange={(v) => onUpdate(sel.id, { azimuthDeg: v })} />
      <ToolSep />
      <div className="flex items-center rounded-[7px] border border-border overflow-hidden">
        {([['portrait', '▯'], ['landscape', '▭']] as const).map(([o, g]) => (
          <button key={o} title={o} onClick={() => onUpdate(sel.id, { orientation: o as PanelOrientation }, true)} className={`h-7 px-2 text-[12px] font-semibold ${orient === o ? 'text-white' : 'text-ink-3 hover:bg-control'}`} style={orient === o ? { background: '#15223B' } : undefined}>{g}</button>
        ))}
      </div>
      <ToolSep />
      <NumField icon={<span className="text-[11px] font-bold">⇕</span>} label="Row gap" value={Math.round((sel.rowGapM ?? 0.02) * 1000)} suffix="mm" min={0} max={800} step={5} onChange={(v) => onUpdate(sel.id, { rowGapM: v / 1000 }, true)} />
      <NumField icon={<span className="text-[11px] font-bold">⇔</span>} label="Panel gap" value={Math.round((sel.panelGapM ?? 0.02) * 1000)} suffix="mm" min={0} max={800} step={5} onChange={(v) => onUpdate(sel.id, { panelGapM: v / 1000 }, true)} />
      <ToolSep />
      <button onClick={onFill} title="Fill this face with panels" className="h-7 px-2.5 rounded-[7px] text-white text-[12px] font-semibold inline-flex items-center gap-1" style={{ background: '#15223B' }}><Grid size={12} />Fill</button>
      <button onClick={onCentre} disabled={!n} title="Centre the array on this face" className={`h-7 px-2.5 rounded-[7px] text-[12px] font-semibold inline-flex items-center gap-1 border border-border ${n ? 'text-ink-3 hover:bg-control' : 'text-muted-2/40 cursor-default'}`}><CentreIcon />Centre</button>
      {onEdit && <button onClick={onEdit} title="Reshape this face (or double-click it)" className="h-7 px-2.5 rounded-[7px] text-[12px] font-semibold inline-flex items-center gap-1 border border-border text-ink-3 hover:bg-control"><Wrench size={12} />Reshape</button>}
      <ToolSep />
      <div className="px-1.5 text-[11.5px] text-muted-b whitespace-nowrap"><b className="text-ink tabular-nums">{n}</b> · <b className="text-ink tabular-nums">{kwpOf(n, mod.watts)}</b> kWp</div>
    </div>
  )
}
function CentreIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="8" height="8" rx="1" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg> }
function TB({ onClick, disabled, title, children }: { onClick: () => void; disabled?: boolean; title: string; children: React.ReactNode }) {
  return <button onClick={onClick} disabled={disabled} title={title} className={`h-7 w-7 rounded-[6px] flex items-center justify-center ${disabled ? 'text-muted-2/40 cursor-default' : 'text-ink-3 hover:bg-control'}`}>{children}</button>
}
function ToolSep() { return <span className="w-px h-5 bg-divider mx-0.5" /> }
function NumField({ icon, label, value, suffix, min, max, step = 1, onChange }: { icon: React.ReactNode; label: string; value: number; suffix: string; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1 px-0.5" title={label}>
      <span className="text-muted-2 flex items-center">{icon}</span>
      <input type="number" value={value} min={min} max={max} step={step} onClick={(e) => e.stopPropagation()}
        onChange={(e) => { const v = +e.target.value; if (!isNaN(v)) onChange(Math.max(min, Math.min(max, Math.round(v)))) }}
        className="w-11 h-7 px-1 text-[12px] tabular-nums text-ink-2 rounded-[6px] border border-input-border bg-white outline-none focus:border-accent text-center" />
      <span className="text-[10px] text-muted-2">{suffix}</span>
    </label>
  )
}
function UndoIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-1" /></svg> }
function RedoIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14l5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h1" /></svg> }
// Tiny inline glyphs for the tools the icon set doesn't cover (cursor / eraser / rotate).
function CursorIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3l7 17 2.5-6.5L20 11 4 3z" /></svg> }
function HandIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" /></svg> }
function MaximizeIcon({ on }: { on?: boolean }) { return on
  ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" /></svg>
  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" /></svg> }
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
