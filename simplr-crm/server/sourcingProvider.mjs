/* People Data Labs — Person Search provider for /api/sourcing.
 *
 * Returns { source: 'pdl', people: [...] } given search criteria. The client (src/lib/sourcing.ts)
 * scores + researches each person the same way whether it came from here or the offline model, so
 * this only has to fetch and normalise. Set PEOPLE_DATA_LABS_API_KEY (or PDL_API_KEY) to go live;
 * without it the caller returns { fallback: true } and the client uses sample data.
 *
 * Free tier: person-search credits are limited — this requests small pages (size ≤ 15).
 */

const PDL_SEARCH = 'https://api.peopledatalabs.com/v5/person/search'

// PDL's job_company_industry is a fixed taxonomy — a loose word won't `match`, so map common
// inputs to the exact value and query it as an exact `term`.
const INDUSTRY_MAP = {
  renewables: 'renewables & environment', solar: 'renewables & environment', 'renewable energy': 'renewables & environment',
  energy: 'renewables & environment', pv: 'renewables & environment', photovoltaic: 'renewables & environment',
  construction: 'construction', electrical: 'electrical/electronic manufacturing', utilities: 'utilities',
  'oil & energy': 'oil & energy', 'facilities services': 'facilities services',
}
function mapIndustry(raw) {
  const ind = raw.trim().toLowerCase()
  if (INDUSTRY_MAP[ind]) return INDUSTRY_MAP[ind]
  if (/renew|solar|photovolt|\bpv\b/.test(ind)) return 'renewables & environment'
  return null
}

/** Build a People Data Labs Elasticsearch query from simple criteria. */
function buildQuery(c) {
  const must = []
  // Location — default to the UK; accept a town/region/postcode as a free-text locality match.
  must.push({ term: { location_country: (c.country || 'united kingdom').toLowerCase() } })
  if (c.location && c.location.trim()) must.push({ match: { location_name: c.location.trim().toLowerCase() } })
  if (c.title && c.title.trim()) must.push({ match: { job_title: c.title.trim().toLowerCase() } })
  if (c.industry && c.industry.trim()) {
    const mapped = mapIndustry(c.industry)
    must.push(mapped ? { term: { job_company_industry: mapped } } : { match: { job_company_industry: c.industry.trim().toLowerCase() } })
  }
  if (c.companySize && c.companySize.trim()) must.push({ term: { job_company_size: c.companySize.trim() } })
  if (Array.isArray(c.keywords)) for (const k of c.keywords) if (k && k.trim()) must.push({ match: { job_title: k.trim().toLowerCase() } })
  return { query: { bool: { must } }, size: Math.min(15, Math.max(1, c.limit || 12)) }
}

function normalise(p) {
  return {
    fullName: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown',
    jobTitle: p.job_title || '',
    titleRole: p.job_title_role || '',
    seniority: Array.isArray(p.job_title_levels) ? p.job_title_levels[0] : (p.job_title_levels || ''),
    company: p.job_company_name || '',
    companyDomain: p.job_company_website || '',
    industry: p.job_company_industry || '',
    companySize: p.job_company_size || '',
    location: p.location_name || [p.location_locality, p.location_region].filter(Boolean).join(', ') || '',
    linkedinUrl: p.linkedin_url ? (p.linkedin_url.startsWith('http') ? p.linkedin_url : `https://${p.linkedin_url}`) : '',
    workEmail: p.work_email || (Array.isArray(p.emails) && p.emails[0]?.address) || '',
  }
}

export async function pdlSearch(criteria, key) {
  const body = buildQuery(criteria || {})
  const r = await fetch(PDL_SEARCH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
    body: JSON.stringify(body),
  })
  // PDL returns 404 when a valid search simply has zero matches — that's an empty result, not an error.
  if (r.status === 404) return { source: 'pdl', people: [], empty: true }
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`pdl ${r.status}: ${t.slice(0, 160)}`)
  }
  const j = await r.json()
  const people = Array.isArray(j.data) ? j.data.map(normalise).filter((p) => p.fullName && p.fullName !== 'Unknown') : []
  return { source: 'pdl', people }
}
