/* Ovi's design brain (deterministic, in-app — matches the app's simulated-AI pattern).
 * Turns a plain-English brief ("design this for 100% offset of a 12,000 kWh bill, south roof only,
 * all-black panels, leave the chimney") into a concrete layout instruction the studio can execute. */
import { MODULES, type LayoutGoal } from './panels'
import type { Design, DesignPlane } from '../store/types'

export type DesignIntent = {
  goal: LayoutGoal
  goalLabel: string
  moduleId?: string
  moduleLabel?: string
  restrict?: (p: DesignPlane) => boolean
  restrictLabel?: string
  bestOnly?: boolean // lay out only the single best-quality plane
  billKwh?: number // annual consumption, if the brief mentioned one (for offset reporting)
  notes: string[]
}

const num = (s: string, re: RegExp): number | undefined => {
  const m = s.match(re)
  if (!m) return undefined
  const v = parseFloat(m[1].replace(/[, ]/g, ''))
  return isFinite(v) ? v : undefined
}
const facing = (az: number) => ((az % 360) + 360) % 360

/** Parse a brief against a design. `yieldPerKwp` (regional kWh/kWp) lets offset briefs size in kWh. */
export function parseDesignBrief(raw: string, _design: Design, yieldPerKwp: number): DesignIntent {
  const t = ` ${raw.toLowerCase()} `
  const notes: string[] = []

  // ── Module ──
  let moduleId: string | undefined, moduleLabel: string | undefined
  const pick = (id: string) => { const m = MODULES.find((x) => x.id === id); if (m) { moduleId = m.id; moduleLabel = `${m.brand} ${m.watts} W` } }
  if (/all[-\s]?black/.test(t)) pick('m405')
  else if (/\bmaxeon\b|premium|best panel|highest efficiency|top[-\s]?tier/.test(t)) pick('m430b')
  else if (/\bbifacial\b/.test(t)) pick('m550')
  else {
    for (const m of MODULES) {
      if (t.includes(m.brand.toLowerCase()) || t.includes(m.name.toLowerCase()) || new RegExp(`\\b${m.watts}\\s*w`).test(t)) { pick(m.id); break }
    }
  }

  // ── Restrict which roofs ──
  let restrict: DesignIntent['restrict'], restrictLabel: string | undefined, bestOnly = false
  if (/\b(best|main|primary|single|one)\s+roof\b/.test(t)) {
    bestOnly = true; restrictLabel = 'the best roof only'
  } else if (/only|just|south[-\s]?facing/.test(t) && /south/.test(t)) {
    restrict = (p) => { const a = facing(p.azimuthDeg); return a >= 135 && a <= 225 }
    restrictLabel = 'south-facing planes only'
  } else if (/(skip|avoid|not|no)\s+north/.test(t)) {
    restrict = (p) => { const a = facing(p.azimuthDeg); return !(a < 45 || a > 315) }
    restrictLabel = 'excluding north-facing planes'
  }

  if (/chimney|skylight|obstacle|vent|dormer|keep[-\s]?out|leave|avoid the/.test(t))
    notes.push('Noted the keep-outs — obstacle-aware packing refines this in a later pass.')
  if (/shad(e|ing|ow)/.test(t)) notes.push('Shading losses are estimated by orientation for now; the shading tab lands next.')

  // ── Goal ──
  let goal: LayoutGoal = { kind: 'max' }
  let goalLabel = 'maximum coverage'
  let billKwh: number | undefined

  const kwh = num(t, /([\d,]+(?:\.\d+)?)\s*k\s*wh/) ?? num(t, /([\d,]+(?:\.\d+)?)\s*kwh/)
  const kwp = num(t, /([\d,]+(?:\.\d+)?)\s*k\s*wp/) ?? num(t, /([\d,]+(?:\.\d+)?)\s*kw\b/)
  const pct = num(t, /([\d,]+(?:\.\d+)?)\s*%/) ?? num(t, /([\d,]+(?:\.\d+)?)\s*percent/)
  const offsetIntent = /offset|bill|usage|consumption|cover|net[-\s]?zero|match (their|the)/.test(t)

  if (offsetIntent && kwh) {
    billKwh = kwh
    const share = pct != null ? pct / 100 : (/net[-\s]?zero|100/.test(t) ? 1 : 1)
    const target = Math.round(kwh * share)
    goal = { kind: 'target-kwh', kwh: target, yieldPerKwp }
    goalLabel = `${Math.round(share * 100)}% offset of ${kwh.toLocaleString()} kWh (${target.toLocaleString()} kWh/yr)`
  } else if (kwp) {
    goal = { kind: 'target-kwp', kwp }
    goalLabel = `${kwp} kWp`
  } else if (kwh && !offsetIntent) {
    goal = { kind: 'target-kwh', kwh, yieldPerKwp }
    goalLabel = `${kwh.toLocaleString()} kWh/yr`
  } else if (/\bmax(imum|imise|imize)?\b|as many|fill|cram|biggest|whole roof|every/.test(t)) {
    goal = { kind: 'max' }; goalLabel = 'maximum coverage'
  }

  return { goal, goalLabel, moduleId, moduleLabel, restrict, restrictLabel, bestOnly, billKwh, notes }
}

/** Example prompts shown as chips. */
export const OVI_DESIGN_PROMPTS = [
  'Design for 100% offset of a 12,000 kWh bill',
  'Fill every roof for maximum coverage',
  'Size a 10 kWp system on the best roof',
  'South-facing roofs only, all-black panels',
]
