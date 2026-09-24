import type { Deal, Lead, Showroom } from '../store/types'

/* Lead inbox helpers — residential leads (CSV batches from Solar on Steroids, web forms, ads…).
 * "Push to pipeline" turns a lead into a proper enquiry on the Deals board, with a journey. */

const HOUR = 3_600_000
/** Nearest showroom from the postcode area. */
export function showroomFor(postcode = ''): Showroom {
  const area = postcode.trim().toUpperCase().match(/^[A-Z]+/)?.[0] ?? ''
  if (['CF', 'NP', 'SA', 'LD'].includes(area)) return 'cardiff'
  if (['SN', 'BA', 'SP', 'BS'].includes(area)) return 'melksham'
  return 'cheltenham' // GL, WR, HR, OX and anything else nearby
}

/** The deal a lead becomes when it's pushed into the sales pipeline. */
export function dealFromLead(l: Lead, now = Date.now()): Partial<Deal> & { name: string; org: string; value: number; stage: 'New enquiry' } {
  const bill = l.monthlyBill ?? 140
  const annualKwh = Math.round(((bill - 12) * 12) / 0.245 / 100) * 100
  return {
    name: l.name, org: l.company || `${l.address ?? ''}, ${l.postcode ?? ''}`, value: l.value ?? Math.round((3400 + (annualKwh / 390) * 0.45 * 980 + 9.5 * 520) / 50) * 50,
    stage: 'New enquiry', owner: l.owner, subtitle: `${l.source}${l.batch ? ` · ${l.batch.label}` : ''}`, health: 'Healthy', chips: [], personIds: [],
    journey: {
      showroom: showroomFor(l.postcode), source: l.source, address: l.address ?? l.company, postcode: l.postcode ?? '', phone: l.phone ?? '', email: l.email ?? '',
      property: { type: 'Unknown', bedrooms: 3, roofAspect: 'Unknown', annualKwh, monthlyBill: bill, heating: 'Unknown', hasEv: /ev/i.test(l.interest ?? '') },
      steps: [{ key: 'enquiry', at: l.createdAt ?? now, by: l.source, data: { channel: l.source, message: [l.interest, l.notes].filter(Boolean).join(' · ') || 'Enquiry', ...(l.batch ? { batch: l.batch.label } : {}) } }],
      nextAction: { label: 'First call — introduce & book consultation', due: now + 2 * HOUR },
    },
  }
}

/* ---- CSV import ---- */
export const LEAD_FIELDS = [
  { key: 'name', label: 'Name', hints: ['name', 'full name', 'customer'] },
  { key: 'phone', label: 'Phone', hints: ['phone', 'mobile', 'tel', 'number'] },
  { key: 'email', label: 'Email', hints: ['email', 'e-mail'] },
  { key: 'address', label: 'Address', hints: ['address', 'street', 'line 1', 'house'] },
  { key: 'postcode', label: 'Postcode', hints: ['postcode', 'post code', 'zip'] },
  { key: 'monthlyBill', label: 'Monthly bill (£)', hints: ['bill', 'spend', 'electric'] },
  { key: 'interest', label: 'Interested in', hints: ['interest', 'product', 'looking'] },
  { key: 'notes', label: 'Notes', hints: ['note', 'comment', 'message', 'info'] },
] as const
export type LeadFieldKey = (typeof LEAD_FIELDS)[number]['key']

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (ch === '"') q = false; else cell += ch }
    else if (ch === '"') q = true
    else if (ch === ',' || ch === '\t') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((c) => c.trim())) rows.push(row); row = [] }
    else cell += ch
  }
  row.push(cell); if (row.some((c) => c.trim())) rows.push(row)
  return rows
}
export function autoMap(header: string[]): Record<LeadFieldKey, number> {
  const m = {} as Record<LeadFieldKey, number>
  LEAD_FIELDS.forEach((f) => { m[f.key] = header.findIndex((h) => f.hints.some((x) => h.toLowerCase().includes(x))) })
  return m
}
export const CSV_TEMPLATE = 'Name,Phone,Email,Address,Postcode,Monthly bill,Interested in,Notes\nSarah Jones,07700 900123,sarah@example.com,12 Church Road,CF14 2AB,150,Solar + battery,Call after 5pm\n'

/** Default cost per lead by source — editable on the analytics page, used for cost-per-sale and ROI. */
export const DEFAULT_CPL: Record<string, number> = { 'Solar on Steroids': 38, 'Facebook lead ad': 22, 'Google search': 30, Instagram: 25, 'Website enquiry': 8, Referral: 0, 'Showroom walk-in': 0, 'Leekes in-store': 12, 'Phone call': 0 }
