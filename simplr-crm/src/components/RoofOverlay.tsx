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
  center, segments, zoom = 19, w = 560, h = 360, className,
}: {
  center?: LatLng
  segments?: { box: SegBox }[]
  zoom?: number
  w?: number
  h?: number
  className?: string
}) {
  if (!center || !segments?.length) return null
  const c = worldPx(center.lat, center.lng, zoom)
  const toXY = (lat: number, lng: number) => {
    const p = worldPx(lat, lng, zoom)
    return [w / 2 + (p.x - c.x), h / 2 + (p.y - c.y)]
  }

  const polys = segments
    .map(({ box }) => {
      const corners = [
        toXY(box.sw.lat, box.sw.lng),
        toXY(box.sw.lat, box.ne.lng),
        toXY(box.ne.lat, box.ne.lng),
        toXY(box.ne.lat, box.sw.lng),
      ]
      return corners.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    })
    // keep only planes that actually fall on the tile
    .filter((pts) => pts.split(' ').some((p) => { const [x, y] = p.split(',').map(Number); return x > -40 && x < w + 40 && y > -40 && y < h + 40 }))

  if (!polys.length) return null
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" className={className} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <defs>
        <filter id="roofGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.2" floodColor="#22D3EE" floodOpacity="0.9" />
        </filter>
      </defs>
      {polys.map((pts, i) => (
        <polygon key={i} points={pts} fill="rgba(34,211,238,0.20)" stroke="#22D3EE" strokeWidth={2} strokeLinejoin="round" filter="url(#roofGlow)" />
      ))}
    </svg>
  )
}
