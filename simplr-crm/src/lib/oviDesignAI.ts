/* Ovi's REAL design brain — Claude reads the roof faces + the user's brief and returns a structured
 * layout via a tool call. Falls back to the deterministic parser (oviDesign.ts) when there's no key
 * or the call fails, so the studio always works. Runs one Messages-API turn via /api/ovi. */
import { MODULES } from './panels'
import { compass } from './design'
import type { DesignIntent } from './oviDesign'
import type { Design } from '../store/types'

const TOOL = {
  name: 'design_solar_array',
  description: 'Lay out the solar PV array on the roof to satisfy the user\'s request.',
  input_schema: {
    type: 'object',
    properties: {
      goal: { type: 'string', enum: ['max_coverage', 'target_kwp', 'target_kwh_offset'], description: 'max_coverage = fill the chosen faces; target_kwp = hit a system size; target_kwh_offset = size to offset a yearly bill.' },
      target_kwp: { type: 'number', description: 'system size in kWp (only when goal = target_kwp).' },
      bill_annual_kwh: { type: 'number', description: 'the customer\'s yearly electricity use in kWh (only when goal = target_kwh_offset, or if they mention a bill).' },
      offset_percent: { type: 'number', description: 'percent of that bill to offset (default 100).' },
      plane_indices: { type: 'array', items: { type: 'number' }, description: 'which roof faces to use, by their [index]. Omit or leave empty to use ALL suitable faces (e.g. for "fill the whole building").' },
      module_id: { type: 'string', description: 'a module id to switch to (only if the user asks for a specific panel); otherwise omit.' },
      message: { type: 'string', description: 'one short, friendly sentence to show the user explaining what you did.' },
    },
    required: ['goal', 'message'],
  },
}

/** Ask Claude to turn a brief into a concrete DesignIntent. Returns null to signal "use the fallback". */
export async function designIntentFromClaude(brief: string, design: Design, yieldPerKwp: number, currentModuleId: string): Promise<(DesignIntent & { aiMessage?: string }) | null> {
  try {
    if (!design.planes.length) return null
    const faces = design.planes.map((p, i) => `[${i}] ${compass(p.azimuthDeg)}-facing, ${p.pitchDeg}° pitch, ${p.areaM2} m²${p.panels?.length ? `, ${p.panels.length} panels currently` : ''}`).join('\n')
    const mods = MODULES.map((m) => `${m.id} = ${m.brand} ${m.watts} W`).join('; ')
    const curMod = MODULES.find((m) => m.id === currentModuleId)
    const system = `You are Ovi, an expert UK MCS solar designer laying out a PV array on a specific roof. Regional yield ≈ ${yieldPerKwp} kWh per kWp per year. Current module: ${curMod ? `${curMod.brand} ${curMod.watts} W` : currentModuleId}. Available modules: ${mods}.

The roof has these faces (0-based index):
${faces}

Call design_solar_array to lay out the array for the user's request. Rules:
- "fill the whole building / all the roofs / every face / maximum" → goal max_coverage and OMIT plane_indices (use every face, including north).
- If they name faces or say "south only / best roof / not the north", pick the matching plane_indices.
- Prefer south/east/west faces for a target size or bill offset; only add north-facing faces to reach the target or when asked.
- For a bill/usage figure, use goal target_kwh_offset with bill_annual_kwh (and offset_percent if given).
- Only set module_id if the user asks for a specific panel.
Keep message to one short sentence.`

    const res = await fetch('/api/ovi', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ system, messages: [{ role: 'user', content: brief }], tools: [TOOL] }),
    })
    const data = await res.json()
    if (!data || data.fallback || data.error || !Array.isArray(data.content)) return null
    const call = data.content.find((b: { type: string }) => b.type === 'tool_use') as { input?: Record<string, unknown> } | undefined
    const a = call?.input
    if (!a) return null

    // ── Map the tool call → a DesignIntent the studio already knows how to execute ──
    let goal: DesignIntent['goal'] = { kind: 'max' }, goalLabel = 'maximum coverage', billKwh: number | undefined
    if (a.goal === 'target_kwp' && Number(a.target_kwp) > 0) { goal = { kind: 'target-kwp', kwp: Number(a.target_kwp) }; goalLabel = `${a.target_kwp} kWp` }
    else if (a.goal === 'target_kwh_offset' && Number(a.bill_annual_kwh) > 0) {
      billKwh = Number(a.bill_annual_kwh)
      const share = Number(a.offset_percent) > 0 ? Number(a.offset_percent) / 100 : 1
      const kwh = Math.round(billKwh * share)
      goal = { kind: 'target-kwh', kwh, yieldPerKwp }
      goalLabel = `${Math.round(share * 100)}% offset of ${billKwh.toLocaleString()} kWh`
    }
    let restrict: DesignIntent['restrict'], restrictLabel: string | undefined
    const idxs = Array.isArray(a.plane_indices) ? (a.plane_indices as number[]).filter((i) => design.planes[i]) : []
    if (idxs.length && idxs.length < design.planes.length) {
      const ids = new Set(idxs.map((i) => design.planes[i].id))
      restrict = (p) => ids.has(p.id)
      restrictLabel = idxs.map((i) => compass(design.planes[i].azimuthDeg)).join(', ') + '-facing'
    }
    const mod = typeof a.module_id === 'string' ? MODULES.find((m) => m.id === a.module_id) : undefined
    const msg = typeof a.message === 'string' ? a.message : undefined
    return { goal, goalLabel, moduleId: mod?.id, moduleLabel: mod ? `${mod.brand} ${mod.watts} W` : undefined, restrict, restrictLabel, bestOnly: false, billKwh, notes: [], aiMessage: msg }
  } catch { return null }
}
