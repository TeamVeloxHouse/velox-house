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

/** A live, photoreal-ish 3D model of the design — each roof plane tilted to its true pitch/azimuth,
 *  walls dropped to the ground, obstacles cut out, and the packed panels sitting flush on the slope
 *  (not flat). Satellite-textured ground, gradient sky, a moveable sun casting soft shadows. Built
 *  entirely from the design geometry we already hold — no extra API. */
export function Design3D({ design, onCapture, adding, moduleId, onCommitPanels }: {
  design: Design; onCapture?: () => void
  adding?: boolean // "Add panels" tool active — enables click/drag placement on the 3D roof
  moduleId?: string // default module for a plane with none set
  onCommitPanels?: (planeId: string, panels: DesignPanel[]) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const sunHour = useRef(13)
  const [hour, setHour] = useState(13)
  const [glError, setGlError] = useState(false)
  const [spin, setSpin] = useState(false)
  const spinRef = useRef(false)
  spinRef.current = spin
  const addingRef = useRef(adding); addingRef.current = adding
  const moduleIdRef = useRef(moduleId); moduleIdRef.current = moduleId
  const commitRef = useRef(onCommitPanels); commitRef.current = onCommitPanels
  const designRef = useRef(design); designRef.current = design
  const controlsRef = useRef<OrbitControls | null>(null)

  // While the Add-panels tool is on, free the LEFT button for placement and orbit with the RIGHT.
  useEffect(() => {
    const c = controlsRef.current; if (!c) return
    c.mouseButtons = adding
      ? { LEFT: undefined as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
      : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
  }, [adding])
  // Photoreal DSM roof (Google Solar Data Layers) — real roof shape + aerial texture + irradiance.
  const [dsm, setDsm] = useState<DsmData | null>(null)
  const [rgb, setRgb] = useState<HTMLCanvasElement | null>(null)
  const [dsmStatus, setDsmStatus] = useState<'idle' | 'loading' | 'ready' | 'none'>('idle')
  const [photoreal, setPhotoreal] = useState(true)
  const [showFlux, setShowFlux] = useState(false)

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
    controls.autoRotateSpeed = 0.8
    controlsRef.current = controls
    if (addingRef.current) controls.mouseButtons = { LEFT: undefined as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
    const pickTargets: THREE.Object3D[] = [] // roof meshes the placement raycaster hits
    const planeGeo = new Map<string, { pf: { elev: (x: number, z: number) => number }; baseOffset: number }>()

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
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x14264f, roughness: 0.32, metalness: 0.55, envMapIntensity: 0.6 })
    const panelEdgeMat = new THREE.LineBasicMaterial({ color: 0x8fb4ff, transparent: true, opacity: 0.7 })

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
      let mat: THREE.MeshStandardMaterial
      if (colors) { geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }) }
      else if (rgb) { const tex = new THREE.CanvasTexture(rgb); tex.colorSpace = THREE.SRGBColorSpace; mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 }) }
      else mat = new THREE.MeshStandardMaterial({ color: 0x9aa2ac, roughness: 0.98 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(X(design.center), 0, Z(design.center))
      mesh.receiveShadow = true; mesh.castShadow = true
      scene.add(mesh)
      pickTargets.push(mesh)
    }

    // ── Roof planes ──
    const panelEdgeSegments: number[] = []
    let panelTotal = 0
    const panelMats: THREE.Matrix4[] = []
    const roofCenters: { x: number; y: number; z: number }[] = []

    planes.forEach((p) => {
      const fp = p.polygon.map((pt) => ({ x: X(pt), z: Z(pt) }))
      const pf = planeFrame(fp, p.pitchDeg, p.azimuthDeg, eaveH)

      // Clean extrusion path — the roof surface + walls (skipped in photoreal, where the DSM is it).
      if (!usePhotoreal) {
        const shape = new THREE.Shape(fp.map((v) => new THREE.Vector2(v.x, v.z)))
        const rg = new THREE.ShapeGeometry(shape)
        const pos = rg.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < pos.count; i++) {
          const sx = pos.getX(i), sz = pos.getY(i) // shape XY = scene XZ
          pos.setXYZ(i, sx, pf.elev(sx, sz), sz)
        }
        rg.computeVertexNormals()
        const roof = new THREE.Mesh(rg, roofMat)
        roof.castShadow = true; roof.receiveShadow = true
        scene.add(roof)
        pickTargets.push(roof)
        // Walls — drop each footprint edge to the ground.
        const wv: number[] = []
        for (let i = 0; i < fp.length; i++) {
          const a = fp[i], b = fp[(i + 1) % fp.length]
          const ay = pf.elev(a.x, a.z), by = pf.elev(b.x, b.z)
          wv.push(a.x, 0, a.z, b.x, 0, b.z, b.x, by, b.z)
          wv.push(a.x, 0, a.z, b.x, by, b.z, a.x, ay, a.z)
        }
        const wg = new THREE.BufferGeometry()
        wg.setAttribute('position', new THREE.Float32BufferAttribute(wv, 3))
        wg.computeVertexNormals()
        const walls = new THREE.Mesh(wg, wallMat)
        walls.castShadow = true; walls.receiveShadow = true
        scene.add(walls)
        const ring = fp.map((v) => new THREE.Vector3(v.x, pf.elev(v.x, v.z), v.z))
        ring.push(ring[0])
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), edgeMat))
      }
      const c = avg(fp)
      // Photoreal: keep the clean tilted panel geometry, but lift the whole array so it rests on the
      // real roof height (sampled once at the plane centroid) — far cleaner than warping to noisy DSM.
      let baseOffset = 0
      if (usePhotoreal) {
        const clat = p.polygon.reduce((a, v) => a + v.lat / p.polygon.length, 0)
        const clng = p.polygon.reduce((a, v) => a + v.lng / p.polygon.length, 0)
        const { east, north } = enOf({ lat: clat, lng: clng })
        baseOffset = sampleHeight(dsm!, east, north) - pf.elev(c.x, c.z)
      }
      planeGeo.set(p.id, { pf, baseOffset })
      roofCenters.push({ x: c.x, y: pf.elev(c.x, c.z) + baseOffset, z: c.z })

      // Panels — clean flat tilt (plane pitch/azimuth), lifted onto the roof.
      p.panels?.forEach((pn) => {
        const g3 = pn.corners.map((v) => new THREE.Vector3(X(v), pf.elev(X(v), Z(v)) + baseOffset + (usePhotoreal ? 0.25 : 0), Z(v)))
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
    const gridFor = (p: DesignPlane) => planeGrid(p.polygon, moduleById(p.moduleId ?? moduleIdRef.current), { orientation: p.orientation ?? 'portrait', setback: p.setbackM ?? designRef.current.setbackM, rowGap: p.rowGapM })
    const cellQuad = (pid: string, cell: GridCell) => { const g = planeGeo.get(pid); return cell.corners.map((v) => new THREE.Vector3(X(v), (g ? g.pf.elev(X(v), Z(v)) + g.baseOffset : 0) + 0.4, Z(v))) }
    const drawGhost = (pid: string, cells: GridCell[], removing: boolean) => {
      ghostGroup.clear()
      cells.forEach((cell) => {
        const q = cellQuad(pid, cell)
        const geo = new THREE.BufferGeometry().setFromPoints([q[0], q[1], q[2], q[0], q[2], q[3]])
        const m = new THREE.Mesh(geo, removing ? ghostRemove : ghostAdd); m.renderOrder = 999; ghostGroup.add(m)
      })
    }
    let dragPid: string | null = null, startCell: GridCell | null = null, lastCell: GridCell | null = null, dragCells: GridCell[] = [], moved = false
    const hasPanelAt = (p: DesignPlane, c: GridCell) => (p.panels ?? []).some((pn) => sameCell(panelCtr(pn), c.center))
    const onMove = (ev: PointerEvent) => {
      if (!addingRef.current) return
      if (dragPid && startCell) {
        const ll = pickLL(ev); if (!ll) return
        const cur = nearestCell(dragCells, ll); if (!cur) return
        lastCell = cur
        if (cur.row !== startCell.row || cur.col !== startCell.col) moved = true
        const p = designRef.current.planes.find((x) => x.id === dragPid)
        drawGhost(dragPid, cellBlock(dragCells, startCell, cur), !moved && !!p && hasPanelAt(p, startCell))
      } else {
        const ll = pickLL(ev); const p = ll ? planeAtLL(ll) : undefined
        if (p && ll) { const c = nearestCell(gridFor(p), ll); drawGhost(p.id, c ? [c] : [], !!c && hasPanelAt(p, c)) }
        else ghostGroup.clear()
      }
    }
    const onDown = (ev: PointerEvent) => {
      if (!addingRef.current || ev.button !== 0) return
      const ll = pickLL(ev); const p = ll ? planeAtLL(ll) : undefined
      if (!p || !ll) return
      dragPid = p.id; dragCells = gridFor(p); startCell = nearestCell(dragCells, ll); lastCell = startCell; moved = false
    }
    const onUp = () => {
      if (!addingRef.current || !dragPid || !startCell) { dragPid = null; startCell = null; return }
      const p = designRef.current.planes.find((x) => x.id === dragPid)
      if (p) {
        let panels = [...(p.panels ?? [])]
        if (!moved) {
          const idx = panels.findIndex((pn) => sameCell(panelCtr(pn), startCell!.center))
          if (idx >= 0) panels.splice(idx, 1); else panels.push({ id: uid('pn'), corners: startCell.corners })
        } else {
          for (const c of cellBlock(dragCells, startCell, lastCell ?? startCell)) if (!panels.some((pn) => sameCell(panelCtr(pn), c.center))) panels.push({ id: uid('pn'), corners: c.corners })
        }
        commitRef.current?.(dragPid, panels)
      }
      ghostGroup.clear(); dragPid = null; startCell = null; dragCells = []; moved = false
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
  }, [design.id, design.planes, design.obstacles, design.eaveHeightM, photoreal, dsm, rgb, showFlux])

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
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 text-white rounded-full shadow-modal px-4 py-2 text-[12.5px] font-semibold inline-flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}>Click the roof to place a module · drag for a block · click one to remove · right-drag to orbit</div>
      )}
      {hasGeom && !hasPanels && !adding && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-white/95 backdrop-blur border border-border rounded-full shadow-modal px-4 py-2 text-[12.5px] font-semibold text-ink-2">Hit <b>Ovi auto-layout</b>, or use <b>Add panels</b> to place them on the roof</div>
      )}
      {!hasGeom && (
        <div className="absolute inset-0 flex items-center justify-center text-center">
          <div className="bg-surface/95 border border-border rounded-card px-6 py-5 shadow-modal max-w-[340px] pointer-events-auto">
            <div className="text-[15px] font-bold text-ink">No roof captured yet</div>
            <div className="text-[12.5px] text-muted-b mt-1">3D builds from the roof — capture one first. On big buildings Google often misses, so drawing it by hand is the sure way.</div>
            {onCapture && <button onClick={onCapture} className="mt-3 h-9 px-4 rounded-control text-white text-[13px] font-semibold inline-flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}>Capture the roof →</button>}
          </div>
        </div>
      )}
      {hasGeom && (
        <>
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
            <button onClick={() => setSpin((s) => !s)} className={`h-9 px-3.5 rounded-full backdrop-blur border shadow-modal text-[12.5px] font-semibold inline-flex items-center gap-2 ${spin ? 'text-white border-transparent' : 'bg-white/95 text-ink-2 border-border'}`} style={spin ? { background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' } : undefined}>
              <span className={spin ? 'animate-spin' : ''}>⟳</span>{spin ? 'Orbiting' : 'Orbit'}
            </button>
            {dsmStatus === 'loading' && (
              <span className="h-9 px-3.5 rounded-full bg-white/95 backdrop-blur border border-border shadow-modal text-[12px] font-semibold text-ink-3 inline-flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" />Loading real roof…</span>
            )}
            {dsmStatus === 'ready' && (
              <>
                <button onClick={() => setPhotoreal((v) => !v)} title="Toggle the real 3D roof (Google DSM) vs the clean model" className={`h-9 px-3.5 rounded-full backdrop-blur border shadow-modal text-[12.5px] font-semibold inline-flex items-center gap-1.5 ${photoreal ? 'text-white border-transparent' : 'bg-white/95 text-ink-2 border-border'}`} style={photoreal ? { background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' } : undefined}>◈ Photoreal</button>
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
