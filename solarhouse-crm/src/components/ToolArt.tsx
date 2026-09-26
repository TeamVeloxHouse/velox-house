/* Isometric illustrations for the Lead-tools cards — hand-built SVG in the house palette (navy #15223B,
 * teal #62E4CC, cool greys), so they stay crisp at any size and never drift off-brand. One tiny iso
 * projector + a few parts (house, battery, charger, car, card) compose every scene. */

const NAVY = '#15223B', NAVY2 = '#22345A', TEAL = '#62E4CC', TEAL_D = '#2BB89D'
const WALL_L = '#F4F7FA', WALL_R = '#DCE3EA', ROOF_F = '#AEB9C6', ROOF_B = '#C8D1DB', GROUND = '#E9EEF3'

type P3 = [number, number, number]
/** Isometric projection: x runs down-right, y runs down-left, z is up. `o` = screen origin, s = scale. */
function iso(o: [number, number], s = 1) {
  return ([x, y, z]: P3) => [o[0] + (x - y) * 0.866 * s, o[1] + (x + y) * 0.5 * s - z * s] as [number, number]
}
const pts = (ps: [number, number][]) => ps.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')

function Shadow({ cx, cy, rx, ry = rx * 0.32, o = 0.16 }: { cx: number; cy: number; rx: number; ry?: number; o?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={NAVY} opacity={o} filter="url(#ta-blur)" />
}

/** A gabled house: w along x (ridge direction), d along y, wall height h, ridge rise r. Panels on the
 *  front (+y) slope as `cols × rows`. `glow` traces the roof in teal (the Home Finder's "this one"). */
function House({ at, s = 1, w = 34, d = 24, h = 16, r = 11, panels, glow, dim, door = true }: {
  at: [number, number]; s?: number; w?: number; d?: number; h?: number; r?: number
  panels?: { cols: number; rows: number }; glow?: boolean; dim?: boolean; door?: boolean
}) {
  const P = iso(at, s)
  const slope = (u: number, v: number): P3 => [u, d - v * (d / 2), h + v * r] // u along x, v 0 (eave) → 1 (ridge)
  const cells: [number, number][][] = []
  if (panels) {
    const mu = w * 0.1, mv = 0.14, cu = (w - 2 * mu) / panels.cols, cv = (1 - 2 * mv) / panels.rows, g = 0.09
    for (let i = 0; i < panels.cols; i++) for (let j = 0; j < panels.rows; j++) {
      const u0 = mu + i * cu + g, u1 = mu + (i + 1) * cu - g, v0 = mv + j * cv + g * 0.02, v1 = mv + (j + 1) * cv - g * 0.02
      cells.push([slope(u0, v0), slope(u1, v0), slope(u1, v1), slope(u0, v1)].map(P))
    }
  }
  const op = dim ? 0.55 : 1
  return (
    <g opacity={op}>
      {/* back slope, then the two visible walls, the gable, the front slope */}
      <polygon points={pts([P([0, 0, h]), P([w, 0, h]), P([w, d / 2, h + r]), P([0, d / 2, h + r])])} fill={ROOF_B} />
      <polygon points={pts([P([0, d, 0]), P([w, d, 0]), P([w, d, h]), P([0, d, h])])} fill={WALL_L} />
      <polygon points={pts([P([w, 0, 0]), P([w, d, 0]), P([w, d, h]), P([w, 0, h])])} fill={WALL_R} />
      <polygon points={pts([P([w, 0, h]), P([w, d, h]), P([w, d / 2, h + r])])} fill={WALL_R} />
      <polygon points={pts([P([0, d, h]), P([w, d, h]), P([w, d / 2, h + r]), P([0, d / 2, h + r])])} fill={ROOF_F} />
      {/* windows + door on the front wall */}
      {[0.2, 0.62].map((f) => <polygon key={f} points={pts([P([w * f, d, h * 0.5]), P([w * (f + 0.18), d, h * 0.5]), P([w * (f + 0.18), d, h * 0.82]), P([w * f, d, h * 0.82])])} fill={NAVY2} opacity={0.75} />)}
      {door && <polygon points={pts([P([w * 0.44, d, 0]), P([w * 0.56, d, 0]), P([w * 0.56, d, h * 0.42]), P([w * 0.44, d, h * 0.42])])} fill={NAVY} />}
      <polygon points={pts([P([w, d * 0.3, h * 0.5]), P([w, d * 0.62, h * 0.5]), P([w, d * 0.62, h * 0.82]), P([w, d * 0.3, h * 0.82])])} fill={NAVY2} opacity={0.6} />
      {cells.map((c, i) => <polygon key={i} points={pts(c)} fill={NAVY} stroke={TEAL} strokeWidth={0.35 * s} strokeOpacity={0.55} />)}
      {glow && <polygon points={pts([P([0, d, h]), P([w, d, h]), P([w, d / 2, h + r]), P([w, 0, h]), P([0, 0, h]), P([0, d / 2, h + r])])} fill={TEAL} fillOpacity={0.08} stroke={TEAL} strokeWidth={1.6} strokeLinejoin="round" filter="url(#ta-glow)" />}
    </g>
  )
}

function Battery({ at, s = 1, h = 26 }: { at: [number, number]; s?: number; h?: number }) {
  const P = iso(at, s), w = 9, d = 4
  return (
    <g>
      <polygon points={pts([P([0, d, 0]), P([w, d, 0]), P([w, d, h]), P([0, d, h])])} fill="#FFFFFF" stroke="#D5DCE4" strokeWidth={0.6} />
      <polygon points={pts([P([w, 0, 0]), P([w, d, 0]), P([w, d, h]), P([w, 0, h])])} fill={WALL_R} />
      <polygon points={pts([P([0, 0, h]), P([w, 0, h]), P([w, d, h]), P([0, d, h])])} fill="#F7F9FB" />
      <polygon points={pts([P([w * 0.42, d, h * 0.22]), P([w * 0.58, d, h * 0.22]), P([w * 0.58, d, h * 0.82]), P([w * 0.42, d, h * 0.82])])} fill={TEAL} filter="url(#ta-glow)" />
    </g>
  )
}

function Car({ at, s = 1 }: { at: [number, number]; s?: number }) {
  const P = iso(at, s), L = 26, W = 12
  return (
    <g>
      <Shadow cx={P([L / 2, W / 2, 0])[0]} cy={P([L / 2, W / 2, 0])[1] + 2} rx={20 * s} o={0.14} />
      <polygon points={pts([P([0, W, 2]), P([L, W, 2]), P([L, W, 8]), P([0, W, 8])])} fill={NAVY} />
      <polygon points={pts([P([L, 0, 2]), P([L, W, 2]), P([L, W, 8]), P([L, 0, 8])])} fill={NAVY2} />
      <polygon points={pts([P([0, 0, 8]), P([L, 0, 8]), P([L, W, 8]), P([0, W, 8])])} fill="#2C4270" />
      <polygon points={pts([P([6, 1.5, 8]), P([19, 1.5, 8]), P([17, 2.5, 13]), P([8, 2.5, 13]), P([8, W - 2.5, 13]), P([17, W - 2.5, 13]), P([19, W - 1.5, 8]), P([6, W - 1.5, 8])])} fill="#34507F" />
      <polygon points={pts([P([8, W - 2.5, 13]), P([17, W - 2.5, 13]), P([19, W - 1.5, 8]), P([6, W - 1.5, 8])])} fill="#9FB3CF" opacity={0.85} />
      <polygon points={pts([P([17, 2.5, 13]), P([17, W - 2.5, 13]), P([19, W - 1.5, 8]), P([19, 1.5, 8])])} fill="#BFD0E6" opacity={0.8} />
      {[[5, W], [21, W]].map(([x, y], i) => { const c = P([x, y, 2]); return <ellipse key={i} cx={c[0]} cy={c[1]} rx={3.2 * s} ry={2.4 * s} fill="#0B1424" /> })}
      <polygon points={pts([P([L, 3, 5]), P([L, W - 3, 5]), P([L, W - 3, 6.2]), P([L, 3, 6.2])])} fill={TEAL} opacity={0.9} />
    </g>
  )
}

function Defs() {
  return (
    <defs>
      <filter id="ta-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
      <filter id="ta-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <linearGradient id="ta-flow" x1="0" x2="1"><stop offset="0" stopColor={TEAL} stopOpacity="0.2" /><stop offset="0.5" stopColor={TEAL} /><stop offset="1" stopColor={TEAL} stopOpacity="0.2" /></linearGradient>
    </defs>
  )
}
const Frame = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 320 150" className="w-full h-full" preserveAspectRatio="xMidYMid meet" fill="none"><Defs />{children}</svg>
)

/* ── the six scenes ─────────────────────────────────────────────────────── */

/** Origin that centres a w×d ground tile at (cx, cy) on screen. */
const centre = (w: number, d: number, s: number, cx = 160, cy = 96): [number, number] => [cx - ((w - d) / 2) * 0.866 * s, cy - ((w + d) / 4) * s]
/** A diorama base: the ground tile with a shallow slab edge, so each scene reads as a little model. */
function Base({ o, s, w, d }: { o: [number, number]; s: number; w: number; d: number }) {
  const P = iso(o, s), t = 3.2
  return (
    <g>
      <polygon points={pts([P([0, d, 0]), P([w, d, 0]), P([w, d, -t]), P([0, d, -t])])} fill="#CBD5DF" />
      <polygon points={pts([P([w, 0, 0]), P([w, d, 0]), P([w, d, -t]), P([w, 0, -t])])} fill="#B9C5D1" />
      <polygon points={pts([P([0, 0, 0]), P([w, 0, 0]), P([w, d, 0]), P([0, d, 0])])} fill={GROUND} />
    </g>
  )
}

export function ArtHomeFinder() {
  // A street of semis — one roof traced in teal with panels, a pin dropped on it.
  const w = 150, d = 62, s = 1.3, o = centre(w, d, s, 160, 104), P = iso(o, s)
  const pin = P([57, 22, 44])
  return (
    <Frame>
      <Base o={o} s={s} w={w} d={d} />
      <polygon points={pts([P([0, 44, 0.1]), P([w, 44, 0.1]), P([w, 56, 0.1]), P([0, 56, 0.1])])} fill="#D5DDE5" />
      {[8, 44, 80, 116].map((x, i) => <House key={x} at={P([x, 6, 0])} s={s * 0.78} dim={i !== 1} panels={i === 1 ? { cols: 4, rows: 2 } : undefined} glow={i === 1} door={i % 2 === 0} />)}
      <g filter="url(#ta-glow)">
        <path d={`M${pin[0]} ${pin[1] + 16} C ${pin[0] - 10} ${pin[1] + 3}, ${pin[0] - 10} ${pin[1] - 10}, ${pin[0]} ${pin[1] - 10} C ${pin[0] + 10} ${pin[1] - 10}, ${pin[0] + 10} ${pin[1] + 3}, ${pin[0]} ${pin[1] + 16} Z`} fill={NAVY} />
        <circle cx={pin[0]} cy={pin[1] - 1.5} r={3.8} fill={TEAL} />
      </g>
    </Frame>
  )
}

export function ArtWholeHome() {
  const w = 78, d = 50, s = 1.75, o = centre(w, d, s, 160, 100), P = iso(o, s)
  const roof = P([18, 16, 22]), bat = P([42, 12, 16]), car = P([56, 34, 8]), home = P([10, 26, 6])
  return (
    <Frame>
      <Base o={o} s={s} w={w} d={d} />
      <House at={P([4, 4, 0])} s={s} panels={{ cols: 4, rows: 2 }} />
      <Battery at={P([42, 8, 0])} s={s} h={20} />
      <Car at={P([46, 28, 0])} s={s * 0.95} />
      <g stroke={TEAL} strokeWidth={2.2} strokeLinecap="round" strokeDasharray="0.5 6" fill="none" filter="url(#ta-glow)">
        <path d={`M${roof[0]} ${roof[1]} Q ${(roof[0] + bat[0]) / 2 + 8} ${roof[1] - 18}, ${bat[0] + 2} ${bat[1] - 8}`} />
        <path d={`M${bat[0] + 10} ${bat[1] + 14} Q ${(bat[0] + car[0]) / 2 + 22} ${bat[1] + 10}, ${car[0] + 6} ${car[1] - 8}`} />
        <path d={`M${roof[0] - 10} ${roof[1] + 6} Q ${home[0] - 26} ${home[1] - 22}, ${home[0] - 6} ${home[1]}`} />
      </g>
    </Frame>
  )
}

export function ArtEvCharger() {
  const w = 70, d = 42, s = 1.8, o = centre(w, d, s, 162, 104), P = iso(o, s)
  const plug = P([22, 1, 12]), port = P([44, 18, 6])
  return (
    <Frame>
      <Base o={o} s={s} w={w} d={d} />
      <polygon points={pts([P([0, 0, 0]), P([w, 0, 0]), P([w, 0, 30]), P([0, 0, 30])])} fill={WALL_R} />
      {Array.from({ length: 7 }, (_, i) => <polyline key={i} points={pts([P([0, 0, 4 + i * 4]), P([w, 0, 4 + i * 4])])} stroke="#C5CFD9" strokeWidth={0.7} />)}
      <polygon points={pts([P([0, 0, 30]), P([w, 0, 30]), P([w, 9, 36]), P([0, 9, 36])])} fill={ROOF_F} />
      {[0, 1, 2, 3, 4].map((i) => <polygon key={i} points={pts([P([5 + i * 12.5, 1.3, 31]), P([15.5 + i * 12.5, 1.3, 31]), P([15.5 + i * 12.5, 7.7, 35.3]), P([5 + i * 12.5, 7.7, 35.3])])} fill={NAVY} stroke={TEAL} strokeWidth={0.35} strokeOpacity={0.6} />)}
      <polygon points={pts([P([17, 0.2, 9]), P([27, 0.2, 9]), P([27, 0.2, 22]), P([17, 0.2, 22])])} fill="#FFFFFF" stroke="#C9D2DC" strokeWidth={0.7} />
      <circle cx={P([22, 0.4, 16])[0]} cy={P([22, 0.4, 16])[1]} r={4} fill="none" stroke={TEAL} strokeWidth={2} filter="url(#ta-glow)" />
      <path d={`M${plug[0]} ${plug[1]} C ${plug[0] + 4} ${plug[1] + 34}, ${port[0] - 30} ${port[1] + 14}, ${port[0]} ${port[1]}`} stroke={NAVY} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Car at={P([36, 12, 0])} s={s} />
    </Frame>
  )
}

export function ArtEnquiries() {
  const card = (x: number, y: number, o: number, k: number) => (
    <g key={k} transform={`translate(${x} ${y})`} opacity={o}>
      <rect width="104" height="34" rx="9" fill="#FFFFFF" stroke="#DDE3EA" />
      <circle cx="18" cy="17" r="9" fill={k % 2 ? TEAL : NAVY} />
      <rect x="34" y="10" width="50" height="6" rx="3" fill="#C9D2DC" />
      <rect x="34" y="20" width="34" height="5" rx="2.5" fill="#E3E8EE" />
    </g>
  )
  return (
    <Frame>
      {card(22, 12, 0.5, 0)}{card(46, 50, 0.78, 1)}{card(74, 88, 1, 2)}
      <path d="M182 104 C 196 104, 200 98, 206 92" stroke={TEAL} strokeWidth={2.2} strokeDasharray="0.5 6" strokeLinecap="round" filter="url(#ta-glow)" />
      <g transform="translate(184 80)">
        <rect x="26" y="-6" width="70" height="16" rx="4" fill="#FFFFFF" stroke="#DDE3EA" />
        <path d="M0 12 L 22 0 H 100 L 122 12 V 40 Q 122 47 115 47 H 7 Q 0 47 0 40 Z" fill={NAVY} />
        <path d="M0 12 H 38 Q 42 26 61 26 Q 80 26 84 12 H 122" stroke={TEAL} strokeWidth={2.2} fill="none" filter="url(#ta-glow)" />
      </g>
    </Frame>
  )
}

export function ArtBatteryRetrofit() {
  const w = 72, d = 48, s = 1.75, o = centre(w, d, s, 160, 100), P = iso(o, s)
  const plus = P([54, 10, 36])
  return (
    <Frame>
      <Base o={o} s={s} w={w} d={d} />
      <House at={P([6, 6, 0])} s={s} panels={{ cols: 4, rows: 2 }} />
      <Battery at={P([48, 10, 0])} s={s} h={22} />
      <g filter="url(#ta-glow)">
        <circle cx={plus[0]} cy={plus[1]} r={10} fill={TEAL} />
        <path d={`M${plus[0] - 5} ${plus[1]} H ${plus[0] + 5} M ${plus[0]} ${plus[1] - 5} V ${plus[1] + 5}`} stroke={NAVY} strokeWidth={2.6} strokeLinecap="round" />
      </g>
    </Frame>
  )
}

export function ArtReferrals() {
  const w = 124, d = 92, s = 1.12, o = centre(w, d, s, 160, 102), P = iso(o, s)
  const spots: P3[] = [[6, 50, 0], [80, 4, 0], [84, 58, 0]]
  const hub = P([52, 34, 28])
  return (
    <Frame>
      <Base o={o} s={s} w={w} d={d} />
      {spots.map((sp, i) => <House key={i} at={P(sp)} s={s * 0.78} dim />)}
      <House at={P([40, 22, 0])} s={s * 0.95} panels={{ cols: 3, rows: 2 }} />
      {spots.map((sp, i) => {
        const e = P([sp[0] + 14, sp[1] + 10, 30])
        return (
          <g key={i}>
            <path d={`M${hub[0]} ${hub[1]} Q ${(hub[0] + e[0]) / 2} ${Math.min(hub[1], e[1]) - 24}, ${e[0]} ${e[1]}`} stroke={TEAL} strokeWidth={2} strokeDasharray="0.5 6" strokeLinecap="round" fill="none" filter="url(#ta-glow)" />
            <path d={`M${e[0]} ${e[1] - 8} l2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.8-3.7 5.3-.8z`} fill={NAVY} stroke="#FFFFFF" strokeWidth={0.9} />
          </g>
        )
      })}
    </Frame>
  )
}
