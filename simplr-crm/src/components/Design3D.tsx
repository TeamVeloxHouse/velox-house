import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { frameFromPoints } from '../lib/solar'
import { planeFrame } from '../lib/design'
import type { Design } from '../store/types'

type LL = { lat: number; lng: number }

const EAVE_H = 5 // metres to the eave — a two-storey wall under the pitched roof

/** A live, photoreal-ish 3D model of the design — each roof plane tilted to its true pitch/azimuth,
 *  walls dropped to the ground, obstacles cut out, and the packed panels sitting flush on the slope
 *  (not flat). Satellite-textured ground, gradient sky, a moveable sun casting soft shadows. Built
 *  entirely from the design geometry we already hold — no extra API. */
export function Design3D({ design, onCapture }: { design: Design; onCapture?: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const sunHour = useRef(13)
  const [hour, setHour] = useState(13)
  const [glError, setGlError] = useState(false)
  const [spin, setSpin] = useState(false)
  const spinRef = useRef(false)
  spinRef.current = spin

  useEffect(() => {
    const el = host.current
    if (!el) return
    const planes = design.planes.filter((p) => p.polygon.length >= 3)
    const allPts: LL[] = planes.flatMap((p) => p.polygon)
    if (!allPts.length) return

    const origin = allPts.reduce((a, p) => ({ lat: a.lat + p.lat / allPts.length, lng: a.lng + p.lng / allPts.length }), { lat: 0, lng: 0 })
    const mPerLat = 110540, mPerLng = 111320 * Math.cos((origin.lat * Math.PI) / 180)
    const X = (p: LL) => (p.lng - origin.lng) * mPerLng
    const Z = (p: LL) => -(p.lat - origin.lat) * mPerLat // north → −z

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
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.position.set(X(frame.center), 0.02, Z(frame.center))
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

    // ── Roof planes ──
    const panelEdgeSegments: number[] = []
    let panelTotal = 0
    const panelMats: THREE.Matrix4[] = []
    const roofCenters: { x: number; y: number; z: number }[] = []

    planes.forEach((p) => {
      const fp = p.polygon.map((pt) => ({ x: X(pt), z: Z(pt) }))
      const pf = planeFrame(fp, p.pitchDeg, p.azimuthDeg, EAVE_H)

      // Roof surface — triangulate the footprint, then lift each vertex onto the tilted plane.
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
      const c = avg(fp); roofCenters.push({ x: c.x, y: pf.elev(c.x, c.z), z: c.z })

      // Walls — drop each footprint edge to the ground.
      const wv: number[] = []
      for (let i = 0; i < fp.length; i++) {
        const a = fp[i], b = fp[(i + 1) % fp.length]
        const ay = pf.elev(a.x, a.z), by = pf.elev(b.x, b.z)
        // two triangles: a0,b0,bTop  and  a0,bTop,aTop
        wv.push(a.x, 0, a.z, b.x, 0, b.z, b.x, by, b.z)
        wv.push(a.x, 0, a.z, b.x, by, b.z, a.x, ay, a.z)
      }
      const wg = new THREE.BufferGeometry()
      wg.setAttribute('position', new THREE.Float32BufferAttribute(wv, 3))
      wg.computeVertexNormals()
      const walls = new THREE.Mesh(wg, wallMat)
      walls.castShadow = true; walls.receiveShadow = true
      scene.add(walls)

      // Roof outline (crisp ridge/eave lines)
      const ring = fp.map((v) => new THREE.Vector3(v.x, pf.elev(v.x, v.z), v.z))
      ring.push(ring[0])
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), edgeMat))

      // Obstacles on this footprint — raised keep-out prisms.
      // (obstacles are design-level; drawn once below)

      // Panels — tilt each flush onto the plane.
      p.panels?.forEach((pn) => {
        const g3 = pn.corners.map((v) => { const x = X(v), z = Z(v); return new THREE.Vector3(x, pf.elev(x, z), z) })
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
      const ref = planes[0] ? planeFrame(planes[0].polygon.map((pt) => ({ x: X(pt), z: Z(pt) })), planes[0].pitchDeg, planes[0].azimuthDeg, EAVE_H) : null
      const shape = new THREE.Shape(fp.map((v) => new THREE.Vector2(v.x, v.z)))
      const h = o.kind === 'chimney' ? 1.6 : o.kind === 'hvac' ? 1.1 : 0.15
      const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false })
      geo.rotateX(-Math.PI / 2)
      const base = ref ? ref.elev(avg(fp).x, avg(fp).z) : EAVE_H
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
    controls.target.set(cx, EAVE_H, cz)
    camera.position.set(cx + dist * 0.62, EAVE_H + dist * 0.9, cz + dist * 0.62)
    camera.lookAt(cx, EAVE_H, cz)

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
      sun.target.position.set(cx, EAVE_H, cz)
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

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose()
      scene.traverse((o) => { const m = (o as THREE.Mesh); if (m.geometry) m.geometry.dispose?.() })
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design.id, design.planes, design.obstacles])

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
      {hasGeom && !hasPanels && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white/95 backdrop-blur border border-border rounded-full shadow-modal px-4 py-2 text-[12.5px] font-semibold text-ink-2">Roof is in 3D — switch to 2D and hit <b>AI auto-layout</b> to see the panels</div>
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
          <button onClick={() => setSpin((s) => !s)} className={`absolute top-3 left-3 z-10 h-9 px-3.5 rounded-full backdrop-blur border shadow-modal text-[12.5px] font-semibold inline-flex items-center gap-2 ${spin ? 'bg-accent text-white border-transparent' : 'bg-white/95 text-ink-2 border-border'}`} style={spin ? { background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' } : undefined}>
            <span className={spin ? 'animate-spin' : ''}>⟳</span>{spin ? 'Orbiting' : 'Orbit'}
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-white/95 backdrop-blur border border-border rounded-full shadow-modal px-4 py-2 flex items-center gap-3">
            <span className="text-[11.5px] font-semibold text-ink-2 tabular-nums w-16">☀ {hour}:00</span>
            <input type="range" min={6} max={20} value={hour} onChange={(e) => { const h = +e.target.value; setHour(h); sunHour.current = h }} className="w-48 accent-accent" />
          </div>
        </>
      )}
    </div>
  )
}
