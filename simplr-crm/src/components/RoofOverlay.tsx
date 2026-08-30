/* Draws the measured roof planes on top of a Google satellite tile.
 * The Solar API gives each roof segment a lat/lng bounding box; we project those to pixels with the
 * same Web-Mercator maths Google Static Maps uses, so the highlight sits exactly on the real roof. */

import type { LatLng, SegBox } from '../lib/solar'

const TILE = 256
function worldPx(lat: number, lng: number, z: number) {
  const s = TILE * 2 ** z
  const sinY = Math.min(0.9999, Math.max(-0.9999, Math.sin((lat * Math.PI) / 180)))
  return {
    x: ((lng + 180) / 360) * s,
    y: (0.5 - Math.log((1 + sinY) / (1 - sinY)) / (4 * Math.PI)) * s,
  }
}

export function RoofOverlay({
  center, segments, footprint, zoom = 19, w = 560, h = 360, className,
}: {
  center?: LatLng
  segments?: { box: SegBox }[]
  footprint?: LatLng[] // true building outline (OSM) — drawn in preference to the boxes
  zoom?: number
  w?: number
  h?: number
  className?: string
}) {
  if (!center || (!segments?.length && !footprint?.length)) return null
  const c = worldPx(center.lat, center.lng, zoom)
  const toXY = (lat: number, lng: number) => {
    const p = worldPx(lat, lng, zoom)
    return [w / 2 + (p.x - c.x), h / 2 + (p.y - c.y)]
  }
  const onTile = (pts: string) => pts.split(' ').some((p) => { const [x, y] = p.split(',').map(Number); return x > -40 && x < w + 40 && y > -40 && y < h + 40 })

  // Prefer the real footprint polygon; fall back to Google's axis-aligned plane boxes.
  const polys = footprint?.length
    ? [footprint.map((p) => toXY(p.lat, p.lng)).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')].filter(onTile)
    : (segments ?? [])
        .map(({ box }) => {
          const corners = [
            toXY(box.sw.lat, box.sw.lng),
            toXY(box.sw.lat, box.ne.lng),
            toXY(box.ne.lat, box.ne.lng),
            toXY(box.ne.lat, box.sw.lng),
          ]
          return corners.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
        })
        .filter(onTile)

  if (!polys.length) return null
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className={className} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <defs>
        <filter id="roofGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#00E5FF" floodOpacity="1" />
        </filter>
      </defs>
      {/* dark under-stroke for contrast on bright roofs, then the bright cyan outline + fill */}
      {polys.map((pts, i) => (
        <polygon key={`u${i}`} points={pts} fill="none" stroke="#0A1B2B" strokeWidth={5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={0.5} />
      ))}
      {polys.map((pts, i) => (
        <polygon key={i} points={pts} fill="#22E0FF" fillOpacity={0.22} stroke="#00E5FF" strokeWidth={3} strokeLinejoin="round" vectorEffect="non-scaling-stroke" filter="url(#roofGlow)" />
      ))}
    </svg>
  )
}
