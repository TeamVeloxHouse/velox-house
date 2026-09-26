/* Smart-meter half-hourly usage → the 12 × 48 "average day per month" profile the simulation runs on.
 *
 * Two routes in:
 *   1. CSV (free, live now): most suppliers let the customer download half-hourly consumption — Octopus
 *      ("Consumption (kWh), Start, End"), OVO, EDF, British Gas, Glow/Bright, n3rgy's own export… We accept any CSV
 *      with a timestamp column and a kWh column, in any order, 30-minute or hourly rows.
 *   2. n3rgy (wired, OFF): consent-based access to any smart meter via the DCC, by MPAN + in-home-display ID.
 *      /api/smart-meter/n3rgy answers { configured:false } until an N3RGY_API_KEY is set — no cost until then.
 * Months the file doesn't cover are filled from the covered months' shape, scaled by the UK seasonal swing, and the
 * import says how many days it's based on. */

const LOAD_MONTH = [1.25, 1.2, 1.1, 0.95, 0.85, 0.78, 0.75, 0.78, 0.9, 1.05, 1.18, 1.28]

function splitCsvLine(line: string): string[] {
  const out: string[] = []; let cur = '', q = false
  for (const ch of line) {
    if (ch === '"') q = !q
    else if (ch === ',' && !q) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}
function parseDate(s: string): Date | null {
  const t = s.trim().replace(/^"|"$/g, '')
  if (!t) return null
  const iso = new Date(t)
  if (!isNaN(iso.getTime()) && /\d{4}-\d{2}-\d{2}/.test(t)) return iso
  const uk = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T]?(\d{1,2})?:?(\d{2})?/) // 31/01/2026 00:30
  if (uk) return new Date(+uk[3], +uk[2] - 1, +uk[1], +(uk[4] ?? 0), +(uk[5] ?? 0))
  return isNaN(iso.getTime()) ? null : iso
}

export type SmartMeterImport = { profile: number[][]; annualKwh: number; days: number; from: string; to: string; rows: number; monthsCovered: number }

export function parseSmartMeterCsv(text: string): SmartMeterImport {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 10) throw new Error('That file has too few rows to be half-hourly data')
  const head = splitCsvLine(lines[0]).map((h) => h.toLowerCase())
  const hasHeader = head.some((h) => /[a-z]/.test(h))
  let kCol = head.findIndex((h) => /kwh|consumption|usage|value|reading/.test(h))
  let tCol = head.findIndex((h) => /start|time|date|interval|from/.test(h))
  const body = hasHeader ? lines.slice(1) : lines
  if (!hasHeader || kCol < 0 || tCol < 0) { // guess: first parseable date column, first numeric column
    const s = splitCsvLine(body[0])
    tCol = s.findIndex((c) => parseDate(c)); kCol = s.findIndex((c, i) => i !== tCol && /^-?\d+(\.\d+)?$/.test(c))
  }
  if (kCol < 0 || tCol < 0) throw new Error('Couldn’t find a date/time column and a kWh column')
  const sum = Array.from({ length: 12 }, () => new Array(48).fill(0))
  const dayKeys = Array.from({ length: 12 }, () => new Set<string>())
  let total = 0, rows = 0, first: Date | null = null, last: Date | null = null
  for (const l of body) {
    const c = splitCsvLine(l); const t = parseDate(c[tCol] ?? ''); const kwh = parseFloat(c[kCol] ?? '')
    if (!t || !isFinite(kwh) || kwh < 0 || kwh > 20) continue
    const m = t.getMonth(), slot = t.getHours() * 2 + (t.getMinutes() >= 30 ? 1 : 0)
    sum[m][slot] += kwh; dayKeys[m].add(t.toDateString()); total += kwh; rows++
    if (!first || t < first) first = t; if (!last || t > last) last = t
  }
  if (rows < 48) throw new Error('Not enough readings in that file')
  const hourly = rows > 0 && sum.every((mo) => mo.every((v, s) => s % 2 === 0 || v === 0)) // hourly files only fill even slots
  const covered = sum.map((mo, m) => (dayKeys[m].size ? mo.map((v) => v / dayKeys[m].size) : null))
  if (hourly) covered.forEach((mo) => mo && mo.forEach((v, s) => { if (s % 2 === 0) { mo[s] = v / 2; mo[s + 1] = v / 2 } }))
  const coveredIdx = covered.map((c, m) => (c ? m : -1)).filter((m) => m >= 0)
  const days = dayKeys.reduce((s, k) => s + k.size, 0)
  // fill missing months from the average covered day, scaled by the seasonal swing
  const avgShape = new Array(48).fill(0)
  for (const m of coveredIdx) covered[m]!.forEach((v, s) => (avgShape[s] += v / LOAD_MONTH[m] / coveredIdx.length))
  const profile = covered.map((c, m) => c ?? avgShape.map((v) => v * LOAD_MONTH[m]))
  const annualKwh = Math.round(profile.reduce((s, mo, m) => s + mo.reduce((a, b) => a + b, 0) * [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m], 0))
  return { profile: profile.map((mo) => mo.map((v) => Math.round(v * 1000) / 1000)), annualKwh, days, from: first!.toISOString().slice(0, 10), to: last!.toISOString().slice(0, 10), rows, monthsCovered: coveredIdx.length }
}

/** n3rgy consent route — returns { configured:false } until the server has a key. */
export async function n3rgyStatus(): Promise<{ configured: boolean; reason?: string }> {
  try { const r = await fetch('/api/smart-meter/n3rgy'); return await r.json() } catch { return { configured: false, reason: 'offline' } }
}
