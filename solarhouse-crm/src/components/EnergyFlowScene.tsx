import { useEffect, useId, useMemo, useRef, useState } from 'react'

/* The Solar House "live home" scene — an isometric house drawn in code with the customer's own kit on it
 * (solar, battery, EV charger in any combination) and soft teal energy streaks flowing between them.
 * Used in the showroom proposal ("See it working") and the customer portal.
 *
 * Everything is built from a tiny isometric projection P(x, y, z): the house, roof, panels, car and the
 * flow routes are all 3D points in metres-ish, so the scene re-lays itself out for any combination. The
 * power figures are a physically balanced illustration (solar + grid + battery = home + car), never a
 * forecast — the portal says so, and the proposal labels them as typical. */

export type SceneKit = { solar: boolean; battery: boolean; ev: boolean; kwp?: number; panels?: number; batteryKwh?: number; batteryName?: string }
export type SceneMode = 'day' | 'evening' | 'night' | 'outage'

type V3 = [number, number, number]
type Flow = 'solar' | 'grid' | 'battery' | 'ev' | 'home'
type Target = { solar: number; home: number; batt: number; ev: number; gridUp: boolean; soc: number; evSoc: number; clock: string; weather: string; h1: string; hp: string }

const MINT = '#62E4CC'
const S = 30, COS = Math.cos(Math.PI / 6)
const P = (x: number, y: number, z = 0): [number, number] => [(x - y) * COS * S, (x + y) * 0.5 * S - z * S]
const f1 = (n: number) => n.toFixed(1)
const pp = (a: V3[]) => a.map((p) => P(...p).map(f1).join(',')).join(' ')
const dPath = (a: V3[]) => 'M' + a.map((p) => P(...p).map(f1).join(',')).join('L')
const poly = (a: V3[], fill: string, extra = '') => `<polygon points="${pp(a)}" fill="${fill}" ${extra}/>`
const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, top: string, side: string, front: string) =>
  poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], side) +
  poly([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], front) +
  poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], top)

/* ---------- scenarios: what each combination of kit does at each time of day ---------- */
export function modesFor(k: SceneKit): SceneMode[] {
  const m: SceneMode[] = ['day', 'evening']
  if (k.battery || k.ev) m.push('night')
  if (k.battery) m.push('outage') // without a battery a grid-tied system shuts down in a power cut — we don't pretend otherwise
  return m
}
export const MODE_LABEL: Record<SceneMode, string> = { day: 'Midday', evening: 'Evening', night: 'Overnight', outage: 'Power cut' }

function scenario(k: SceneKit, mode: SceneMode): Target {
  const kwp = k.kwp || 4.8
  const r = (n: number) => Math.round(n * 10) / 10
  if (mode === 'day') {
    const solar = k.solar ? r(kwp * 0.8) : 0, home = 0.6
    const ev = k.ev && k.solar ? r(Math.max(1.4, Math.min(3.2, solar - home - 1.2))) : 0
    const batt = k.battery ? r(Math.min(2.5, Math.max(0.4, (solar - home - ev) * 0.7))) : 0
    return { solar, home, batt, ev, gridUp: true, soc: 62, evSoc: 64, clock: '12:41', weather: 'Sunny · 19°C',
      h1: k.solar ? 'Running on sunshine' : 'A normal day on the grid',
      hp: k.solar
        ? `Your panels are powering the house${k.battery ? ', filling the battery' : ''}${ev ? ' and charging the car' : ''} — and selling what’s left back to the grid.`
        : 'The car waits for the cheap overnight rate, so daytime power just runs the house.' }
  }
  if (mode === 'evening') {
    const solar = k.solar ? r(kwp * 0.06) : 0, home = 2.1
    const batt = k.battery ? -r(Math.min(3, home - solar)) : 0
    return { solar, home, batt, ev: 0, gridUp: true, soc: 86, evSoc: 81, clock: '19:08', weather: 'Clear · 14°C',
      h1: k.battery ? 'Your battery has the evening covered' : k.solar ? 'The sun’s going down' : 'Evening at home',
      hp: k.battery
        ? 'Instead of buying from the grid at the peak price, the house is running on the sunshine you stored today.'
        : k.solar ? 'Solar tails off after sunset, so the house draws from the grid until morning. A battery would cover this.' : 'The house is on the grid; the car is plugged in and scheduled for the cheap rate.' }
  }
  if (mode === 'night') {
    const home = 0.4, batt = k.battery ? 3.0 : 0, ev = k.ev ? 7.0 : 0
    return { solar: 0, home, batt, ev, gridUp: true, soc: 34, evSoc: 58, clock: '02:15', weather: 'Clear · 9°C',
      h1: 'Topping up on the cheap rate',
      hp: `Overnight electricity is a fraction of the price, so we fill ${[k.battery && 'the battery', k.ev && 'the car'].filter(Boolean).join(' and ')} ready for tomorrow.` }
  }
  const solar = k.solar ? r(kwp * 0.65) : 0, home = 1.1
  return { solar, home, batt: r(solar - home), ev: 0, gridUp: false, soc: 71, evSoc: 64, clock: '14:20', weather: k.solar ? 'Sunny · 18°C' : 'Cloudy · 12°C',
    h1: 'A power cut on the street — not in your house',
    hp: `The grid is down. Your home switched to ${k.solar ? 'solar and battery' : 'the battery'} automatically${k.ev ? ', and the car will wait until it’s back' : ''}.` }
}

/* ---------- build the static SVG for a kit ---------- */
function buildScene(k: SceneKit, u: string) {
  let h = ''
  const id = (s: string) => `${u}-${s}`
  h += `<defs>
    <linearGradient id="${id('panel')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1B3358"/><stop offset=".55" stop-color="#0D1C35"/><stop offset="1" stop-color="#0A1528"/></linearGradient>
    <linearGradient id="${id('shimg')}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9FFFEF" stop-opacity="0"/><stop offset=".5" stop-color="#CFFFF6" stop-opacity=".75"/><stop offset="1" stop-color="#9FFFEF" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id('glass')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#27466B"/><stop offset="1" stop-color="#0E1B30"/></linearGradient>
    <linearGradient id="${id('warm')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE3A6"/><stop offset="1" stop-color="#F2A94E"/></linearGradient>
    <radialGradient id="${id('glow')}"><stop offset="0" stop-color="${MINT}" stop-opacity=".55"/><stop offset="1" stop-color="${MINT}" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id('sun')}"><stop offset="0" stop-color="#FFF3C4" stop-opacity=".9"/><stop offset=".25" stop-color="#FFD98A" stop-opacity=".35"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/></radialGradient>
    <filter id="${id('soft')}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>`
  const G = (s: string) => `url(#${id(s)})`

  // sky
  h += `<g data-k="sun" style="transition:opacity 1.2s"><circle cx="250" cy="-235" r="150" fill="${G('sun')}"/><circle cx="250" cy="-235" r="22" fill="#FFF1C2"/></g>`
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  let stars = ''
  for (let i = 0; i < 60; i++) stars += `<circle cx="${(-420 + rnd() * 1000).toFixed(0)}" cy="${(-300 + rnd() * 330).toFixed(0)}" r="${(0.5 + rnd() * 1.1).toFixed(1)}" fill="#fff" opacity="${(0.25 + rnd() * 0.6).toFixed(2)}"/>`
  h += `<g data-k="stars" style="transition:opacity 1.2s;opacity:0">${stars}<circle cx="430" cy="-220" r="18" fill="#E8EEF8"/><circle cx="438" cy="-226" r="16" fill="#0D1530"/></g>`

  // platform
  const GX0 = -1.5, GX1 = 16.5, GY0 = -3.5, GY1 = 10.5, T = 0.7
  h += `<ellipse cx="${P(7.5, 3.5)[0]}" cy="${P(7.5, 3.5)[1] + 60}" rx="560" ry="200" fill="#000" opacity=".35" filter="${G('soft')}"/>`
  h += poly([[GX0, GY1, 0], [GX1, GY1, 0], [GX1, GY1, -T], [GX0, GY1, -T]], '#0B1424')
  h += poly([[GX1, GY0, 0], [GX1, GY1, 0], [GX1, GY1, -T], [GX1, GY0, -T]], '#08101D')
  h += poly([[GX0, GY0, 0], [GX1, GY0, 0], [GX1, GY1, 0], [GX0, GY1, 0]], '#122036', 'stroke="rgba(98,228,204,.18)" stroke-width="1"')
  h += poly([[GX0 + .3, 4.6, 0], [8.3, 4.6, 0], [8.3, GY1 - .3, 0], [GX0 + .3, GY1 - .3, 0]], '#10263A')
  h += poly([[GX0 + .3, GY0 + .3, 0], [8.3, GY0 + .3, 0], [8.3, -.6, 0], [GX0 + .3, -.6, 0]], '#10263A')
  h += poly([[8.7, -3.2, 0], [16.2, -3.2, 0], [16.2, 4.3, 0], [8.7, 4.3, 0]], '#18263D')
  for (let x = 9.7; x < 16.2; x += 1) h += `<path d="${dPath([[x, -3.2, 0], [x, 4.3, 0]])}" stroke="rgba(255,255,255,.035)" stroke-width="1"/>`
  h += poly([[5.8, 6, 0], [6.9, 6, 0], [6.9, GY1 - .3, 0], [5.8, GY1 - .3, 0]], '#1A2A42')

  const tree = (x: number, y: number, s = 1) => {
    const [bx, by] = P(x, y, 0), [tx, ty] = P(x, y, 2.6 * s)
    return `<ellipse cx="${bx}" cy="${by}" rx="${26 * s}" ry="${12 * s}" fill="#000" opacity=".3"/>
      <path d="M${bx},${by}L${tx},${ty + 20}" stroke="#2A2230" stroke-width="${5 * s}" stroke-linecap="round"/>
      <circle cx="${tx}" cy="${ty}" r="${34 * s}" fill="#0F3A3A"/><circle cx="${tx - 14 * s}" cy="${ty + 10 * s}" r="${24 * s}" fill="#0D3134"/>
      <circle cx="${tx + 12 * s}" cy="${ty - 12 * s}" r="${20 * s}" fill="#145049"/>
      <path d="M${tx - 26 * s},${ty - 18 * s}A${34 * s},${34 * s} 0 0 1 ${tx + 20 * s},${ty - 30 * s}" stroke="rgba(98,228,204,.35)" stroke-width="2" fill="none" stroke-linecap="round"/>`
  }
  h += tree(1.2, -2.2, 0.9)

  // grid pole
  const PX = 11.2, PY = -2.4
  {
    const b = P(PX, PY, 0), t = P(PX, PY, 7.4), tr = P(PX, PY - .05, 5.6)
    h += `<ellipse cx="${b[0]}" cy="${b[1]}" rx="12" ry="5" fill="#000" opacity=".35"/>`
    h += `<path d="M${b}L${t}" stroke="#3A3F52" stroke-width="7" stroke-linecap="round"/><path d="M${b[0] + 2},${b[1]}L${t[0] + 2},${t[1]}" stroke="#565D75" stroke-width="2"/>`
    h += `<path d="${dPath([[PX, PY - 1, 7], [PX, PY + 1, 7]])}" stroke="#3A3F52" stroke-width="5" stroke-linecap="round"/>`
    for (const o of [-0.8, 0, 0.8]) { const q = P(PX, PY + o, 7.15); h += `<circle cx="${q[0]}" cy="${q[1]}" r="3" fill="#8FA0B8"/>` }
    h += `<rect x="${tr[0] - 9}" y="${tr[1] - 14}" width="18" height="26" rx="5" fill="#2B3246" stroke="#454E66"/><circle data-k="poleLed" cx="${tr[0]}" cy="${tr[1] - 4}" r="2.4" fill="${MINT}"/>`
  }

  // house
  const X0 = -0.4, X1 = 8.4
  const R = (uu: number, v: number): V3 => [X0 + (X1 - X0) * uu, 3 + 3.5 * v, 7.4 - 2.6 * v]
  h += poly([[X0, 3, 7.4], [X1, 3, 7.4], [X1, -.5, 4.8], [X0, -.5, 4.8]], '#0B1322')
  h += poly([[X1, 3, 7.4], [X1, -.5, 4.8], [X1, -.5, 4.6], [X1, 3, 7.2]], '#1A2539')
  h += poly([[-.3, -.3, 0], [8.6, -.3, 0], [8.6, 6.6, 0], [-.3, 6.6, 0]], '#000', 'opacity=".28"')
  h += poly([[0, 6, 0], [8, 6, 0], [8, 6, 5], [0, 6, 5]], '#223454')
  h += poly([[8, 0, 0], [8, 6, 0], [8, 6, 5], [8, 3, 7.2], [8, 0, 5]], '#18263F')
  h += poly([[0, 6.01, 0], [8, 6.01, 0], [8, 6.01, .25], [0, 6.01, .25]], '#1A2944')
  h += poly([[8.01, 0, 0], [8.01, 6, 0], [8.01, 6, .25], [8.01, 0, .25]], '#132038')
  h += `<path d="${dPath([[8, 6, 0], [8, 6, 5]])}" stroke="rgba(255,255,255,.08)" stroke-width="1.5"/>`
  let glow = ''
  for (const [a, b, z0, z1] of [[1, 2.6, .9, 2.3], [3.3, 4.9, .9, 2.3], [1, 2.6, 2.9, 4.2], [3.3, 4.9, 2.9, 4.2], [5.7, 7.1, 2.9, 4.2]]) {
    h += poly([[a - .1, 6.02, z0 - .1], [b + .1, 6.02, z0 - .1], [b + .1, 6.02, z1 + .1], [a - .1, 6.02, z1 + .1]], '#31476A')
    h += poly([[a, 6.03, z0], [b, 6.03, z0], [b, 6.03, z1], [a, 6.03, z1]], G('glass'))
    glow += poly([[a, 6.04, z0], [b, 6.04, z0], [b, 6.04, z1], [a, 6.04, z1]], G('warm'))
    const m = (a + b) / 2
    h += `<path d="${dPath([[m, 6.04, z0], [m, 6.04, z1]])}" stroke="#31476A" stroke-width="2"/>`
    h += `<path d="${dPath([[a + .15, 6.04, z1 - .15], [a + .55, 6.04, z1 - .15], [a + .15, 6.04, z0 + .5]])}" stroke="rgba(255,255,255,.12)" stroke-width="1.2" fill="none"/>`
  }
  h += poly([[8.02, 2.4, 5.2], [8.02, 3.6, 5.2], [8.02, 3.6, 6.2], [8.02, 2.4, 6.2]], '#2B3F60')
  h += poly([[8.03, 2.5, 5.3], [8.03, 3.5, 5.3], [8.03, 3.5, 6.1], [8.03, 2.5, 6.1]], G('glass'))
  glow += poly([[8.04, 2.5, 5.3], [8.04, 3.5, 5.3], [8.04, 3.5, 6.1], [8.04, 2.5, 6.1]], G('warm'), 'opacity=".8"')
  h += poly([[5.8, 6.02, 0], [6.9, 6.02, 0], [6.9, 6.02, 2.3], [5.8, 6.02, 2.3]], '#0F1A2C')
  h += poly([[5.9, 6.03, .05], [6.8, 6.03, .05], [6.8, 6.03, 2.2], [5.9, 6.03, 2.2]], MINT, 'opacity=".9"')
  { const q = P(6.65, 6.04, 1.1); h += `<circle cx="${q[0]}" cy="${q[1]}" r="2" fill="#0B3B33"/>` }
  h += `<g data-k="glow" style="transition:opacity 1.2s;opacity:0">${glow}</g>`

  // wall kit: battery with the inverter on top (or the inverter / meter box alone)
  const BY0 = 3.3, BY1 = 4.45, BZ0 = .45, BZ1 = 2.35
  const HB = k.battery ? 2.45 : 1.55, HT = k.battery ? 3.3 : 2.4, MID = (HB + HT) / 2, HUBY = 3.87
  if (k.battery) {
    h += box(8, 8.28, BY0, BY1, BZ0, BZ1, '#F3F6F9', '#C2CCD8', '#E3E9EF')
    h += `<path d="${dPath([[8.29, HUBY, BZ0 + .2], [8.29, HUBY, BZ1 - .2]])}" stroke="rgba(10,20,40,.18)" stroke-width="4" stroke-linecap="round"/>`
    h += `<path data-k="batFill" d="" stroke="#2FD3B5" stroke-width="4" stroke-linecap="round"/><path data-k="batPulse" d="" stroke="#E8FFFA" stroke-width="4" stroke-linecap="round" opacity="0"/>`
  }
  h += box(8, 8.26, BY0 + .05, BY1 - .05, HB, HT, '#3A465E', '#2A3549', '#26324A')
  { const a = P(8.27, 3.6, MID), b = P(8.27, 4.15, MID); h += `<path d="M${a}L${b}" stroke="${MINT}" stroke-width="3" stroke-linecap="round" opacity=".85"/>` }
  if (k.ev) {
    h += box(8, 8.2, .5, 1.1, .8, 1.75, '#E9EEF3', '#B9C3CF', '#D9E0E8')
    const q = P(8.21, .8, 1.35); h += `<circle data-k="chgLed" cx="${q[0]}" cy="${q[1]}" r="3.4" fill="none" stroke="${MINT}" stroke-width="1.6"/>`
  }

  // roof + panels
  h += poly([[X0, 3, 7.4], [X1, 3, 7.4], [X1, 6.5, 4.8], [X0, 6.5, 4.8]], '#152034')
  for (let v = .12; v < 1; v += .12) h += `<path d="${dPath([R(0, v), R(1, v)])}" stroke="rgba(255,255,255,.035)" stroke-width="1"/>`
  h += poly([[X1, 3, 7.4], [X1, 6.5, 4.8], [X1, 6.5, 4.58], [X1, 3, 7.18]], '#26344D')
  h += poly([[X0, 6.5, 4.8], [X1, 6.5, 4.8], [X1, 6.5, 4.58], [X0, 6.5, 4.58]], '#1D2A41')
  h += `<path d="${dPath([[X0, 3, 7.42], [X1, 3, 7.42]])}" stroke="#2C3B57" stroke-width="3" stroke-linecap="round"/>`
  let uEnd = .93
  if (k.solar) {
    // two portrait rows, as many columns as the design's panel count suggests (the roof here is a stand-in, not their roof)
    const n = Math.max(4, Math.min(16, k.panels || Math.round((k.kwp || 4.8) / 0.44)))
    const cols = Math.ceil(n / 2), PW = .108, PG = .0035, PH = .394, PVG = .012
    const total = cols * PW + (cols - 1) * PG, u0s = (1 - total) / 2
    uEnd = u0s + total - .02
    let panels = '', cells = '', clip = ''
    for (let r = 0; r < 2; r++) for (let c = 0; c < cols; c++) {
      if (r === 0 && n % 2 === 1 && c === cols - 1) continue // odd count: top row one short
      const a = u0s + c * (PW + PG), b = a + PW, v0 = .07 + r * (PH + PVG), v1 = v0 + PH
      const lift = [R(a, v0), R(b, v0), R(b, v1), R(a, v1)].map((p) => [p[0], p[1], p[2] + .06] as V3)
      panels += poly(lift, G('panel'), 'stroke="#5B6F8C" stroke-width=".8"')
      clip += `<polygon points="${pp(lift)}"/>`
      for (let i = 1; i < 6; i++) { const uu = a + (b - a) * i / 6; cells += `M${P(...R(uu, v0))}L${P(...R(uu, v1))}` }
      for (let j = 1; j < 10; j++) { const v = v0 + (v1 - v0) * j / 10; cells += `M${P(...R(a, v))}L${P(...R(b, v))}` }
    }
    h += `<g transform="translate(0,-1.8)">${panels}<path d="${cells}" stroke="rgba(120,160,210,.16)" stroke-width=".6"/></g>`
    h += `<clipPath id="${id('cp')}">${clip}</clipPath>`
    h += `<g clip-path="${G('cp')}"><g transform="translate(0,-1.8)"><g data-k="shim"><rect x="-80" y="-400" width="80" height="900" fill="${G('shimg')}" transform="skewX(-28)"/></g></g></g>`
  }
  h += tree(.2, 8.9, 1.05)

  // car — Tesla Model 3-style fastback
  const CX0 = 10.9, CX1 = 15.45, CY0 = .6, CY1 = 2.5, GI = .24
  const CABLE: V3[] = [[8.2, .8, .8], [8.9, 1.5, .04], [10.2, 2.85, .04], [CX0 - .05, 2.85, .3], [CX0 + .3, CY1 + .02, .86]]
  if (k.ev) {
    h += `<ellipse cx="${P(13.2, 1.55)[0]}" cy="${P(13.2, 1.55)[1]}" rx="100" ry="40" fill="#000" opacity=".4" filter="${G('soft')}"/>`
    const BODY: [number, number][] = [[CX0, .5], [CX0 + .03, .82], [CX0 + .2, .95], [CX0 + .62, .98], [14.05, .96], [14.6, .9], [15.05, .8], [15.35, .66], [CX1, .5]]
    const GLASS: [number, number][] = [[CX0 + .62, .98], [12.15, 1.36], [12.75, 1.5], [13.3, 1.46], [14.05, .96]]
    const hex = (c: string, i: number) => parseInt(c.substr(i + 1, 2), 16)
    const shade = (a: number[], b: number[], lo: string, hi: string) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], n = Math.hypot(dx, dz)
      const t = Math.max(0, Math.min(1, .75 * (dx / n) + .25 * (-dz / n)))
      return '#' + [0, 2, 4].map((i) => Math.round(hex(lo, i) * (1 - t) + hex(hi, i) * t).toString(16).padStart(2, '0')).join('')
    }
    const strip = (a: number[], b: number[], y0: number, y1: number, fill: string, extra = '') => poly([[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], fill, extra)
    for (let i = 0; i < BODY.length - 1; i++) {
      const a = BODY[i], b = BODY[i + 1], inG = a[0] >= GLASS[0][0] && b[0] <= GLASS[GLASS.length - 1][0]
      h += strip(a, b, CY0, inG ? CY0 + GI : CY1, shade(a, b, '#AEB9C6', '#F2F5F8'))
    }
    for (let i = 0; i < GLASS.length - 1; i++) h += strip(GLASS[i], GLASS[i + 1], CY0 + GI, CY1 - GI, shade(GLASS[i], GLASS[i + 1], '#0A1220', '#243A58'), 'stroke="#0A1220" stroke-width=".4"')
    h += `<path d="${dPath([[12.2, CY0 + .5, 1.4], [13.1, CY0 + .5, 1.49]])}" stroke="rgba(160,220,255,.22)" stroke-width="3" stroke-linecap="round"/>`
    h += poly(GLASS.map(([x, z]) => [x, CY1 - GI, z] as V3), '#0C1628')
    const sg = CY1 - GI + .001
    h += poly([[CX0 + .95, sg, 1.03], [12.2, sg, 1.32], [12.75, sg, 1.44], [13.25, sg, 1.41], [13.8, sg, 1.03]], '#152640')
    h += `<path d="${dPath([[12.62, sg, 1.0], [12.62, sg, 1.45]])}" stroke="#0A1220" stroke-width="2.5"/>`
    for (let i = 2; i < 5; i++) h += strip(BODY[i], BODY[i + 1], CY1 - GI, CY1, shade(BODY[i], BODY[i + 1], '#B8C3CF', '#F4F7FA'))
    h += poly([[CX0 + .08, CY1, .3], [CX1 - .1, CY1, .3], ...BODY.slice().reverse().map(([x, z]) => [x, CY1, z] as V3)], '#D6DEE7')
    h += poly([[CX0 + .1, CY1 + .001, .3], [CX1 - .12, CY1 + .001, .3], [CX1 - .05, CY1 + .001, .48], [CX0 + .05, CY1 + .001, .48]], '#AEB9C6')
    h += `<path d="${dPath([[12.62, CY1 + .002, .35], [12.62, CY1 + .002, .96]])}" stroke="rgba(20,35,60,.2)" stroke-width="1"/>`
    for (const x of [12.05, 13.15]) h += `<path d="${dPath([[x, CY1 + .003, .86], [x + .28, CY1 + .003, .86]])}" stroke="rgba(20,35,60,.35)" stroke-width="1.6" stroke-linecap="round"/>`
    h += box(13.75, 13.95, CY1, CY1 + .16, .95, 1.05, '#E6EBF0', '#1A2335', '#C9D2DC')
    h += `<path d="${dPath([[15.28, CY0 + .18, .76], [15.3, CY0 + .55, .74]])}" stroke="#E6FBFF" stroke-width="2.2" stroke-linecap="round"/>`
    h += `<path d="${dPath([[15.28, CY1 - .18, .76], [15.3, CY1 - .55, .74]])}" stroke="#E6FBFF" stroke-width="2.2" stroke-linecap="round"/>`
    const ring = (xc: number, r: number, y: number) => { let d = ''; for (let i = 0; i <= 28; i++) { const t = i / 28 * Math.PI * 2; d += (i ? 'L' : 'M') + P(xc + r * Math.cos(t), y, .36 + r * Math.sin(t)).join(',') } return d + 'Z' }
    for (const xc of [11.75, 14.5]) {
      h += `<path d="${ring(xc, .44, CY1 + .003)}" fill="#1A2233"/><path d="${ring(xc, .36, CY1 + .02)}" fill="#07090F"/>`
      h += `<path d="${ring(xc, .25, CY1 + .03)}" fill="#3B4556"/><path d="${ring(xc, .19, CY1 + .035)}" fill="#1E2634" stroke="#8A97AB" stroke-width=".8"/>`
    }
    const q = P(CX0 + .3, CY1 + .02, .86)
    h += `<circle data-k="portGlow" cx="${q[0]}" cy="${q[1]}" r="10" fill="${G('glow')}"/><circle cx="${q[0]}" cy="${q[1]}" r="2.6" fill="${MINT}"/>`
    h += `<path d="${dPath(CABLE)}" stroke="#1B2336" stroke-width="3.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`
  }

  // flow routes, each drawn from the component to the hub (the inverter)
  const flows: Partial<Record<Flow, V3[]>> = {
    grid: [[PX, PY + .8, 7.1], [9.6, -1.0, 5.9], [8.02, .35, 4.7], [8.02, .35, HT + .35], [8.02, HUBY, HT + .35], [8.02, HUBY, HT]],
    home: [[7.3, 6.03, .3], [8.02, 6.03, .3], [8.02, 2.9, .3], [8.02, 2.9, MID - .2], [8.02, BY0 + .05, MID - .2]],
  }
  if (k.solar) { const s = R(uEnd, .9); flows.solar = [[s[0], s[1], s[2] + .1], [8.02, 6.03, 4.9], [8.02, 6.03, MID + .2], [8.02, BY1 - .05, MID + .2]] }
  if (k.battery) flows.battery = [[8.02, BY1, 1.4], [8.02, BY1 + .3, 1.4], [8.02, BY1 + .3, MID - .2], [8.02, BY1 - .05, MID - .2]]
  if (k.ev) flows.ev = [...CABLE.slice().reverse(), [8.02, .8, 1.75], [8.02, .8, MID + .2], [8.02, BY0 + .05, MID + .2]]
  let fl = ''
  for (const key of Object.keys(flows) as Flow[]) {
    const d = dPath(flows[key]!)
    fl += `<path data-rail="${key}" d="${d}" stroke="${MINT}" stroke-width="1.4" stroke-opacity=".2" fill="none" stroke-linejoin="round"/>`
    LAYERS.forEach(([dash, w, o], i) => {
      fl += `<path data-streak="${key}" d="${d}" stroke="${i === 2 ? '#D8FFF7' : MINT}" stroke-width="${w}" stroke-opacity="${o}" fill="none" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="${dash} ${PERIOD - dash}"/>`
    })
  }
  h += `<g>${fl}</g>`
  { const q = P(8.27, HUBY, MID); h += `<circle data-k="hubGlow" cx="${q[0]}" cy="${q[1]}" r="26" fill="${G('glow')}"/>` }
  { const q = P(7.3, 6.03, .3); h += `<circle cx="${q[0]}" cy="${q[1]}" r="14" fill="${G('glow')}"/><circle cx="${q[0]}" cy="${q[1]}" r="3" fill="${MINT}"/>` }

  // labels with leader lines
  const labels: { key: Flow; at: [number, number]; x: number; y: number; t: string }[] = [
    { key: 'grid', at: P(PX, PY, 7.6), x: 395, y: -150, t: 'GRID' },
    { key: 'home', at: P(3.9, 6.05, 3.3), x: -395, y: 270, t: 'HOME' },
  ]
  if (k.solar) labels.push({ key: 'solar', at: P(3.4, 4.6, 6.6), x: -395, y: -80, t: 'SOLAR' })
  if (k.battery) labels.push({ key: 'battery', at: P(8.29, HUBY, 1.2), x: -60, y: 405, t: (k.batteryName || 'Battery').toUpperCase() })
  if (k.ev) labels.push({ key: 'ev', at: P(13.3, CY1, 1.25), x: 395, y: 345, t: 'EV CHARGER' })
  for (const L of labels) {
    const [ax, ay] = L.at, right = L.x > 200, lx = right ? L.x - 150 : L.x + 150
    h += `<path d="M${ax},${ay}L${(ax + lx) / 2},${L.y - 8}L${lx},${L.y - 8}" stroke="rgba(98,228,204,.28)" stroke-width="1" fill="none" stroke-dasharray="2 3"/><circle cx="${ax}" cy="${ay}" r="3" fill="${MINT}"/>`
    h += `<g text-anchor="${right ? 'end' : 'start'}" font-family="inherit">
      <text x="${L.x}" y="${L.y - 30}" font-size="10.5" font-weight="700" letter-spacing="1.3" fill="#8C9BB0">${L.t}</text>
      <text x="${L.x}" y="${L.y - 2}" font-size="22" font-weight="800" fill="#EAF2F8"><tspan data-v="${L.key}">0.0</tspan><tspan data-u="${L.key}" dx="4" font-size="12" font-weight="600" fill="#8C9BB0">kW</tspan></text>
      <text data-s="${L.key}" x="${L.x}" y="${L.y + 18}" font-size="11.5" font-weight="600" fill="${MINT}"></text></g>`
  }

  const batLine = (from: number, to: number) => dPath([[8.29, HUBY, BZ0 + .2 + (BZ1 - BZ0 - .4) * from], [8.29, HUBY, BZ0 + .2 + (BZ1 - BZ0 - .4) * to]])
  const shimX0 = P(...R(0, 1))[0] - 160, shimX1 = P(...R(1, 0))[0] + 220
  return { svg: h, batLine, shimX0, shimX1, flowKeys: Object.keys(flows) as Flow[] }
}

// each flow = faint rail + three stacked dashed strokes of the same period, centred, which read as one soft streak
const PERIOD = 120
const LAYERS: [number, number, number][] = [[64, 7, .10], [42, 3.4, .32], [24, 1.7, .95]]

/* ---------- the component ---------- */
export function EnergyFlowScene({ kit, mode: controlled, showModes = true, live = false, caption, className = '' }: {
  kit: SceneKit
  mode?: SceneMode
  showModes?: boolean
  /** portal: follow the real clock instead of starting at midday */
  live?: boolean
  caption?: string
  className?: string
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const scene = useMemo(() => buildScene(kit, uid), [kit.solar, kit.battery, kit.ev, kit.kwp, kit.panels, kit.batteryName, uid]) // eslint-disable-line react-hooks/exhaustive-deps
  const modes = modesFor(kit)
  const clockMode = (): SceneMode => { const hr = new Date().getHours(); return hr >= 9 && hr < 17 && kit.solar ? 'day' : hr >= 17 && hr < 23 ? 'evening' : modes.includes('night') ? 'night' : 'evening' }
  const [mode, setMode] = useState<SceneMode>(controlled ?? (live ? clockMode() : 'day'))
  const [tour, setTour] = useState(false)
  useEffect(() => { if (controlled) setMode(controlled) }, [controlled])
  useEffect(() => { if (!modes.includes(mode)) setMode(modes[0]) }, [kit.battery, kit.ev]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!tour) return
    const t = setInterval(() => setMode((m) => modes[(modes.indexOf(m) + 1) % modes.length]), 7000)
    return () => clearInterval(t)
  }, [tour, modes.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const target = scenario(kit, mode)
  const svgRef = useRef<SVGSVGElement>(null)
  const targetRef = useRef(target)
  targetRef.current = target
  const modeRef = useRef(mode)
  modeRef.current = mode
  const socRef = useRef({ soc: target.soc, ev: target.evSoc })
  useEffect(() => { socRef.current = { soc: target.soc, ev: target.evSoc } }, [mode, kit.battery, kit.ev]) // eslint-disable-line react-hooks/exhaustive-deps

  // the animation loop — imperative on purpose (setAttribute per frame, no React renders)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.innerHTML = scene.svg
    const q = (s: string) => svg.querySelector(s) as SVGElement | null
    const F = scene.flowKeys.map((key) => ({ key, rail: q(`[data-rail="${key}"]`)!, layers: Array.from(svg.querySelectorAll(`[data-streak="${key}"]`)) as SVGElement[], phase: 0, vis: 0 }))
    const el = { sun: q('[data-k="sun"]'), stars: q('[data-k="stars"]'), glow: q('[data-k="glow"]'), shim: q('[data-k="shim"]'), batFill: q('[data-k="batFill"]'), batPulse: q('[data-k="batPulse"]'), port: q('[data-k="portGlow"]'), chg: q('[data-k="chgLed"]'), hub: q('[data-k="hubGlow"]'), pole: q('[data-k="poleLed"]') }
    const cur = { solar: 0, home: 0, batt: 0, ev: 0, grid: 0 }
    const jit = { solar: 0, home: 0 }
    const jt = setInterval(() => { const t = targetRef.current; jit.solar = t.solar > 0 ? (Math.random() - .5) * .16 * t.solar : 0; jit.home = (Math.random() - .5) * .12 }, 1100)
    let visible = true
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { threshold: 0 })
    io.observe(svg)
    let raf = 0, last = performance.now(), tAcc = 0, labelAcc = 1, lastMode = ''
    const fmt = (n: number) => Math.abs(n).toFixed(1)
    const setText = (sel: string, txt: string, fill?: string) => { const n = q(sel); if (!n) return; if (n.textContent !== txt) n.textContent = txt; if (fill) n.setAttribute('fill', fill) }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(.05, (now - last) / 1000); last = now
      if (!visible) return
      tAcc += dt; labelAcc += dt
      const t = targetRef.current, e = 1 - Math.exp(-dt * 3)
      const m = modeRef.current
      if (m !== lastMode) {
        lastMode = m
        if (el.sun) el.sun.style.opacity = m === 'day' || m === 'outage' ? '1' : m === 'evening' ? '.35' : '0'
        if (el.stars) el.stars.style.opacity = m === 'night' ? '1' : m === 'evening' ? '.45' : '0'
        if (el.glow) el.glow.style.opacity = m === 'night' ? '.55' : m === 'evening' ? '.95' : m === 'outage' ? '.25' : '.08'
      }
      const tg = { solar: Math.max(0, t.solar + jit.solar), home: Math.max(.2, t.home + jit.home), ev: t.ev, batt: 0, grid: 0 }
      tg.batt = t.gridUp ? t.batt : tg.solar - tg.home - tg.ev
      tg.grid = t.gridUp ? tg.home + tg.batt + tg.ev - tg.solar : 0
      ;(Object.keys(tg) as (keyof typeof cur)[]).forEach((k) => { cur[k] += (tg[k] - cur[k]) * e })
      const s = socRef.current
      s.soc = Math.max(5, Math.min(100, s.soc + cur.batt * dt * .06))
      s.ev = Math.max(5, Math.min(100, s.ev + cur.ev * dt * .03))

      const supply: Record<Flow, number> = { solar: cur.solar, grid: cur.grid, battery: -cur.batt, ev: -cur.ev, home: -cur.home }
      for (const f of F) {
        const kw = supply[f.key], mag = Math.abs(kw), dead = f.key === 'grid' && !t.gridUp
        f.rail.setAttribute('stroke', dead ? '#FF6B6B' : MINT)
        f.rail.setAttribute('stroke-opacity', dead ? '.4' : (.12 + .16 * Math.min(1, mag)).toFixed(2))
        f.rail.setAttribute('stroke-dasharray', dead ? '4 5' : 'none')
        const v = Math.sign(kw) * (14 + 3.8 * Math.min(mag, 7)) * Math.min(1, mag / .3)
        f.phase = (f.phase - v * dt + PERIOD * 1000) % PERIOD
        f.vis += ((dead || mag < .05 ? 0 : Math.min(1, .35 + mag / 2.5)) - f.vis) * e
        f.layers.forEach((l, i) => { l.setAttribute('stroke-dashoffset', (f.phase - (LAYERS[0][0] - LAYERS[i][0]) / 2).toFixed(2)); l.style.opacity = f.vis.toFixed(3) })
      }
      if (el.shim) {
        const sp = (tAcc % 3.4) / 3.4
        el.shim.setAttribute('transform', `translate(${(scene.shimX0 + (scene.shimX1 - scene.shimX0) * sp).toFixed(1)},0)`)
        el.shim.style.opacity = Math.min(1, cur.solar / 3.5).toFixed(2)
      }
      if (el.batFill && el.batPulse) {
        const lvl = s.soc / 100
        el.batFill.setAttribute('d', scene.batLine(0, lvl))
        if (Math.abs(cur.batt) > .15) {
          const ph = (tAcc % 1.6) / 1.6, p = cur.batt > 0 ? ph * lvl : lvl * (1 - ph)
          el.batPulse.setAttribute('d', scene.batLine(Math.max(0, p - .08), Math.min(lvl, p + .02)))
          el.batPulse.setAttribute('opacity', (Math.sin(ph * Math.PI) * .9).toFixed(2))
        } else el.batPulse.setAttribute('opacity', '0')
      }
      const breathe = .5 + .5 * Math.sin(tAcc * 3.2), chg = cur.ev > .15
      el.port?.setAttribute('opacity', chg ? (.35 + .65 * breathe).toFixed(2) : '.15')
      el.chg?.setAttribute('stroke-opacity', chg ? (.4 + .6 * breathe).toFixed(2) : '.3')
      el.hub?.setAttribute('opacity', (.55 + .45 * Math.sin(tAcc * 2)).toFixed(2))
      el.pole?.setAttribute('fill', t.gridUp ? MINT : Math.sin(tAcc * 6) > 0 ? '#FF6B6B' : '#5A2530')

      if (labelAcc > .25) {
        labelAcc = 0
        const idle = '#5A6A80', warn = '#FFC56E'
        setText('[data-v="solar"]', fmt(cur.solar)); setText('[data-s="solar"]', cur.solar > .1 ? 'Generating' : 'Resting until sunrise', cur.solar > .1 ? MINT : idle)
        setText('[data-v="home"]', fmt(cur.home))
        setText('[data-s="home"]', !t.gridUp ? 'Backed up — lights on' : cur.solar >= cur.home ? 'Powered by the sun' : cur.batt < -.1 ? 'Powered by your battery' : 'From the grid', MINT)
        setText('[data-v="battery"]', fmt(cur.batt)); setText('[data-u="battery"]', `kW · ${Math.round(s.soc)}%`)
        setText('[data-s="battery"]', cur.batt > .1 ? 'Charging' : cur.batt < -.1 ? 'Powering home' : 'Standby', Math.abs(cur.batt) > .1 ? MINT : idle)
        setText('[data-v="ev"]', fmt(cur.ev)); setText('[data-u="ev"]', `kW · ${Math.round(s.ev)}%`)
        setText('[data-s="ev"]', cur.ev > .1 ? (cur.solar > cur.ev ? 'Charging on solar' : 'Charging · cheap rate') : !t.gridUp ? 'Paused during power cut' : 'Plugged in · scheduled', cur.ev > .1 ? MINT : !t.gridUp ? warn : idle)
        if (!t.gridUp) { setText('[data-v="grid"]', '—'); setText('[data-u="grid"]', ''); setText('[data-s="grid"]', 'Grid offline', warn) }
        else { setText('[data-v="grid"]', fmt(cur.grid)); setText('[data-u="grid"]', 'kW'); setText('[data-s="grid"]', cur.grid < -.08 ? 'Exporting · earning' : cur.grid > .08 ? 'Importing' : 'Idle', Math.abs(cur.grid) > .08 ? MINT : idle) }
      }
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); clearInterval(jt); io.disconnect() }
  }, [scene])

  const skyBg = mode === 'evening' ? 'radial-gradient(120% 90% at 85% 0%,#3B2748 0%,#171A33 45%,#080B18 100%)'
    : mode === 'night' ? 'radial-gradient(120% 90% at 50% 0%,#101C38 0%,#0A1122 50%,#05080F 100%)'
    : 'radial-gradient(120% 90% at 20% 0%,#1A3050 0%,#0C1628 45%,#070D19 100%)'

  return (
    <div>
    <div className={`relative overflow-hidden rounded-[22px] border border-white/5 text-white ${className}`} style={{ background: skyBg, transition: 'background 1.2s', fontFamily: 'Manrope, Inter, system-ui, sans-serif' }}>
      <div className="absolute left-5 right-5 top-5 z-[2] flex items-start justify-between gap-3 pointer-events-none">
        <div>
          <div className="text-[clamp(17px,2.2vw,26px)] font-extrabold leading-tight tracking-[-0.02em] max-w-[520px]">{target.h1}</div>
          <p className="mt-1.5 text-[12.5px] leading-snug max-w-[460px] hidden sm:block" style={{ color: '#8C9BB0' }}>{target.hp}</p>
        </div>
        <div className="text-right whitespace-nowrap text-[12px]" style={{ color: '#8C9BB0' }}>
          {live
            ? <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: target.gridUp ? MINT : '#FFC56E' }}><span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> Live</span>
            : <><b className="block text-[20px] text-white font-bold">{target.clock}</b>{target.weather}</>}
        </div>
      </div>
      <svg ref={svgRef} viewBox="-420 -300 1000 800" preserveAspectRatio="xMidYMid meet" className="block w-full h-auto" aria-label="How energy flows around your home" />
      {showModes && modes.length > 1 && (
        <div className="absolute left-1/2 bottom-4 -translate-x-1/2 z-[2] flex gap-1 p-1 rounded-full border border-white/10 max-w-[calc(100%-24px)] overflow-x-auto" style={{ background: 'rgba(8,14,26,.72)', backdropFilter: 'blur(10px)' }}>
          {modes.map((m) => (
            <button key={m} onClick={() => { setTour(false); setMode(m) }} className="px-3.5 py-2 rounded-full text-[12.5px] font-semibold whitespace-nowrap transition-colors" style={mode === m ? { background: MINT, color: '#06231E' } : { color: '#8C9BB0' }}>{MODE_LABEL[m]}</button>
          ))}
          <button onClick={() => { if (!tour) setMode((m) => modes[(modes.indexOf(m) + 1) % modes.length]); setTour((t) => !t) }} className="px-3.5 py-2 rounded-full text-[12.5px] font-semibold whitespace-nowrap" style={{ color: MINT, background: tour ? 'rgba(98,228,204,.16)' : undefined }}>{tour ? '❚❚ Pause' : '▶ Play the day'}</button>
        </div>
      )}
    </div>
    {caption && <p className="mt-2 text-[11.5px] leading-snug" style={{ color: "#7A8494" }}>{caption}</p>}
    </div>
  )
}
