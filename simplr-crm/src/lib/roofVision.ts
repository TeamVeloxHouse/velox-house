/* Claude-vision roof obstruction detector — the "intelligent" tier of auto-detect.
 * The DSM bump detector (dsm.ts) finds RAISED objects (chimneys/vents/HVAC) but is blind to flush
 * skylights/rooflights that sit level with the roof. Claude reads the georeferenced aerial and reports
 * every obstruction with a tight polygon + a type it recognises zero-shot (no training needed). We map
 * its normalised image coords back to lat/lng via the tile's known bounds. Relayed through /api/ovi
 * (the existing ANTHROPIC_API_KEY proxy); returns null with no key/data so detect still works offline. */
import { fetchRgbOverlay } from './dsm'
import type { DetectedObstacle } from './dsm'

const TOOL = {
  name: 'report_roof_obstructions',
  description: 'Report every obstruction on the roof so the solar layout can keep panels clear of them.',
  input_schema: {
    type: 'object',
    properties: {
      obstructions: {
        type: 'array',
        description: 'One entry per distinct roof obstruction. Empty array if the roof is clear.',
        items: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['chimney', 'skylight', 'vent', 'flue', 'hvac', 'satellite', 'other'], description: 'What the object is.' },
            polygon: {
              type: 'array',
              description: 'A tight outline around the object, 3+ points, each [x, y] in NORMALISED image coordinates: x = fraction from the LEFT edge (0–1), y = fraction from the TOP edge (0–1).',
              items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
            },
          },
          required: ['kind', 'polygon'],
        },
      },
    },
    required: ['obstructions'],
  },
}

const SYSTEM = `You are an expert roof surveyor examining a top-down aerial photo of ONE building's roof for a solar PV install. Identify every roof obstruction a solar array must avoid: chimneys, flue/vent pipes, soil/plumbing vents, skylights and rooflights (including flush glass panels level with the roof), HVAC/AC condenser units, satellite dishes, and any other roof-mounted plant.

Rules:
- Draw a TIGHT polygon around each object in normalised image coordinates (x from the left 0–1, y from the top 0–1).
- Report each object once. Do NOT report: roof edges/ridges/valleys, gutters, existing solar panels, tree shadows, or the ground around the building.
- A skylight/rooflight is a rectangular glazed panel set into the roof slope — include it even when it is flush and casts no shadow.
- If unsure what a small object is, report it as "other" so the array still keeps clear.
Call report_roof_obstructions with the full list.`

const KIND_MAP: Record<string, DetectedObstacle['kind']> = {
  chimney: 'chimney', flue: 'chimney', hvac: 'hvac', skylight: 'skylight', vent: 'keepout', satellite: 'keepout', other: 'keepout',
}

/** Detect roof obstructions with Claude vision on the georeferenced aerial. Returns null (→ caller
 *  falls back to the DSM detector) when there is no Solar imagery or no live Anthropic key. */
export async function detectObstaclesVision(lat: number, lng: number): Promise<DetectedObstacle[] | null> {
  try {
    const rgb = await fetchRgbOverlay(lat, lng).catch(() => null)
    if (!rgb) return null
    const b64 = rgb.dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const [[south, west], [north, east]] = rgb.bounds
    const res = await fetch('/api/ovi', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system: SYSTEM,
        tools: [TOOL],
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
            { type: 'text', text: 'Identify every obstruction on this roof and call report_roof_obstructions.' },
          ],
        }],
      }),
    })
    const data = await res.json()
    if (!data || data.fallback || data.error || !Array.isArray(data.content)) return null
    const call = data.content.find((b: { type: string }) => b.type === 'tool_use') as { input?: { obstructions?: unknown } } | undefined
    const list = call?.input?.obstructions
    if (!Array.isArray(list)) return null
    // map normalised image coords → lat/lng: x → lng (west→east), y → lat (north→south, y grows downward)
    const toLL = (x: number, y: number) => ({ lat: north - Math.min(1, Math.max(0, y)) * (north - south), lng: west + Math.min(1, Math.max(0, x)) * (east - west) })
    const out: DetectedObstacle[] = []
    for (const o of list as { kind?: string; polygon?: number[][] }[]) {
      const poly = Array.isArray(o.polygon) ? o.polygon.filter((p) => Array.isArray(p) && p.length >= 2) : []
      if (poly.length < 3) continue
      out.push({ kind: KIND_MAP[o.kind ?? 'other'] ?? 'keepout', polygon: poly.map(([x, y]) => toLL(x, y)), heightM: 0 })
    }
    return out
  } catch { return null }
}
