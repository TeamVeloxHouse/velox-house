/* Lead sourcing — People Data Labs, with an offline sample fallback.
 *
 * `sourceLeads()` asks the backend (/api/sourcing → PDL) for people matching the criteria, then
 * scores + researches each one the SAME way whether it came from PDL or the offline sample, so the
 * UI is identical. Leads only enter the CRM once they're scored and have a "why now" — never a raw
 * scrape. Set PEOPLE_DATA_LABS_API_KEY on the backend to go live.
 */

export type SourcingCriteria = {
  title?: string
  industry?: string
  location?: string
  companySize?: string
  keywords?: string[]
  limit?: number
}

export type PdlPerson = {
  fullName: string
  jobTitle: string
  titleRole?: string
  seniority?: string
  company: string
  companyDomain?: string
  industry?: string
  companySize?: string
  location?: string
  linkedinUrl?: string
  workEmail?: string
}

export type SourcedLead = {
  id: string
  name: string
  title: string
  company: string
  domain?: string
  location: string
  industry?: string
  companySize?: string
  email?: string
  linkedin?: string
  score: number // 0–100 fit
  signals: string[]
  why: string
  source: 'People Data Labs' | 'Sample data'
}

const SENIOR = ['owner', 'founder', 'director', 'head', 'chief', 'ceo', 'managing', 'partner', 'manager', 'principal']

function scoreAndResearch(p: PdlPerson, c: SourcingCriteria, idx: number): SourcedLead {
  const title = (p.jobTitle || '').toLowerCase()
  const industry = (p.industry || '').toLowerCase()
  const signals: string[] = []
  let score = 48

  if (c.title && title.includes(c.title.toLowerCase().split(' ')[0])) { score += 20; signals.push('Job title matches your ICP') }
  if (c.industry && industry.includes(c.industry.toLowerCase().split(' ')[0])) { score += 15; signals.push(`In ${p.industry}`) }
  else if (/renewa|solar|energy|electr/.test(industry)) { score += 12; signals.push('Renewables / energy sector') }
  if (SENIOR.some((s) => title.includes(s))) { score += 12; signals.push('Decision-maker seniority') }
  if (p.workEmail) { score += 6; signals.push('Verified work email') }
  if (p.linkedinUrl) { score += 3; signals.push('LinkedIn profile found') }
  if (p.companySize) signals.push(`Company size ${p.companySize}`)
  if (p.location) signals.push(`${p.location} — UK`)

  score = Math.max(40, Math.min(98, score + (idx % 3)))

  const lead = p.jobTitle && p.company ? `${p.jobTitle} at ${p.company}` : p.company || p.jobTitle
  const why = `${lead}${p.location ? ` in ${p.location}` : ''}. ${signals.slice(0, 2).join('; ') || 'Matches your search'}${p.workEmail ? ' — reachable by email now.' : '.'}`

  return {
    id: `sl${idx}-${(p.fullName || 'x').replace(/\s+/g, '').slice(0, 8)}`,
    name: p.fullName,
    title: p.jobTitle || '—',
    company: p.company || '—',
    domain: p.companyDomain || undefined,
    location: p.location || 'United Kingdom',
    industry: p.industry || undefined,
    companySize: p.companySize || undefined,
    email: p.workEmail || undefined,
    linkedin: p.linkedinUrl || undefined,
    score,
    signals,
    why,
  } as SourcedLead
}

/** Deterministic sample people so the finder works with no API key. */
function samplePeople(c: SourcingCriteria): PdlPerson[] {
  const firsts = ['James', 'Sophie', 'Daniel', 'Priya', 'Mark', 'Chloe', 'Aaron', 'Nadia', 'Tom', 'Grace', 'Owen', 'Leah', 'Callum', 'Ruth']
  const lasts = ['Whitfield', 'Bawa', 'Oakley', 'Sharma', 'Ellison', 'Devlin', 'Frost', 'Rahman', 'Pearce', 'Holt', 'Marsh', 'Quinn', 'Reed', 'Foss']
  const companies = ['Brightspark Solar', 'Sunhill Renewables', 'GreenArc Energy', 'Photon Installations', 'Meridian Solar', 'Kestrel Renewables', 'Voltaic Home', 'Helios EnergyWorks', 'Northstar Solar', 'Evergreen PV', 'Solstice Energy', 'Amber Grid Solar']
  const titles = c.title ? [c.title, `Senior ${c.title}`, `Head of ${c.title}`, `${c.title} Manager`] : ['Operations Director', 'Installation Manager', 'Managing Director', 'Head of Projects', 'Commercial Manager', 'Owner']
  const sizes = ['11-50', '1-10', '51-200', '11-50']
  const towns = ['Manchester', 'Leeds', 'Bristol', 'Birmingham', 'Sheffield', 'Nottingham', 'Leicester', 'Cardiff']
  const loc = c.location && c.location.trim() ? c.location.trim() : null
  const n = Math.min(12, Math.max(1, c.limit || 12))
  const seed = (c.title || '') + (c.industry || '') + (c.location || '')
  const h = seed.split('').reduce((a, ch) => a + ch.charCodeAt(0), 11)
  return Array.from({ length: n }, (_, i) => {
    const first = firsts[(h + i * 3) % firsts.length]
    const last = lasts[(h + i * 5) % lasts.length]
    const company = companies[(h + i) % companies.length]
    const town = loc || towns[(h + i * 2) % towns.length]
    const hasEmail = (h + i) % 3 !== 0
    const dom = company.toLowerCase().replace(/[^a-z]/g, '') + '.co.uk'
    return {
      fullName: `${first} ${last}`,
      jobTitle: titles[(h + i) % titles.length],
      company,
      companyDomain: dom,
      industry: c.industry && c.industry.trim() ? c.industry : 'Renewables & Environment',
      companySize: sizes[(h + i) % sizes.length],
      location: `${town}, United Kingdom`,
      linkedinUrl: `https://linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase()}`,
      workEmail: hasEmail ? `${first.toLowerCase()}.${last.toLowerCase()}@${dom}` : '',
    } as PdlPerson
  })
}

/** Source, score and research leads. Uses PDL when the backend has a key; otherwise sample data. */
export async function sourceLeads(c: SourcingCriteria): Promise<{ leads: SourcedLead[]; live: boolean; reason?: string }> {
  let people: PdlPerson[] | null = null
  let reason: string | undefined
  try {
    const r = await fetch('/api/sourcing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) })
    if (r.ok) {
      const j = await r.json()
      // A live response (even with zero matches) counts as live — only fall back to sample when the
      // backend has no key or errored (j.fallback).
      if (j && !j.fallback && Array.isArray(j.people)) people = j.people as PdlPerson[]
      else reason = j?.reason
    }
  } catch (e) {
    reason = String((e as Error)?.message || e)
  }
  const live = !!people
  const src = people ?? samplePeople(c)
  const leads = src
    .map((p, i) => scoreAndResearch(p, c, i))
    .map((l) => ({ ...l, source: (live ? 'People Data Labs' : 'Sample data') as SourcedLead['source'] }))
    .sort((a, b) => b.score - a.score)
  return { leads, live, reason }
}

export const scoreTone = (s: number): 'positive' | 'accent' | 'warning' => (s >= 80 ? 'positive' : s >= 65 ? 'accent' : 'warning')
