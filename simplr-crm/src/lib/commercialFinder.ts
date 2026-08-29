/* Glue between the Commercial Solar engine and the Finder UI / store:
 *  • geocodeLocation — typed place → pin
 *  • parseBrief       — free-text "find 50 warehouses within 5km of Wolverhampton" → parameters
 *  • prospectToSolar  — engine CommercialProspect → persisted SolarProspect
 *  • revealContactsFor — spend one PDL lookup for a single company (the reveal = spend model)
 */

import type { LatLng } from './solar'
import type { CommercialProspect } from './commercialSolar'
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
export function industryLabel(key: IndustryKey): string {
  return INDUSTRY_ENERGY[key].label
}

/** Engine prospect → persisted store record (denormalised snapshot for lists/kanban). */
export function prospectToSolar(p: CommercialProspect, campaignId: string): SolarProspect {
  const d = p.design
  const contacts: SolarContact[] = p.people.map((pl) => ({
    id: rid('sc'), name: pl.name, title: pl.title, email: pl.email, linkedin: pl.linkedin, seniority: undefined, revealed: !!(pl.email || pl.name),
  }))
  return {
    id: p.id,
    campaignId,
    company: p.company,
    address: p.address,
    domain: p.domain,
    center: p.center,
    category: p.category,
    distanceM: p.distanceM,
    systemKwp: Math.round(d.systemKwp * 10) / 10,
    panels: d.panels,
    annualGenKwh: d.annualProduction,
    year1Saving: Math.round(d.annualSavings),
    lifetimeSaving: Math.round(d.lifetimeSavings),
    paybackYears: Math.round(d.payback * 10) / 10,
    npv: Math.round(d.lifetimeSavings - d.systemCost),
    co2PerYearTonnes: Math.round(d.co2PerYear * 10) / 10,
    roofMeasured: p.roofMeasured,
    imageUrl: p.imageUrl,
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

/** Spend one PDL lookup to reveal a single company's decision-makers. */
export async function revealContactsFor(prospect: SolarProspect, jobTitles?: string[]): Promise<SolarContact[]> {
  const { leads } = await sourceLeads({
    company: prospect.company,
    domain: prospect.domain,
    location: prospect.address,
    titles: jobTitles,
    title: jobTitles?.[0],
    limit: 6,
  })
  return leads.map((pl) => ({ id: rid('sc'), name: pl.name, title: pl.title, email: pl.email, linkedin: pl.linkedin, revealed: true }))
}
