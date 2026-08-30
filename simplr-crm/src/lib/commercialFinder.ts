/* Glue between the Commercial Solar engine and the Finder UI / store:
 *  • geocodeLocation — typed place → pin
 *  • parseBrief       — free-text "find 50 warehouses within 5km of Wolverhampton" → parameters
 *  • prospectToSolar  — engine CommercialProspect → persisted SolarProspect
 *  • revealContactsFor — spend one PDL lookup for a single company (the reveal = spend model)
 */

import type { LatLng } from './solar'
import type { CommercialProspect, CompanyResult } from './commercialSolar'
import type { SolarProspect, SolarContact } from '../store/types'
import { sourceLeads } from './sourcing'
import { classifyIndustry, INDUSTRY_ENERGY, type IndustryKey } from './commercialModel'

const rid = (p: string) => `${p}${Math.random().toString(36).slice(2, 9)}`

/** Typed location → pin. Returns null if geocoding is unavailable. */
export async function geocodeLocation(address: string): Promise<(LatLng & { formatted?: string }) | null> {
  try {
    const r = await fetch('/api/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }) })
    if (r.ok) {
      const j = await r.json()
      if (j && typeof j.lat === 'number') return { lat: j.lat, lng: j.lng, formatted: j.formatted }
    }
  } catch { /* offline */ }
  return null
}

export type ParsedBrief = {
  industry?: string
  location?: string
  radiusKm?: number
  targetKwp?: number
  count?: number
  jobTitles?: string[]
}

const INDUSTRY_WORDS: [RegExp, string][] = [
  [/cold\s?stor|chill|freezer|refriger/i, 'cold storage'],
  [/wareh|logist|distrib|fulfil/i, 'warehouses'],
  [/manufact|factor|producti/i, 'manufacturing'],
  [/superm|grocer/i, 'supermarkets'],
  [/car\s?deal|dealership|showroom|garage/i, 'car dealerships'],
  [/retail|shop|store/i, 'retail'],
  [/hotel/i, 'hotels'],
  [/office/i, 'offices'],
  [/industr|unit/i, 'industrial units'],
]

/** Best-effort extraction of scan parameters from a natural-language brief. */
export function parseBrief(text: string): ParsedBrief {
  const out: ParsedBrief = {}
  const t = ` ${text} `

  const count = t.match(/\b(\d{1,4})\s*(?:commercial\s+)?(?:businesses|companies|firms|prospects|leads|sites|buildings|warehouses|roofs)?/i)
  if (count && /find|get|scan|show|give|\d/.test(t)) out.count = Math.min(200, parseInt(count[1], 10))

  const radius = t.match(/(\d+(?:\.\d+)?)\s*(km|kilometre|kilometer|mile|mi)\b/i)
  if (radius) { const n = parseFloat(radius[1]); out.radiusKm = /mi/i.test(radius[2]) ? +(n * 1.609).toFixed(1) : n }

  const kwp = t.match(/(\d+(?:\.\d+)?)\s*(kwp|kw|kilowatt|mwp|mw)\b/i)
  if (kwp) { const n = parseFloat(kwp[1]); out.targetKwp = /mw/i.test(kwp[2]) ? n * 1000 : n }

  for (const [re, label] of INDUSTRY_WORDS) if (re.test(t)) { out.industry = label; break }

  const loc = t.match(/\b(?:in|near|around|within[^,]*?of|of)\s+([A-Za-z][A-Za-z .'-]+?)(?:\s+(?:targeting|with|for|and|to)\b|,|\.|$)/i)
  if (loc) out.location = loc[1].trim()

  const titles = t.match(/(?:targeting|contact(?:ing)?|decision[- ]?makers?|reach(?:ing)?|find(?:ing)?)\s+([A-Za-z ,/&]+?)(?:\s+(?:at|in|near|within|with)\b|,|\.|$)/i)
  if (titles && /manager|director|owner|head|officer|ceo|md|founder|facilit|operations|energy|sustain/i.test(titles[1])) {
    out.jobTitles = titles[1].split(/,|\/|\band\b/).map((s) => s.trim()).filter(Boolean).slice(0, 4)
  }
  return out
}

export function normaliseIndustry(text?: string): IndustryKey {
  return classifyIndustry(text)
}

// ── Intelligent brief interpretation (real LLM, with the regex parser as fallback) ──
export type FinderPlan = {
  mode?: 'radius' | 'bulk' | 'single'
  action?: 'run' | 'clarify'
  specificCompany?: string | null
  industries?: string[]
  locations?: string[]
  targetKwp?: number
  count?: number
  jobTitles?: string[]
  radiusKm?: number
  missing?: string[]
}

const SYSTEM = `You are Ovi, an AI prospecting operator for a UK commercial-solar sales team. The user tells you who they want to find. Turn their request into a plan — DO NOT invent details they didn't give.

Modes:
- "radius": scan every business within a radius of a place (needs a location + radius km).
- "bulk": sweep a whole area/region by industry (needs a location/area).
- "single": ONE specific building or named company (set specificCompany, e.g. "Valeo Foods").

Reply with (1) ONE short, natural sentence reflecting what THEY actually asked — never restate defaults they didn't mention — then (2) a fenced json block:
\`\`\`json
{"mode":"radius|bulk|single","action":"run|clarify","specificCompany":null|"name","industries":[],"locations":[],"targetKwp":250,"count":20,"jobTitles":[],"radiusKm":5,"missing":[]}
\`\`\`
Rules: only fill fields you can infer from the message or current params; leave the rest as current. If they named a specific company, mode="single", set specificCompany, action="run". Set action="run" only when you have enough to start (single: a company/address; radius: a location; bulk: an area); otherwise action="clarify" and list what's "missing".`

/** Interpret a free-text brief with the LLM → a natural reply + a structured plan. Falls back to regex. */
export async function interpretBrief(text: string, current: Record<string, unknown>): Promise<{ reply: string; plan: FinderPlan; llm: boolean }> {
  try {
    const r = await fetch('/api/ovi', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: `${SYSTEM}\n\nCurrent params: ${JSON.stringify(current)}`, messages: [{ role: 'user', content: text }] }),
    })
    const j = await r.json()
    const blocks = j?.content
    if (Array.isArray(blocks)) {
      const out = blocks.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n')
      const m = out.match(/```json\s*([\s\S]*?)```/)
      const plan: FinderPlan = m ? JSON.parse(m[1]) : {}
      const reply = out.replace(/```json[\s\S]*?```/g, '').trim()
      return { reply: reply || 'On it.', plan, llm: true }
    }
  } catch { /* no key / offline — fall back */ }
  const b = parseBrief(text)
  const plan: FinderPlan = {
    industries: b.industry ? [b.industry] : undefined, locations: b.location ? [b.location] : undefined,
    targetKwp: b.targetKwp, count: b.count, jobTitles: b.jobTitles, radiusKm: b.radiusKm,
    action: b.location ? 'run' : 'clarify',
  }
  return { reply: '', plan, llm: false }
}
export function industryLabel(key: IndustryKey): string {
  return INDUSTRY_ENERGY[key].label
}

/** Engine prospect → persisted store record (denormalised snapshot for lists/kanban). */
export function prospectToSolar(p: CommercialProspect, campaignId: string, tool = 'commercial-solar'): SolarProspect {
  const r = p.calc.recommended
  const contacts: SolarContact[] = p.people.map((pl) => ({
    id: rid('sc'), name: pl.name, title: pl.title, email: pl.email, linkedin: pl.linkedin, seniority: undefined, revealed: !!(pl.email || pl.name),
  }))
  return {
    id: p.id,
    campaignId,
    tool,
    roofSegments: p.roofSegments,
    roofFootprint: p.roofFootprint,
    company: p.company,
    address: p.address,
    domain: p.domain,
    center: p.center,
    category: p.category,
    distanceM: p.distanceM,
    systemKwp: Math.round(r.kwp * 10) / 10,
    roofMaxKwp: p.roofMaxKwp,
    roofAreaM2: p.roofAreaM2,
    panels: r.panels,
    annualGenKwh: r.annualGenKwh,
    year1Saving: Math.round(r.year1Saving),
    lifetimeSaving: Math.round(r.lifetimeSaving),
    paybackYears: Math.round(r.paybackYears * 10) / 10,
    npv: Math.round(r.npv),
    co2PerYearTonnes: Math.round(r.co2PerYearTonnes * 10) / 10,
    selfConsumptionPct: r.selfConsumptionPct,
    demandOffsetPct: r.demandOffsetPct,
    roofMeasured: p.roofMeasured,
    imageUrl: p.imageUrl,
    roofZoom: p.roofZoom,
    calc: p.calc,
    epcRating: p.epc?.rating ?? null,
    score: p.score,
    reasons: p.reasons,
    status: 'prospected',
    contacts,
    contactsRevealed: contacts.length > 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/** Company (no roof yet) → a prospect record marked roofPending, so it lives in the same database. */
export function companyToProspect(co: CompanyResult, campaignId: string, tool = 'company-search'): SolarProspect {
  return {
    id: co.id, campaignId, tool, company: co.name, address: co.address, domain: co.domain, center: co.center, category: co.category, distanceM: co.distanceM,
    roofPending: true, systemKwp: 0, roofMaxKwp: 0, panels: 0, annualGenKwh: 0, year1Saving: 0, lifetimeSaving: 0, paybackYears: 0, npv: 0, co2PerYearTonnes: 0,
    roofMeasured: false, epcRating: null, score: co.score, reasons: co.reasons, status: 'prospected',
    contacts: [], contactsRevealed: false, createdAt: Date.now(), updatedAt: Date.now(),
  }
}

/** Spend one PDL lookup to reveal a single company's people — everyone we can find, scoped by the
 *  company domain/name. Titles are filtered in the panel, not in the query, so it's a full browse. */
export async function revealContactsFor(prospect: SolarProspect, _jobTitles?: string[]): Promise<SolarContact[]> {
  const { leads } = await sourceLeads({
    company: prospect.company,
    domain: prospect.domain,
    limit: 15,
  })
  return leads.map((pl) => ({ id: rid('sc'), name: pl.name, title: pl.title, email: pl.email, hasEmail: pl.hasEmail, seniority: pl.seniority, linkedin: pl.linkedin, revealed: true }))
}
