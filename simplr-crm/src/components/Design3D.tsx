import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { frameFromPoints } from '../lib/solar'
import type { Design } from '../store/types'

type LL = { lat: number; lng: number }

/** A live 3D model of the design — buildings extruded from the roof footprints, the packed panels on
 *  top, on a satellite-textured ground, with a moveable sun casting shadows. Built entirely from the
 *  design geometry we already have (no extra API); the DSM/photoreal layers slot in later. */
export function Design3D({ design }: { design: Design }) {
  const host = useRef<HTMLDivElement>(null)
  const sunHour = useRef(13)
  const [hour, setHour] = useState(13)
  const sunRef = useRef<THREE.DirectionalLight | null>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const planes = design.planes.filter((p) => p.polygon.length >= 3)
    const allPts: LL[] = planes.flatMap((p) => p.polygon)
    if (!allPts.length) return

    const origin = allPts.reduce((a, p) => ({ lat: a.lat + p.lat / allPts.length, lng: a.lng + p.lng / allPts.length }), { lat: 0, lng: 0 })
    const mPerLat = 110540, mPerLng = 111320 * Math.cos((origin.lat * Math.PI) / 180)
    const X = (p: LL) => (p.lng - origin.lng) * mPerLng
    const N = (p: LL) => (p.lat - origin.lat) * mPerLat // north (mapped to -z)

    const W = el.clientWidth || 800, H = el.clientHeight || 500
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b1220)
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.5, 6000)
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
    el.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2.05

    // Lights
    scene.add(new THREE.HemisphereLight(0xbcd3ff, 0x40484f, 0.75))
    const sun = new THREE.DirectionalLight(0xfff2d6, 2.1)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const S = 120
    Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 800 })
    sunRef.current = sun
    scene.add(sun); scene.add(sun.target)

    // Ground — satellite tile textured onto a plane sized to its real-world extent.
    const frame = frameFromPoints(allPts) || { center: origin, zoom: 19 }
    const mpp = (156543.03392 * Math.cos((origin.lat * Math.PI) / 180)) / 2 ** frame.zoom
    const groundM = mpp * 640
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(groundM, groundM),
      new THREE.MeshStandardMaterial({ color: 0x8a929c, roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true
    // offset ground so the tile centre (frame.center) aligns with our origin
    ground.position.set(X(frame.center), 0, -N(frame.center))
    scene.add(ground)
    new THREE.TextureLoader().load(`/api/roof-image?lat=${frame.center.lat}&lng=${frame.center.lng}&z=${frame.zoom}&size=640x640`, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      ;(ground.material as THREE.MeshStandardMaterial).map = tex
      ;(ground.material as THREE.MeshStandardMaterial).color.set(0xffffff)
      ;(ground.material as THREE.MeshStandardMaterial).needsUpdate = true
    })

    // Buildings — extrude each roof footprint up to a flat roof.
    const bMat = new THREE.MeshStandardMaterial({ color: 0xd4dae4, roughness: 0.85 })
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x2a3444 })
    const HGT = 8
    let panelTotal = 0
    planes.forEach((p) => {
      const shape = new THREE.Shape()
      p.polygon.forEach((pt, i) => (i ? shape.lineTo(X(pt), N(pt)) : shape.moveTo(X(pt), N(pt))))
      const geo = new THREE.ExtrudeGeometry(shape, { depth: HGT, bevelEnabled: false })
      geo.rotateX(-Math.PI / 2)
      const mesh = new THREE.Mesh(geo, bMat)
      mesh.castShadow = true; mesh.receiveShadow = true
      scene.add(mesh)
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat)
      scene.add(edges)
      panelTotal += p.panels?.length ?? 0
    })

    // Panels — one instanced mesh of thin tiles, sat on the roofs.
    if (panelTotal) {
      const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.05, 1), new THREE.MeshStandardMaterial({ color: 0x16307a, metalness: 0.35, roughness: 0.45 }), panelTotal)
      inst.castShadow = true
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler()
      let i = 0
      planes.forEach((p) => p.panels?.forEach((pn) => {
        const c = pn.corners.map((v) => ({ x: X(v), z: -N(v) }))
        const cx = (c[0].x + c[1].x + c[2].x + c[3].x) / 4, cz = (c[0].z + c[1].z + c[2].z + c[3].z) / 4
        const w = Math.hypot(c[1].x - c[0].x, c[1].z - c[0].z)
        const d = Math.hypot(c[2].x - c[1].x, c[2].z - c[1].z)
        const yaw = Math.atan2(c[1].z - c[0].z, c[1].x - c[0].x)
        e.set(0, -yaw, 0); q.setFromEuler(e)
        m.compose(new THREE.Vector3(cx, HGT + 0.06, cz), q, new THREE.Vector3(w || 1, 1, d || 1))
        inst.setMatrixAt(i++, m)
      }))
      inst.instanceMatrix.needsUpdate = true
      scene.add(inst)
    }

    // Camera framing — fit the whole roof from a 3/4 aerial angle whatever its size/spread.
    const bx = allPts.map(X), bz = allPts.map((p) => -N(p))
    const cx = (Math.min(...bx) + Math.max(...bx)) / 2, cz = (Math.min(...bz) + Math.max(...bz)) / 2
    const span = Math.max(Math.max(...bx) - Math.min(...bx), Math.max(...bz) - Math.min(...bz), 24)
    const dist = span * 1.4 + 28
    controls.target.set(cx, HGT, cz)
    camera.position.set(cx + dist * 0.62, HGT + dist * 0.85, cz + dist * 0.62)
    camera.lookAt(cx, HGT, cz)

    function placeSun(h: number) {
      // Northern-hemisphere arc: rises east (+x) at 06:00, south (+z) at midday, sets west (−x) at 18:00.
      const t = Math.min(1, Math.max(0, (h - 6) / 12))
      const az = Math.PI * (0.5 - t)
      const elev = Math.max(0.05, Math.sin(Math.PI * t))
      const horiz = 300 * (1 - elev * 0.5)
      sun.position.set(cx + Math.sin(az) * horiz, 50 + elev * 320, cz + Math.cos(az) * horiz * 0.8 + 30)
      sun.target.position.set(cx, 0, cz)
      sun.intensity = 1.0 + elev * 1.5
    }
    placeSun(sunHour.current)

    let raf = 0
    const loop = () => { controls.update(); placeSun(sunHour.current); renderer.render(scene, camera); raf = requestAnimationFrame(loop) }
    loop()

    const onResize = () => { const w = el.clientWidth, h = el.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h) }
    const ro = new ResizeObserver(onResize); ro.observe(el)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose()
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design.id, design.planes])

  const hasGeom = design.planes.some((p) => p.polygon.length >= 3)
  const hasPanels = design.planes.some((p) => p.panels?.length)
  return (
    <div className="absolute inset-0">
      <div ref={host} className="absolute inset-0" />
      {hasGeom && !hasPanels && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white/95 backdrop-blur border border-border rounded-full shadow-modal px-4 py-2 text-[12.5px] font-semibold text-ink-2">Roof is in 3D — switch to 2D and hit <b>AI auto-layout</b> to see the panels</div>
      )}
      {!hasGeom && (
        <div className="absolute inset-0 flex items-center justify-center text-center">
          <div className="bg-surface/95 border border-border rounded-card px-6 py-5 shadow-modal max-w-[340px]">
            <div className="text-[15px] font-bold text-ink">Nothing to show in 3D yet</div>
            <div className="text-[12.5px] text-muted-b mt-1">Detect or draw a roof plane in 2D, then switch back here to see it in 3D.</div>
          </div>
        </div>
      )}
      {hasGeom && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-white/95 backdrop-blur border border-border rounded-full shadow-modal px-4 py-2 flex items-center gap-3">
          <span className="text-[11.5px] font-semibold text-ink-2 tabular-nums w-16">☀ {hour}:00</span>
          <input type="range" min={6} max={20} value={hour} onChange={(e) => { const h = +e.target.value; setHour(h); sunHour.current = h }} className="w-48 accent-accent" />
        </div>
      )}
    </div>
  )
}
