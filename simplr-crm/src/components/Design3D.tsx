import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { frameFromPoints } from '../lib/solar'
import { planeFrame } from '../lib/design'
import { fetchDsm, fetchRgbCanvas, sampleHeight, fluxColor, type DsmData } from '../lib/dsm'
import { planeGrid, moduleById, type GridCell } from '../lib/panels'
import type { Design, DesignPlane, DesignPanel } from '../store/types'

type LL = { lat: number; lng: number }

const EAVE_DEFAULT = 5 // metres to the eave — a two-storey wall under the pitched roof (fallback)

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`

// A realistic monocrystalline PV module texture (dark cells + busbars + silver frame), cached.
let _modTex: THREE.CanvasTexture | null = null
function moduleTexture(): THREE.CanvasTexture {
  if (_modTex) return _modTex
  const c = document.createElement('canvas'); c.width = 132; c.height = 210
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#0a0f22'; ctx.fillRect(0, 0, 132, 210)
  const cols = 6, rows = 10, pad = 9, gap = 3
  const cw = (132 - 2 * pad - (cols - 1) * gap) / cols, ch = (210 - 2 * pad - (rows - 1) * gap) / rows
  for (let r = 0; r < rows; r++) for (let cc = 0; cc < cols; cc++) {
    const x = pad + cc * (cw + gap), y = pad + r * (ch + gap)
    const g = ctx.createLinearGradient(x, y, x + cw, y + ch)
    g.addColorStop(0, '#1a2c5e'); g.addColorStop(0.5, '#0e1b3e'); g.addColorStop(1, '#20366e')
    ctx.fillStyle = g; ctx.fillRect(x, y, cw, ch)
    ctx.strokeStyle = 'rgba(180,205,245,0.14)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x + cw / 3, y); ctx.lineTo(x + cw / 3, y + ch); ctx.moveTo(x + (2 * cw) / 3, y); ctx.lineTo(x + (2 * cw) / 3, y + ch); ctx.stroke()
  }
  ctx.strokeStyle = '#aeb7c9'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 126, 204)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  _modTex = t; return t
}
function pointInRing(ring: LL[], pt: LL): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    if ((ring[i].lat > pt.lat) !== (ring[j].lat > pt.lat) && pt.lng < ((ring[j].lng - ring[i].lng) * (pt.lat - ring[i].lat)) / (ring[j].lat - ring[i].lat) + ring[i].lng) inside = !inside
  }
  return inside
}
const nearestCell = (cells: GridCell[], ll: LL): GridCell | null => {
  let best: GridCell | null = null, bd = Infinity
  for (const c of cells) { const d = (c.center.lat - ll.lat) ** 2 + (c.center.lng - ll.lng) ** 2; if (d < bd) { bd = d; best = c } }
  return best
}
const cellBlock = (cells: GridCell[], a: GridCell, b: GridCell): GridCell[] => {
  const r0 = Math.min(a.row, b.row), r1 = Math.max(a.row, b.row), c0 = Math.min(a.col, b.col), c1 = Math.max(a.col, b.col)
  return cells.filter((c) => c.row >= r0 && c.row <= r1 && c.col >= c0 && c.col <= c1)
}
const sameCell = (a: LL, b: LL) => Math.abs(a.lat - b.lat) * 110540 < 0.35 && Math.abs(a.lng - b.lng) * 90000 < 0.35
const panelCtr = (pn: { corners: LL[] }) => ({ lat: (pn.corners[0].lat + pn.corners[2].lat) / 2, lng: (pn.corners[0].lng + pn.corners[2].lng) / 2 })
const anyCornerInside = (p: LL[], q: LL[]) => p.some((c) => pointInRing(q, c))
const quadsOverlap = (a: LL[], b: LL[]) => anyCornerInside(a, b) || anyCornerInside(b, a)

type XZ = { x: number; z: number }
function pointInPolyXZ(pt: XZ, poly: XZ[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if ((poly[i].z > pt.z) !== (poly[j].z > pt.z) && pt.x < ((poly[j].x - poly[i].x) * (pt.z - poly[i].z)) / (poly[j].z - poly[i].z) + poly[i].x) inside = !inside
  }
  return inside
}
/** Inset a polygon inward by d (angle-bisector offset) — the panel-safe area inside the roof edge. */
function insetPolyXZ(poly: XZ[], d: number): XZ[] {
  const n = poly.length; if (n < 3) return poly
  let area = 0; for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; area += a.x * b.z - b.x * a.z }
  const s = area > 0 ? 1 : -1
  const nrm = (v: XZ) => { const l = Math.hypot(v.x, v.z) || 1; return { x: v.x / l, z: v.z / l } }
  const out: XZ[] = []
  for (let i = 0; i < n; i++) {
    const p0 = poly[(i - 1 + n) % n], p1 = poly[i], p2 = poly[(i + 1) % n]
    const n1 = nrm({ x: -(p1.z - p0.z) * s, z: (p1.x - p0.x) * s }), n2 = nrm({ x: -(p2.z - p1.z) * s, z: (p2.x - p1.x) * s })
    let bx = n1.x + n2.x, bz = n1.z + n2.z; const bl = Math.hypot(bx, bz) || 1; bx /= bl; bz /= bl
    const cosHalf = Math.max(0.34, bx * n1.x + bz * n1.z)
    out.push({ x: p1.x + (bx * d) / cosHalf, z: p1.z + (bz * d) / cosHalf })
  }
  return out
}
/** Solve a 3×3 system by Cramer's rule; null if singular. */
function solve3(M: number[][], B: number[]): number[] | null {
  const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  const d = det(M); if (Math.abs(d) < 1e-9) return null
  const col = (k: number) => M.map((row, i) => row.map((v, j) => (j === k ? B[i] : v)))
  return [det(col(0)) / d, det(col(1)) / d, det(col(2)) / d]
}
/** Least-squares fit of the real roof plane (y = a·x + b·z + c) from the DSM heights inside a
 *  footprint — the "intelligence" that reads each roof's true tilt/gradient so panels sit pinpoint. */
function fitRoofPlane(dsm: DsmData, fp: XZ[], dcx: number, dcz: number): { a: number; b: number; c: number } | null {
  const xs = fp.map((p) => p.x), zs = fp.map((p) => p.z)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const step = Math.max(0.4, Math.min(maxX - minX, maxZ - minZ) / 14)
  let n = 0, Sxx = 0, Sxz = 0, Sx = 0, Szz = 0, Sz = 0, Sxy = 0, Szy = 0, Sy = 0
  for (let x = minX; x <= maxX; x += step) for (let z = minZ; z <= maxZ; z += step) {
    if (!pointInPolyXZ({ x, z }, fp)) continue
    const h = sampleHeight(dsm, x - dcx, dcz - z)
    if (!isFinite(h)) continue
    n++; Sxx += x * x; Sxz += x * z; Sx += x; Szz += z * z; Sz += z; Sxy += x * h; Szy += z * h; Sy += h
  }
  if (n < 6) return null
  const sol = solve3([[Sxx, Sxz, Sx], [Sxz, Szz, Sz], [Sx, Sz, n]], [Sxy, Szy, Sy])
  if (!sol || !sol.every((v) => isFinite(v))) return null
  return { a: sol[0], b: sol[1], c: sol[2] }
}

/** A live, photoreal-ish 3D model of the design — each roof plane tilted to its true pitch/azimuth,
 *  walls dropped to the ground, obstacles cut out, and the packed panels sitting flush on the slope
 *  (not flat). Satellite-textured ground, gradient sky, a moveable sun casting soft shadows. Built
 *  entirely from the design geometry we already hold — no extra API. */
export function Design3D({ design, onCapture, adding, selecting, moduleId, onCommitPanels, onSelectPanels }: {
  design: Design; onCapture?: () => void
  adding?: boolean // "Add panels" tool active — enables click/drag placement on the 3D roof
  selecting?: boolean // "Select" tool active — click a panel to select it, drag to move it freely
  moduleId?: string // default module for a plane with none set
  onCommitPanels?: (planeId: string, panels: DesignPanel[]) => void
  onSelectPanels?: (planeId: string, panelIds: string[]) => void // sync the 3D selection back to the editor
}) {
  const host = useRef<HTMLDivElement>(null)
  const sunHour = useRef(13)
  const [hour, setHour] = useState(13)
  const [glError, setGlError] = useState(false)
  const [spin, setSpin] = useState(false)
  const spinRef = useRef(false)
  spinRef.current = spin
  const addingRef = useRef(adding); addingRef.current = adding
  const selectingRef = useRef(selecting); selectingRef.current = selecting
  const moduleIdRef = useRef(moduleId); moduleIdRef.current = moduleId
  const commitRef = useRef(onCommitPanels); commitRef.current = onCommitPanels
  const onSelectRef = useRef(onSelectPanels); onSelectRef.current = onSelectPanels
  const designRef = useRef(design); designRef.current = design
  const controlsRef = useRef<OrbitControls | null>(null)

  // While Add or Select is on, free the LEFT button for placement/drag and orbit with the RIGHT.
  useEffect(() => {
    const c = controlsRef.current; if (!c) return
    c.mouseButtons = (adding || selecting)
      ? { LEFT: undefined as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
      : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
  }, [adding, selecting])
  // Photoreal DSM roof (Google Solar Data Layers) — real roof shape + aerial texture + irradiance.
  const [dsm, setDsm] = useState<DsmData | null>(null)
  const [rgb, setRgb] = useState<HTMLCanvasElement | null>(null)
  const [dsmStatus, setDsmStatus] = useState<'idle' | 'loading' | 'ready' | 'none'>('idle')
  const [photoreal, setPhotoreal] = useState(true) // default = the real DSM house; off = clean reconstructed model
  const [showFlux, setShowFlux] = useState(false)
  const [showFaces, setShowFaces] = useState(true) // highlight the mapped usable roof faces

  // Fetch the DSM + aerial once per location (needs the Google key; silently no-ops without it).
  useEffect(() => {
    const c = design.center
    if (!c) { setDsmStatus('none'); return }
    let alive = true
    setDsmStatus('loading')
    ;(async () => {
      const d = await fetchDsm(c.lat, c.lng)
      if (!alive) return
      if (!d) { setDsmStatus('none'); return }
      setDsm(d)
      const canvas = await fetchRgbCanvas(c.lat, c.lng)
      if (!alive) return
      setRgb(canvas); setDsmStatus('ready')
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design.id, design.center?.lat, design.center?.lng])

  useEffect(() => {
    const el = host.current
    if (!el) return
    const planes = design.planes.filter((p) => p.polygon.length >= 3)
    const allPts: LL[] = planes.flatMap((p) => p.polygon)
    if (!allPts.length) return
    const eaveH = design.eaveHeightM ?? EAVE_DEFAULT // real building height (OSM/Google) or fallback

    const origin = allPts.reduce((a, p) => ({ lat: a.lat + p.lat / allPts.length, lng: a.lng + p.lng / allPts.length }), { lat: 0, lng: 0 })
    const mPerLat = 110540, mPerLng = 111320 * Math.cos((origin.lat * Math.PI) / 180)
    const X = (p: LL) => (p.lng - origin.lng) * mPerLng
    const Z = (p: LL) => -(p.lat - origin.lat) * mPerLat // north → −z

    // Photoreal mode: real roof shape from the DSM. The DSM is centred on design.center; a point's
    // height is sampled from it (relative to ground datum), so panels sit on the true roof surface.
    const usePhotoreal = photoreal && !!dsm
    const cLat = design.center?.lat ?? origin.lat, cLng = design.center?.lng ?? origin.lng
    const enOf = (p: LL) => ({ east: (p.lng - cLng) * mPerLng, north: (p.lat - cLat) * mPerLat })
    const dcx = design.center ? X(design.center) : 0, dcz = design.center ? Z(design.center) : 0
    const roofTopY = usePhotoreal ? (dsm!.maxH - dsm!.minH) * 0.55 : eaveH

    const W = el.clientWidth || 800, H = el.clientHeight || 500
    const scene = new THREE.Scene()
    let renderer: THREE.WebGLRenderer
    try {
      const probe = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl')
      if (!probe) throw new Error('no-webgl')
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    } catch { setGlError(true); return }
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    el.appendChild(renderer.domElement)

    const camera = new THREE.PerspectiveCamera(48, W / H, 0.5, 8000)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI / 2.02
    controls.autoRotateSpeed = 0.8; controls.minDistance = 4; controls.maxDistance = 600; controls.zoomSpeed = 1.15
    controlsRef.current = controls
    if (addingRef.current || selectingRef.current) controls.mouseButtons = { LEFT: undefined as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
    const pickTargets: THREE.Object3D[] = [] // roof meshes the placement raycaster hits
    const planeGeo = new Map<string, { heightAt: (x: number, z: number) => number; panelY: (corners: { x: number; z: number }[]) => number[] }>() // roof height + panel-corner heights per plane

    // ── Sky dome — vertical gradient, sits behind everything ──
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(4000, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        uniforms: { top: { value: new THREE.Color(0x2f6bd6) }, mid: { value: new THREE.Color(0x9cc2f0) }, bot: { value: new THREE.Color(0xdfe9f5) } },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot; void main(){ float h = normalize(vP).y; vec3 c = h>0.0 ? mix(mid,top,pow(h,0.7)) : mix(mid,bot,pow(-h,0.5)); gl_FragColor = vec4(c,1.0); }',
      }),
    )
    scene.add(sky)
    scene.fog = new THREE.Fog(0xcdddf0, 260, 2400)

    // ── Lights ──
    scene.add(new THREE.HemisphereLight(0xdcebff, 0x5a6472, 1.05))
    const sun = new THREE.DirectionalLight(0xfff3da, 2.2)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.bias = -0.0004
    scene.add(sun); scene.add(sun.target)

    // ── Ground — satellite tile textured onto a plane sized to its real-world extent ──
    const frame = frameFromPoints(allPts) || { center: origin, zoom: 19 }
    const mpp = (156543.03392 * Math.cos((origin.lat * Math.PI) / 180)) / 2 ** frame.zoom
    const groundM = mpp * 640
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(groundM, groundM),
      new THREE.MeshStandardMaterial({ color: 0x9aa2ac, roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.position.set(X(frame.center), usePhotoreal ? -0.6 : 0.02, Z(frame.center))
    scene.add(ground)
    new THREE.TextureLoader().load(`/api/roof-image?lat=${frame.center.lat}&lng=${frame.center.lng}&z=${frame.zoom}&size=640x640`, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      const gm = ground.material as THREE.MeshStandardMaterial
      gm.map = tex; gm.color.set(0xffffff); gm.needsUpdate = true
    })

    // ── Materials ──
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe7ebf1, roughness: 0.9, metalness: 0 })
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b929c, roughness: 0.82, metalness: 0.02, side: THREE.DoubleSide })
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x2a3444, transparent: true, opacity: 0.55 })
    const panelMat = new THREE.MeshStandardMaterial({ map: moduleTexture(), color: 0xffffff, roughness: 0.34, metalness: 0.5, envMapIntensity: 0.7 })
    const panelEdgeMat = new THREE.LineBasicMaterial({ color: 0x9fc0ff, transparent: true, opacity: 0.55 })

    // helper — average of scene points
    const avg = (pts: { x: number; z: number }[]) => pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, z: a.z + p.z / pts.length }), { x: 0, z: 0 })

    // ── Photoreal roof — the real DSM heightmesh, draped with the aerial (or the irradiance heatmap) ──
    if (usePhotoreal && design.center) {
      const W = dsm!.width, H = dsm!.height, res = dsm!.resM, heights = dsm!.heights, minH = dsm!.minH
      const geo = new THREE.PlaneGeometry(W * res, H * res, W - 1, H - 1)
      geo.rotateX(-Math.PI / 2) // XY → XZ, normal +Y; top row (north) → −z
      const pos = geo.attributes.position as THREE.BufferAttribute
      const heatmap = showFlux && !!dsm!.flux
      const colors = heatmap ? new Float32Array(pos.count * 3) : null
      const fMin = dsm!.fluxMin ?? 0, fSpan = (dsm!.fluxMax ?? 1) - fMin || 1
      // Building mask (1-px dilated) — flatten everything that isn't the building so trees/ground/
      // neighbours don't spike; the target house stands crisp on a flat aerial carpet.
      const mask = dsm!.mask
      let building: Uint8Array | null = null
      if (mask) {
        building = new Uint8Array(W * H)
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
          let b = false
          for (let dr = -1; dr <= 1 && !b; dr++) for (let dc = -1; dc <= 1 && !b; dc++) { const rr = j + dr, cc = i + dc; if (rr >= 0 && rr < H && cc >= 0 && cc < W && mask[rr * W + cc] > 0.5) b = true }
          building[j * W + i] = b ? 1 : 0
        }
      }
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const idx = j * W + i, raw = heights[idx]
        const onBuilding = !building || building[idx] === 1
        pos.setY(idx, onBuilding && raw > -500 && raw < 10000 ? raw - minH : 0)
        if (colors) { const [r, g, b] = fluxColor((dsm!.flux![idx] - fMin) / fSpan); colors[idx * 3] = r; colors[idx * 3 + 1] = g; colors[idx * 3 + 2] = b }
      }
      geo.computeVertexNormals()
      // Per-vertex "wallness" (1 = vertical face) — the mesh has no rotation, so geometry normals are
      // world normals. Steep faces (building walls) get a clean wall colour instead of stretched aerial.
      const nrm = geo.attributes.normal as THREE.BufferAttribute
      const wallAttr = new Float32Array(pos.count)
      for (let i = 0; i < pos.count; i++) wallAttr[i] = 1 - Math.max(0, Math.min(1, nrm.getY(i)))
      geo.setAttribute('aWall', new THREE.BufferAttribute(wallAttr, 1))
      const wallShade = (mat: THREE.MeshStandardMaterial) => {
        mat.onBeforeCompile = (sh) => {
          sh.vertexShader = 'attribute float aWall;\nvarying float vWall;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWall = aWall;')
          sh.fragmentShader = 'varying float vWall;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80,0.79,0.77), smoothstep(0.42,0.72,vWall));')
        }
        return mat
      }
      let mat: THREE.MeshStandardMaterial
      if (colors) { geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }) }
      else if (rgb) { const tex = new THREE.CanvasTexture(rgb); tex.colorSpace = THREE.SRGBColorSpace; mat = wallShade(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 })) }
      else mat = new THREE.MeshStandardMaterial({ color: 0x9aa2ac, roughness: 0.98 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(X(design.center), 0, Z(design.center))
      mesh.receiveShadow = true; mesh.castShadow = true
      scene.add(mesh)
      pickTargets.push(mesh)
    }

    // ── Roof planes ──
    // Aerial texture (projected onto the sharp reconstructed roof facets) + its metric frame.
    const dsmW = dsm ? dsm.width * dsm.resM : 1, dsmH = dsm ? dsm.height * dsm.resM : 1
    const halfWm = dsmW / 2, halfHm = dsmH / 2
    const aerialTex = (dsm && rgb) ? (() => { const t = new THREE.CanvasTexture(rgb); t.colorSpace = THREE.SRGBColorSpace; return t })() : null
    const uvFor = (sx: number, sz: number): [number, number] => [(sx - dcx + halfWm) / dsmW, (dcz - sz + halfHm) / dsmH]
    const panelEdgeSegments: number[] = []
    let panelTotal = 0
    const panelMats: THREE.Matrix4[] = []
    const roofCenters: { x: number; y: number; z: number }[] = []

    planes.forEach((p) => {
      const fp = p.polygon.map((pt) => ({ x: X(pt), z: Z(pt) }))
      const pf = planeFrame(fp, p.pitchDeg, p.azimuthDeg, eaveH)
      const c = avg(fp)
      // The roof surface height for this facet. When we have the DSM, FIT the real plane (true
      // tilt/gradient) so the reconstructed facet + panels are pinpoint; else use the Google tilt.
      let roofY: (x: number, z: number) => number
      let fit: { a: number; b: number; c: number } | null = null
      if (dsm && design.center) {
        // The DSM fit is the source of truth for tilt — a hand-drawn outline (default 5° pitch) gets the
        // SAME real pitch as auto-detect. Only fall back to the stored pitch if the fit can't be made.
        fit = fitRoofPlane(dsm, fp, dcx, dcz)
        if (fit) roofY = (x, z) => fit!.a * x + fit!.b * z + fit!.c
        else { const off = sampleHeight(dsm, c.x - dcx, dcz - c.z) - pf.elev(c.x, c.z); roofY = (x, z) => pf.elev(x, z) + off }
      } else roofY = (x, z) => pf.elev(x, z)
      // The whole array is ONE rigid plane (the facet's fitted tilt), lifted just enough to rest on the
      // highest point of the real roof beneath it — so it's clean/coplanar AND never buried or jagged.
      let arrayLift = 0.15
      if (usePhotoreal && dsm && fit) {
        const xs = fp.map((v) => v.x), zs = fp.map((v) => v.z)
        const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
        const step = Math.max(0.4, Math.min(maxX - minX, maxZ - minZ) / 12)
        let maxAbove = 0
        for (let x = minX; x <= maxX; x += step) for (let z = minZ; z <= maxZ; z += step) {
          if (!pointInPolyXZ({ x, z }, fp)) continue
          const d = sampleHeight(dsm, x - dcx, dcz - z) - (fit.a * x + fit.b * z + fit.c)
          if (d > maxAbove) maxAbove = d
        }
        arrayLift = Math.min(maxAbove, 0.8) + 0.14 // clamp so an imperfect facet never floats panels absurdly high
      }
      const heightAt = (x: number, z: number) => roofY(x, z) + arrayLift
      const panelY = (corners: { x: number; z: number }[]): number[] => corners.map((k) => roofY(k.x, k.z) + arrayLift)
      planeGeo.set(p.id, { heightAt, panelY })
      roofCenters.push({ x: c.x, y: roofY(c.x, c.z), z: c.z })

      // Sharp reconstructed model (default view; skipped when showing the raw DSM blob): a FLAT roof
      // facet at its fitted plane with the aerial projected on, plus clean walls to the ground.
      if (!usePhotoreal) {
        const shape = new THREE.Shape(fp.map((v) => new THREE.Vector2(v.x, v.z)))
        const rg = new THREE.ShapeGeometry(shape)
        const pos = rg.attributes.position as THREE.BufferAttribute, uv = rg.attributes.uv as THREE.BufferAttribute
        for (let i = 0; i < pos.count; i++) {
          const sx = pos.getX(i), sz = pos.getY(i)
          pos.setXYZ(i, sx, roofY(sx, sz), sz)
          if (aerialTex && uv) { const [u, v] = uvFor(sx, sz); uv.setXY(i, u, v) }
        }
        rg.computeVertexNormals()
        const roof = new THREE.Mesh(rg, aerialTex ? new THREE.MeshStandardMaterial({ map: aerialTex, roughness: 0.92, metalness: 0 }) : roofMat)
        roof.castShadow = true; roof.receiveShadow = true
        scene.add(roof)
        pickTargets.push(roof)
        // Walls — drop each facet edge straight to the ground.
        const wv: number[] = []
        for (let i = 0; i < fp.length; i++) {
          const a = fp[i], b = fp[(i + 1) % fp.length]
          const ay = roofY(a.x, a.z), by = roofY(b.x, b.z)
          wv.push(a.x, 0, a.z, b.x, 0, b.z, b.x, by, b.z)
          wv.push(a.x, 0, a.z, b.x, by, b.z, a.x, ay, a.z)
        }
        const wg = new THREE.BufferGeometry()
        wg.setAttribute('position', new THREE.Float32BufferAttribute(wv, 3))
        wg.computeVertexNormals()
        const walls = new THREE.Mesh(wg, wallMat)
        walls.castShadow = true; walls.receiveShadow = true
        scene.add(walls)
        const ring = fp.map((v) => new THREE.Vector3(v.x, roofY(v.x, v.z), v.z)); ring.push(ring[0])
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), edgeMat))
      }

      // Usable-area overlay — the mapped roof face, drawn on the fitted plane so you can see & design
      // within the real usable space.
      if (showFaces && fp.length >= 3) {
        const fshape = new THREE.Shape(fp.map((v) => new THREE.Vector2(v.x, v.z)))
        const fgeo = new THREE.ShapeGeometry(fshape)
        const fp2 = fgeo.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < fp2.count; i++) { const sx = fp2.getX(i), sz = fp2.getY(i); fp2.setXYZ(i, sx, heightAt(sx, sz) + 0.06, sz) }
        const fill = new THREE.Mesh(fgeo, new THREE.MeshBasicMaterial({ color: 0x27e0ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }))
        fill.renderOrder = 2; scene.add(fill)
        const ring = fp.map((v) => new THREE.Vector3(v.x, heightAt(v.x, v.z) + 0.09, v.z)); ring.push(ring[0])
        const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.9, depthTest: false }))
        outline.renderOrder = 3; scene.add(outline)
      }

      // Panels — flat (facet tilt) but resting on the real DSM surface beneath each panel.
      p.panels?.forEach((pn) => {
        const sc = pn.corners.map((v) => ({ x: X(v), z: Z(v) }))
        const ys = panelY(sc)
        const g3 = sc.map((k, i) => new THREE.Vector3(k.x, ys[i], k.z))
        if (g3.length < 4) return
        const center = new THREE.Vector3().addVectors(g3[0], g3[2]).add(g3[1]).add(g3[3]).multiplyScalar(0.25)
        const ex = new THREE.Vector3().subVectors(g3[1], g3[0]) // width edge
        const ez = new THREE.Vector3().subVectors(g3[3], g3[0]) // depth edge
        const w = ex.length() || 1, d = ez.length() || 1
        let ny = new THREE.Vector3().crossVectors(ex, ez).normalize()
        if (ny.y < 0) ny.negate()
        const nx = ex.clone().normalize()
        const nz = new THREE.Vector3().crossVectors(nx, ny).normalize()
        const m = new THREE.Matrix4().makeBasis(nx, ny, nz)
        m.setPosition(center.addScaledVector(ny, 0.10))
        m.scale(new THREE.Vector3(w, 0.05, d))
        panelMats.push(m)
        // outline segments (top rectangle)
        const top = g3.map((v) => v.clone().addScaledVector(ny, 0.13))
        for (let i = 0; i < 4; i++) { const a = top[i], b = top[(i + 1) % 4]; panelEdgeSegments.push(a.x, a.y, a.z, b.x, b.y, b.z) }
        panelTotal++
      })
    })

    // Panels as one instanced mesh
    if (panelTotal) {
      const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), panelMat, panelTotal)
      inst.castShadow = true; inst.receiveShadow = true
      panelMats.forEach((m, i) => inst.setMatrixAt(i, m))
      inst.instanceMatrix.needsUpdate = true
      scene.add(inst)
      const eg = new THREE.BufferGeometry()
      eg.setAttribute('position', new THREE.Float32BufferAttribute(panelEdgeSegments, 3))
      scene.add(new THREE.LineSegments(eg, panelEdgeMat))
    }

    // ── Obstacles (chimney / hvac / skylight / keep-out) ──
    const obsColors: Record<string, number> = { chimney: 0x7c5a44, hvac: 0x51606f, skylight: 0x7fd4ff, keepout: 0xff5d5d }
    design.obstacles?.forEach((o) => {
      if (o.polygon.length < 3) return
      const fp = o.polygon.map((pt) => ({ x: X(pt), z: Z(pt) }))
      // sit it on the nearest roof surface (use the first plane's frame as the reference height)
      const ref = planes[0] ? planeFrame(planes[0].polygon.map((pt) => ({ x: X(pt), z: Z(pt) })), planes[0].pitchDeg, planes[0].azimuthDeg, eaveH) : null
      const shape = new THREE.Shape(fp.map((v) => new THREE.Vector2(v.x, v.z)))
      const h = o.kind === 'chimney' ? 1.6 : o.kind === 'hvac' ? 1.1 : 0.15
      const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false })
      geo.rotateX(-Math.PI / 2)
      const base = ref ? ref.elev(avg(fp).x, avg(fp).z) : eaveH
      geo.translate(0, base, 0)
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: obsColors[o.kind] ?? 0xff5d5d, roughness: 0.7, transparent: o.kind === 'keepout', opacity: o.kind === 'keepout' ? 0.4 : 1 }))
      mesh.castShadow = true; mesh.receiveShadow = true
      scene.add(mesh)
    })

    // ── Camera framing — 3/4 aerial fit whatever the roof size/spread ──
    const bx = allPts.map(X), bz = allPts.map(Z)
    const cx = (Math.min(...bx) + Math.max(...bx)) / 2, cz = (Math.min(...bz) + Math.max(...bz)) / 2
    const span = Math.max(Math.max(...bx) - Math.min(...bx), Math.max(...bz) - Math.min(...bz), 22)
    const dist = span * 1.35 + 26
    controls.target.set(cx, roofTopY, cz)
    camera.position.set(cx + dist * 0.62, roofTopY + dist * 0.9, cz + dist * 0.62)
    camera.lookAt(cx, roofTopY, cz)

    // shadow frustum around the scene
    const S = span * 0.9 + 40
    Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 1600 })
    sun.shadow.camera.updateProjectionMatrix()

    function placeSun(h: number) {
      // Northern-hemisphere arc: rises east (+x) at 06:00, south (+z) at midday, sets west (−x) at 18:00.
      const t = Math.min(1, Math.max(0, (h - 6) / 12))
      const az = Math.PI * (0.5 - t)
      const elev = Math.max(0.04, Math.sin(Math.PI * t))
      const horiz = 340 * (1 - elev * 0.5)
      sun.position.set(cx + Math.sin(az) * horiz, 60 + elev * 380, cz + Math.cos(az) * horiz * 0.8 + 30)
      sun.target.position.set(cx, roofTopY, cz)
      sun.intensity = 0.9 + elev * 1.6
      const warm = 1 - elev
      sun.color.setRGB(1, 0.95 - warm * 0.18, 0.86 - warm * 0.28)
    }
    placeSun(sunHour.current)

    let raf = 0
    const loop = () => { controls.autoRotate = spinRef.current; controls.update(); placeSun(sunHour.current); renderer.render(scene, camera); raf = requestAnimationFrame(loop) }
    loop()

    const onResize = () => { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h) }
    const ro = new ResizeObserver(onResize); ro.observe(el)

    // ── Interactive panel placement on the 3D roof (Add-panels tool) ──
    const ghostGroup = new THREE.Group(); scene.add(ghostGroup)
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const ghostAdd = new THREE.MeshBasicMaterial({ color: 0x9b6cf5, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthTest: false })
    const ghostRemove = new THREE.MeshBasicMaterial({ color: 0xff5d5d, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthTest: false })
    const canvas = renderer.domElement
    const pickLL = (ev: PointerEvent): LL | null => {
      const rect = canvas.getBoundingClientRect()
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      const pt = raycaster.intersectObjects(pickTargets, false)[0]?.point
      return pt ? { lat: origin.lat - pt.z / mPerLat, lng: origin.lng + pt.x / mPerLng } : null
    }
    const planeAtLL = (ll: LL) => designRef.current.planes.find((p) => p.polygon.length >= 3 && pointInRing(p.polygon, ll))
    const gridFor = (p: DesignPlane) => planeGrid(p.polygon, moduleById(p.moduleId ?? moduleIdRef.current), { orientation: p.orientation ?? 'portrait', setback: 0, rowGap: p.rowGapM })
    const cellQuad = (pid: string, cell: GridCell) => { const g = planeGeo.get(pid); const sc = cell.corners.map((v) => ({ x: X(v), z: Z(v) })); const ys = g ? g.panelY(sc) : sc.map(() => 0); return cell.corners.map((v, i) => new THREE.Vector3(X(v), ys[i] + 0.08, Z(v))) }
    const drawGhost = (pid: string, cells: GridCell[], removing: boolean) => {
      ghostGroup.clear()
      cells.forEach((cell) => {
        const q = cellQuad(pid, cell)
        const geo = new THREE.BufferGeometry().setFromPoints([q[0], q[1], q[2], q[0], q[2], q[3]])
        const m = new THREE.Mesh(geo, removing ? ghostRemove : ghostAdd); m.renderOrder = 999; ghostGroup.add(m)
      })
    }
    let dragPid: string | null = null, startCell: GridCell | null = null, lastCell: GridCell | null = null, dragCells: GridCell[] = [], moved = false
    let movingArray = false, occupied: { row: number; col: number }[] = [] // drag FROM a panel = move the whole array
    // ── Select tool: click a panel to select it, drag to move it freely on the roof (2D-parity) ──
    let selPid: string | null = null, selPanelId: string | null = null, selCorners0: LL[] | null = null, selStartLL: LL | null = null
    const findPanelAtLL = (ll: LL) => { const planes = designRef.current.planes; for (let i = planes.length - 1; i >= 0; i--) { const pans = planes[i].panels ?? []; for (let j = pans.length - 1; j >= 0; j--) if (pointInRing(pans[j].corners, ll)) return { pid: planes[i].id, panel: pans[j] } } return null }
    const drawFreeGhost = (pid: string, cornersLL: LL[]) => { ghostGroup.clear(); const g = planeGeo.get(pid); const sc = cornersLL.map((v) => ({ x: X(v), z: Z(v) })); const ys = g ? g.panelY(sc) : sc.map(() => 0); const q = cornersLL.map((v, i) => new THREE.Vector3(X(v), ys[i] + 0.08, Z(v))); const geo = new THREE.BufferGeometry().setFromPoints([q[0], q[1], q[2], q[0], q[2], q[3]]); const mm = new THREE.Mesh(geo, ghostAdd); mm.renderOrder = 999; ghostGroup.add(mm) }
    const hasPanelAt = (p: DesignPlane, c: GridCell) => (p.panels ?? []).some((pn) => sameCell(panelCtr(pn), c.center))
    const cellOfPanel = (pn: { corners: LL[] }) => nearestCell(dragCells, panelCtr(pn))
    const onMove = (ev: PointerEvent) => {
      if (selectingRef.current) {
        if (selPid && selCorners0 && selStartLL) { const ll = pickLL(ev); if (!ll) return; const dLat = ll.lat - selStartLL.lat, dLng = ll.lng - selStartLL.lng; drawFreeGhost(selPid, selCorners0.map((c) => ({ lat: c.lat + dLat, lng: c.lng + dLng }))) }
        return
      }
      if (!addingRef.current) return
      if (dragPid && startCell) {
        const ll = pickLL(ev); if (!ll) return
        const cur = nearestCell(dragCells, ll); if (!cur) return
        lastCell = cur
        if (cur.row !== startCell.row || cur.col !== startCell.col) moved = true
        if (movingArray) { // preview the whole array shifted by the grid delta
          const dr = cur.row - startCell.row, dc = cur.col - startCell.col
          const shifted = occupied.map((o) => dragCells.find((c) => c.row === o.row + dr && c.col === o.col + dc)).filter(Boolean) as GridCell[]
          drawGhost(dragPid, shifted, false)
        } else {
          const p = designRef.current.planes.find((x) => x.id === dragPid)
          drawGhost(dragPid, cellBlock(dragCells, startCell, cur), !moved && !!p && hasPanelAt(p, startCell))
        }
      } else {
        const ll = pickLL(ev); const p = ll ? planeAtLL(ll) : undefined
        if (p && ll) { const c = nearestCell(gridFor(p), ll); drawGhost(p.id, c ? [c] : [], !!c && hasPanelAt(p, c)) }
        else ghostGroup.clear()
      }
    }
    const onDown = (ev: PointerEvent) => {
      if (selectingRef.current) {
        if (ev.button !== 0) return
        const ll = pickLL(ev); const hit = ll ? findPanelAtLL(ll) : null
        if (hit && ll) { selPid = hit.pid; selPanelId = hit.panel.id; selCorners0 = hit.panel.corners; selStartLL = ll; if (controlsRef.current) controlsRef.current.enabled = false; onSelectRef.current?.(hit.pid, [hit.panel.id]) }
        else onSelectRef.current?.('', [])
        return
      }
      if (!addingRef.current || ev.button !== 0) return
      const ll = pickLL(ev); const p = ll ? planeAtLL(ll) : undefined
      if (!p || !ll) return
      dragPid = p.id; dragCells = gridFor(p); startCell = nearestCell(dragCells, ll); lastCell = startCell; moved = false
      // If the press starts on an existing module, this drag MOVES the whole array.
      movingArray = !!startCell && hasPanelAt(p, startCell)
      occupied = movingArray ? (p.panels ?? []).map(cellOfPanel).filter(Boolean).map((c) => ({ row: c!.row, col: c!.col })) : []
    }
    const onUp = (ev: PointerEvent) => {
      if (controlsRef.current) controlsRef.current.enabled = true
      if (selectingRef.current) {
        if (selPid && selPanelId && selCorners0 && selStartLL) {
          const ll = pickLL(ev)
          if (ll) {
            const dLat = ll.lat - selStartLL.lat, dLng = ll.lng - selStartLL.lng
            const d = designRef.current, plane = d.planes.find((x) => x.id === selPid)
            if (plane) {
              const moved = selCorners0.map((c) => ({ lat: c.lat + dLat, lng: c.lng + dLng }))
              const others = d.planes.flatMap((p) => p.panels ?? []).filter((pn) => pn.id !== selPanelId)
              if (!others.some((pn) => quadsOverlap(moved, pn.corners))) commitRef.current?.(selPid, (plane.panels ?? []).map((pn) => (pn.id === selPanelId ? { ...pn, corners: moved } : pn)))
            }
          }
        }
        ghostGroup.clear(); selPid = null; selPanelId = null; selCorners0 = null; selStartLL = null
        return
      }
      if (!addingRef.current || !dragPid || !startCell) { dragPid = null; startCell = null; movingArray = false; return }
      const p = designRef.current.planes.find((x) => x.id === dragPid)
      if (p) {
        if (movingArray && moved) {
          // shift every module in this array by the grid delta; drop any pushed off the facet
          const dr = (lastCell ?? startCell).row - startCell.row, dc = (lastCell ?? startCell).col - startCell.col
          const newPanels = (p.panels ?? []).map((pn) => { const c = cellOfPanel(pn); const nc = c && dragCells.find((x) => x.row === c.row + dr && x.col === c.col + dc); return nc ? { ...pn, corners: nc.corners } : null }).filter(Boolean) as DesignPanel[]
          if (newPanels.length) commitRef.current?.(dragPid, newPanels)
        } else {
          let panels = [...(p.panels ?? [])]
          if (!moved) {
            const idx = panels.findIndex((pn) => sameCell(panelCtr(pn), startCell!.center))
            if (idx >= 0) panels.splice(idx, 1); else panels.push({ id: uid('pn'), corners: startCell.corners })
          } else {
            for (const c of cellBlock(dragCells, startCell, lastCell ?? startCell)) if (!panels.some((pn) => sameCell(panelCtr(pn), c.center))) panels.push({ id: uid('pn'), corners: c.corners })
          }
          commitRef.current?.(dragPid, panels)
        }
      }
      ghostGroup.clear(); dragPid = null; startCell = null; dragCells = []; moved = false; movingArray = false
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose()
      canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onDown); window.removeEventListener('pointerup', onUp)
      scene.traverse((o) => { const m = (o as THREE.Mesh); if (m.geometry) m.geometry.dispose?.() })
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design.id, design.planes, design.obstacles, design.eaveHeightM, photoreal, dsm, rgb, showFlux, showFaces])

  const hasGeom = design.planes.some((p) => p.polygon.length >= 3)
  const hasPanels = design.planes.some((p) => p.panels?.length)
  return (
    <div className="absolute inset-0 z-[450]">
      <div ref={host} className="absolute inset-0" />
      {glError && (
        <div className="absolute inset-0 flex items-center justify-center text-center bg-[#0b1220]">
          <div className="bg-surface/95 border border-border rounded-card px-6 py-5 shadow-modal max-w-[360px]">
            <div className="text-[15px] font-bold text-ink">3D couldn’t start (WebGL)</div>
            <div className="text-[12.5px] text-muted-b mt-1">Your browser blocked 3D graphics. In Chrome: Settings → System → turn on <b>“Use graphics acceleration when available”</b>, then reload. (chrome://gpu shows the status.)</div>
          </div>
        </div>
      )}
      {adding && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 text-white rounded-full shadow-modal px-4 py-2 text-[12px] font-semibold inline-flex items-center gap-2 text-center" style={{ background: 'linear-gradient(135deg,#1FAE94,#159C86)' }}>Click to place · drag empty roof for a block · drag a panel to move the array · click one to remove · right-drag to orbit</div>
      )}
      {hasGeom && !hasPanels && !adding && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-white/95 backdrop-blur border border-border rounded-full shadow-modal px-4 py-2 text-[12.5px] font-semibold text-ink-2">Hit <b>Ovi auto-layout</b>, or use <b>Add panels</b> to place them on the roof</div>
      )}
      {!hasGeom && (
        <div className="absolute inset-0 flex items-center justify-center text-center">
          <div className="bg-surface/95 border border-border rounded-card px-6 py-5 shadow-modal max-w-[340px] pointer-events-auto">
            <div className="text-[15px] font-bold text-ink">No roof captured yet</div>
            <div className="text-[12.5px] text-muted-b mt-1">3D builds from the roof — capture one first. On big buildings Google often misses, so drawing it by hand is the sure way.</div>
            {onCapture && <button onClick={onCapture} className="mt-3 h-9 px-4 rounded-control text-white text-[13px] font-semibold inline-flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#1FAE94,#159C86)' }}>Capture the roof →</button>}
          </div>
        </div>
      )}
      {hasGeom && (
        <>
          <div className="absolute top-[152px] left-3 z-10 flex flex-col items-start gap-2">
            <button onClick={() => setSpin((s) => !s)} className={`h-9 px-3.5 rounded-full backdrop-blur border shadow-modal text-[12.5px] font-semibold inline-flex items-center gap-2 ${spin ? 'text-white border-transparent' : 'bg-white/95 text-ink-2 border-border'}`} style={spin ? { background: 'linear-gradient(135deg,#1FAE94,#159C86)' } : undefined}>
              <span className={spin ? 'animate-spin' : ''}>⟳</span>{spin ? 'Orbiting' : 'Orbit'}
            </button>
            {dsmStatus === 'loading' && (
              <span className="h-9 px-3.5 rounded-full bg-white/95 backdrop-blur border border-border shadow-modal text-[12px] font-semibold text-ink-3 inline-flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" />Loading real roof…</span>
            )}
            {dsmStatus === 'none' && (
              <span className="h-9 px-3.5 rounded-full bg-white/95 backdrop-blur border border-border shadow-modal text-[12px] font-semibold text-amber-700 inline-flex items-center gap-1.5" title="The photoreal 3D needs Google's DSM elevation at the design's exact centre. Drop a pin on the roof in 2D to set it; rural areas have no Google 3D data.">⚠ {design.center ? 'No Google 3D data here — showing the modelled roof' : 'Set the roof location (drop a pin in 2D) for the real 3D'}</span>
            )}
            {dsmStatus === 'ready' && (
              <>
                <button onClick={() => setPhotoreal((v) => !v)} title="Toggle the real 3D roof (Google DSM) vs the clean model" className={`h-9 px-3.5 rounded-full backdrop-blur border shadow-modal text-[12.5px] font-semibold inline-flex items-center gap-1.5 ${photoreal ? 'text-white border-transparent' : 'bg-white/95 text-ink-2 border-border'}`} style={photoreal ? { background: 'linear-gradient(135deg,#1FAE94,#159C86)' } : undefined}>◈ Photoreal</button>
                <button onClick={() => setShowFaces((v) => !v)} title="Highlight the usable roof faces we mapped" className={`h-9 px-3.5 rounded-full backdrop-blur border shadow-modal text-[12.5px] font-semibold inline-flex items-center gap-1.5 ${showFaces ? 'text-white border-transparent' : 'bg-white/95 text-ink-2 border-border'}`} style={showFaces ? { background: 'linear-gradient(135deg,#00E5FF,#1FAE94)' } : undefined}>▧ Usable area</button>
                {photoreal && dsm?.flux && (
                  <button onClick={() => setShowFlux((v) => !v)} title="Annual sun / shading heatmap" className={`h-9 px-3.5 rounded-full backdrop-blur border shadow-modal text-[12.5px] font-semibold inline-flex items-center gap-1.5 ${showFlux ? 'text-white border-transparent' : 'bg-white/95 text-ink-2 border-border'}`} style={showFlux ? { background: 'linear-gradient(90deg,#2f6bd6,#e6dc3c,#dc3228)' } : undefined}>☀ Heatmap</button>
                )}
              </>
            )}
          </div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-white/95 backdrop-blur border border-border rounded-full shadow-modal px-4 py-2 flex items-center gap-3">
            <span className="text-[11.5px] font-semibold text-ink-2 tabular-nums w-16">☀ {hour}:00</span>
            <input type="range" min={6} max={20} value={hour} onChange={(e) => { const h = +e.target.value; setHour(h); sunHour.current = h }} className="w-48 accent-accent" />
          </div>
        </>
      )}
    </div>
  )
}
