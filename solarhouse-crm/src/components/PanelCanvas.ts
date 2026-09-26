import L from 'leaflet'

/* Photoreal module renderer for the 2D designer — one canvas for every panel, drawn the way a real
 * module looks from above: a soft drop shadow, a deep-blue glass body with a subtle gradient, the cell
 * grid, a thin silver frame, a glossy highlight, and a small downslope chevron. Hover and selection get
 * a clean teal treatment. Leaflet vectors can't do gradients or cell detail — this can. */

type LL = { lat: number; lng: number }
export type CanvasPanel = { id: string; corners: LL[]; azimuthDeg: number; portrait?: boolean }

export class PanelCanvasLayer extends L.Layer {
  private canvas!: HTMLCanvasElement
  private host?: L.Map
  panels: CanvasPanel[] = []
  hoverId: string | null = null
  selected = new Set<string>()
  hidden = new Set<string>() // panels temporarily hidden (e.g. while being dragged as ghosts)
  dim = new Set<string>() // panels being moved — faded so the light preview reads clearly
  alpha = 1 // 'see-through' mode draws every module translucent so the roof shows through

  onAdd(map: L.Map) {
    this.host = map
    this.canvas = L.DomUtil.create('canvas', 'leaflet-zoom-hide') as HTMLCanvasElement
    this.canvas.style.pointerEvents = 'none'
    const pane = map.getPane('panels') ?? map.getPanes().overlayPane
    pane.appendChild(this.canvas)
    map.on('moveend zoomend resize viewreset', this.redraw, this)
    map.on('zoomstart', this.hide, this)
    this.redraw()
    return this
  }
  onRemove(map: L.Map) {
    map.off('moveend zoomend resize viewreset', this.redraw, this)
    map.off('zoomstart', this.hide, this)
    this.canvas.remove()
    return this
  }
  private hide() { if (this.canvas) this.canvas.style.opacity = '0' }

  setPanels(p: CanvasPanel[]) { this.panels = p; this.redraw() }
  setHover(id: string | null) { if (id !== this.hoverId) { this.hoverId = id; this.redraw() } }
  setSelected(ids: string[]) { this.selected = new Set(ids); this.redraw() }
  setHidden(ids: string[]) { this.hidden = new Set(ids); this.redraw() }
  setDim(ids: string[]) { this.dim = new Set(ids); this.redraw() }
  setAlpha(a: number) { if (a !== this.alpha) { this.alpha = a; this.redraw() } }

  redraw() {
    const map = this.host; if (!map || !this.canvas) return
    const size = map.getSize(), dpr = window.devicePixelRatio || 1
    const topLeft = map.containerPointToLayerPoint([0, 0])
    L.DomUtil.setPosition(this.canvas, topLeft)
    this.canvas.width = size.x * dpr; this.canvas.height = size.y * dpr
    this.canvas.style.width = `${size.x}px`; this.canvas.style.height = `${size.y}px`
    this.canvas.style.opacity = '1'
    const ctx = this.canvas.getContext('2d'); if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.x, size.y)
    const pts = (c: LL[]) => c.map((v) => map.latLngToContainerPoint([v.lat, v.lng]))

    // 1) shadows for all panels first so no shadow ever sits on top of a neighbour
    ctx.save()
    for (const p of this.panels) {
      if (this.hidden.has(p.id) || this.dim.has(p.id) || this.alpha < 0.9) continue // no shadows in see-through / while moving
      const q = pts(p.corners)
      ctx.beginPath(); q.forEach((v, i) => (i ? ctx.lineTo(v.x + 1.6, v.y + 2.2) : ctx.moveTo(v.x + 1.6, v.y + 2.2))); ctx.closePath()
      ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 5; ctx.fill()
    }
    ctx.restore()

    // 2) the modules
    for (const p of this.panels) {
      if (this.hidden.has(p.id)) continue
      const q = pts(p.corners)
      const e1 = Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y), e2 = Math.hypot(q[2].x - q[1].x, q[2].y - q[1].y)
      const on = this.selected.has(p.id), hov = this.hoverId === p.id
      ctx.globalAlpha = this.dim.has(p.id) ? 0.22 : on && this.alpha < 1 ? Math.min(1, this.alpha + 0.2) : this.alpha
      const path = () => { ctx.beginPath(); q.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y))); ctx.closePath() }

      // glass body — deep blue-black, lighter towards the top edge
      const g = ctx.createLinearGradient(q[0].x, q[0].y, q[2].x, q[2].y)
      g.addColorStop(0, hov ? '#2B4166' : '#223453'); g.addColorStop(0.55, hov ? '#172842' : '#111D33'); g.addColorStop(1, '#0B1424')
      path(); ctx.fillStyle = g; ctx.fill()

      // cell grid (6 across the short side × 10 along the long side) once it's big enough to read
      if (Math.min(e1, e2) > 14) {
        ctx.save(); path(); ctx.clip()
        ctx.strokeStyle = 'rgba(140,170,215,0.20)'; ctx.lineWidth = 0.6
        const longIs01 = e1 >= e2
        const [A, B, C, D] = q // A→B edge 1, B→C edge 2
        const lerp = (u: { x: number; y: number }, v: { x: number; y: number }, t: number) => ({ x: u.x + (v.x - u.x) * t, y: u.y + (v.y - u.y) * t })
        const nLong = 10, nShort = 6
        const nAB = longIs01 ? nLong : nShort, nBC = longIs01 ? nShort : nLong
        for (let i = 1; i < nAB; i++) { const s = lerp(A, B, i / nAB), t = lerp(D, C, i / nAB); ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke() }
        for (let i = 1; i < nBC; i++) { const s = lerp(B, C, i / nBC), t = lerp(A, D, i / nBC); ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke() }
        // glossy highlight across the upper half
        const hg = ctx.createLinearGradient(q[0].x, q[0].y, (q[0].x + q[2].x) / 2, (q[0].y + q[2].y) / 2)
        hg.addColorStop(0, 'rgba(255,255,255,0.13)'); hg.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = hg; ctx.fillRect(Math.min(...q.map((v) => v.x)), Math.min(...q.map((v) => v.y)), Math.max(e1, e2) * 1.5, Math.max(e1, e2) * 1.5)
        ctx.restore()
      }

      // downslope chevron — which way the module faces, small and quiet (replaces the big arrow)
      if (Math.min(e1, e2) > 18) {
        const cx = (q[0].x + q[2].x) / 2, cy = (q[0].y + q[2].y) / 2
        const az = (p.azimuthDeg * Math.PI) / 180, dx = Math.sin(az), dy = -Math.cos(az) // screen: +y is south, so north (az 0) points up
        const s = Math.min(e1, e2) * 0.16
        ctx.beginPath()
        ctx.moveTo(cx - dy * s - dx * s * 0.5, cy + dx * s - dy * s * 0.5)
        ctx.lineTo(cx + dx * s * 0.6, cy + dy * s * 0.6)
        ctx.lineTo(cx + dy * s - dx * s * 0.5, cy - dx * s - dy * s * 0.5)
        ctx.strokeStyle = 'rgba(230,240,255,0.42)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke()
      }

      // frame
      path(); ctx.strokeStyle = on ? '#62E4CC' : hov ? 'rgba(98,228,204,0.95)' : 'rgba(196,210,230,0.62)'; ctx.lineWidth = on ? 2.2 : hov ? 1.8 : 0.9; ctx.stroke()
      if (on) { path(); ctx.fillStyle = 'rgba(98,228,204,0.16)'; ctx.fill() }
    }
    ctx.globalAlpha = 1
  }
}
