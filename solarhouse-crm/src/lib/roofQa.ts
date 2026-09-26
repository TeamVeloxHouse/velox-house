/**
 * Roof QA — how good is a roof detection, measured, not eyeballed.
 *
 * For one house it runs the real detector and scores the result on:
 *   shape      corners per pane, panes breaking the shape rules (stray corners, tiny edges, skew, slivers)
 *   topology   pane-on-pane overlap, and gaps (outline not covered by any pane)
 *   agreement  an INDEPENDENT second opinion: Google's own roof segments (buildingInsights) — does every big Google
 *              segment have a pane of ours facing the same way at the same pitch, and vice versa?
 * and, for designs a person has since corrected, how far the final panes moved from what was detected (the
 * correction log — the ground truth that tunes the detector, and later trains it).
 */
import { detectRoofPanes } from './roofPanes'
import { metricFrame, paneQuality, type XY } from './paneShape'
import type { LatLng } from './solar'
import type { DesignPlane } from '../store/types'

export type GoogleSegment = { pitchDeg: number; azimuthDeg: number; areaM2: number; groundAreaM2: number; center: LatLng | null }
export type QaFlag = { level: 'bad' | 'warn'; text: string }
export type RoofAudit = {
  center: LatLng; ms: number; message: string; planes: DesignPlane[]; outline: LatLng[]; google: GoogleSegment[]
  panes: number; cornersAvg: number; cornersMax: number; messyPanes: number
  overlapM2: number; gapPct: number; coveragePct: number
  googleMatched: number; googleBig: number; pitchErr: number | null; azErr: number | null; oursUnmatched: number
  score: number; flags: QaFlag[]
}

const inRing = (p: XY, r: XY[]) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c } return c }
const angDiff = (a: number, b: number) => { const d = Math.abs((((a - b) % 360) + 540) % 360 - 180); return d }

export async function fetchGoogleSegments(c: LatLng): Promise<GoogleSegment[]> {
  try { const r = await fetch(`/api/roof-segments?lat=${c.lat}&lng=${c.lng}`); return r.ok ? await r.json() : [] } catch { return [] }
}

/** Score an existing set of panes (detected or hand-corrected) for one house. */
export function scorePanes(center: LatLng, planes: DesignPlane[], outline: LatLng[], google: GoogleSegment[]): Omit<RoofAudit, 'center' | 'ms' | 'message' | 'planes' | 'outline' | 'google'> {
  const f = metricFrame(center)
  const rings = planes.map((p) => p.polygon.map(f.toXY))
  const out = outline.length >= 3 ? outline.map(f.toXY) : []
  const flags: QaFlag[] = []
  // shape
  const qs = planes.map((p, i) => paneQuality(p.polygon, p.pitchDeg >= 6 ? p.azimuthDeg : undefined, planes.filter((_, j) => j !== i).map((q) => q.polygon)))
  const corners = planes.map((p) => p.polygon.length)
  const messyPanes = qs.filter((q) => q.issues.some((i) => i !== 'overlap')).length
  // topology — sample a 20 cm grid over everything
  const all = [...rings.flat(), ...out]
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const p of all) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y) }
  let overlap = 0, inOut = 0, gap = 0, covered = 0; const g = 0.2
  if (isFinite(x0)) for (let x = x0 + g / 2; x < x1; x += g) for (let y = y0 + g / 2; y < y1; y += g) {
    const p = { x, y }
    let k = 0; for (const r of rings) if (inRing(p, r)) k++
    if (k > 1) overlap += g * g
    if (out.length && inRing(p, out)) { inOut++; if (k === 0) gap++; else covered++ }
  }
  const gapPct = inOut ? (gap / inOut) * 100 : 0, coveragePct = inOut ? (covered / inOut) * 100 : 0
  // agreement with Google's own segments (only segments ≥ 5 m² count as "big")
  const big = google.filter((s) => s.groundAreaM2 >= 5 && s.center)
  let matched = 0; const pe: number[] = [], ae: number[] = []
  const usedOurs = new Set<number>()
  for (const s of big) {
    const c = f.toXY(s.center!)
    let best = -1, bs = Infinity
    planes.forEach((p, i) => {
      const flatBoth = p.pitchDeg < 6 && s.pitchDeg < 6
      const az = flatBoth ? 0 : angDiff(p.azimuthDeg, s.azimuthDeg)
      if (az > 35) return
      const r = rings[i]
      const d = inRing(c, r) ? 0 : Math.min(...r.map((q) => Math.hypot(q.x - c.x, q.y - c.y)))
      const sc = d + az / 10
      if (d < 3 && sc < bs) { bs = sc; best = i }
    })
    if (best >= 0) {
      matched++; usedOurs.add(best)
      pe.push(Math.abs(planes[best].pitchDeg - s.pitchDeg))
      if (!(planes[best].pitchDeg < 6 && s.pitchDeg < 6)) ae.push(angDiff(planes[best].azimuthDeg, s.azimuthDeg))
    }
  }
  const oursUnmatched = planes.filter((p, i) => !usedOurs.has(i) && p.areaM2 >= 8).length
  const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null)
  const pitchErr = mean(pe), azErr = mean(ae)
  // flags
  if (!planes.length) flags.push({ level: 'bad', text: 'No panes detected' })
  if (messyPanes) flags.push({ level: 'warn', text: `${messyPanes} pane${messyPanes === 1 ? '' : 's'} break the shape rules` })
  if (Math.max(0, ...corners) > 8) flags.push({ level: 'warn', text: `A pane has ${Math.max(...corners)} corners` })
  if (overlap > 0.5) flags.push({ level: overlap > 2 ? 'bad' : 'warn', text: `${overlap.toFixed(1)} m² of panes overlap` })
  if (gapPct > 12) flags.push({ level: gapPct > 25 ? 'bad' : 'warn', text: `${Math.round(gapPct)}% of the outline has no pane` })
  if (big.length && matched < big.length) flags.push({ level: matched / big.length < 0.6 ? 'bad' : 'warn', text: `${big.length - matched} of Google's ${big.length} roof segments have no matching pane` })
  if (pitchErr != null && pitchErr > 6) flags.push({ level: pitchErr > 10 ? 'bad' : 'warn', text: `Pitch differs from Google by ${pitchErr.toFixed(0)}° on average` })
  if (azErr != null && azErr > 12) flags.push({ level: 'warn', text: `Facing differs from Google by ${azErr.toFixed(0)}° on average` })
  if (oursUnmatched) flags.push({ level: 'warn', text: `${oursUnmatched} pane${oursUnmatched === 1 ? '' : 's'} Google doesn't see` })
  // score: start at 100, subtract per problem (capped), so it's comparable house to house and version to version
  let score = 100
  score -= Math.min(20, messyPanes * 5)
  score -= Math.min(20, overlap * 4)
  score -= Math.min(20, Math.max(0, gapPct - 8))
  if (big.length) score -= Math.min(25, ((big.length - matched) / big.length) * 40)
  if (pitchErr != null) score -= Math.min(10, Math.max(0, pitchErr - 3))
  if (azErr != null) score -= Math.min(10, Math.max(0, (azErr - 5) / 2))
  score -= Math.min(10, oursUnmatched * 3)
  if (!planes.length) score = 0
  return {
    panes: planes.length, cornersAvg: corners.length ? corners.reduce((a, b) => a + b, 0) / corners.length : 0, cornersMax: Math.max(0, ...corners), messyPanes,
    overlapM2: overlap, gapPct, coveragePct, googleMatched: matched, googleBig: big.length, pitchErr, azErr, oursUnmatched,
    score: Math.max(0, Math.round(score)), flags,
  }
}

/** Run the live detector on one house and audit it. */
export async function auditRoof(center: LatLng): Promise<RoofAudit> {
  const t0 = performance.now()
  const [res, google] = await Promise.all([detectRoofPanes(center, 'gable').catch(() => null), fetchGoogleSegments(center)])
  const planes = res?.planes ?? [], outline = res?.model.outline ?? []
  return { center, ms: Math.round(performance.now() - t0), message: res?.message ?? 'No building found under the pin', planes, outline, google, ...scorePanes(center, planes, outline, google) }
}

/** How far a person moved the panes after detection: mean corner shift, panes added/removed, pitch changes. */
export function correctionDelta(detected: DesignPlane[], final: DesignPlane[], center: LatLng) {
  const f = metricFrame(center)
  const cen = (p: DesignPlane) => { const r = p.polygon.map(f.toXY); return { x: r.reduce((s, q) => s + q.x, 0) / r.length, y: r.reduce((s, q) => s + q.y, 0) / r.length } }
  let shifts: number[] = [], pitchCh = 0, matched = 0
  for (const d of detected) {
    const c = cen(d)
    const m = final.map((q) => ({ q, d: Math.hypot(cen(q).x - c.x, cen(q).y - c.y) })).sort((a, b) => a.d - b.d)[0]
    if (!m || m.d > 3) continue
    matched++
    if (m.q.pitchDeg !== d.pitchDeg) pitchCh++
    const fr = m.q.polygon.map(f.toXY)
    for (const v of d.polygon.map(f.toXY)) shifts.push(Math.min(...fr.map((w) => Math.hypot(w.x - v.x, w.y - v.y))))
  }
  shifts = shifts.sort((a, b) => a - b)
  return {
    removed: detected.length - matched, added: Math.max(0, final.length - matched), pitchChanged: pitchCh,
    medianCornerShiftM: shifts.length ? shifts[Math.floor(shifts.length / 2)] : 0, maxCornerShiftM: shifts.length ? shifts[shifts.length - 1] : 0,
  }
}
