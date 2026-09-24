import type { Deal } from '../store/types'
import { SHOWROOM_META } from './solarHouseData'
import { enquiredAt } from './journey'
import { money } from './format'

/* One aggregated view of the sales data, used by the built-in insight panels AND handed to Ovi as
 * context — so both read the same numbers. Everything here is computed from the deals' journeys. */

export type Row = { key: string; enquiries: number; signed: number; lost: number; open: number; value: number; conv: number }
const DAY = 86_400_000
const at = (d: Deal, k: string) => d.journey?.steps.find((s) => s.key === k)?.at

function group(deals: Deal[], keyOf: (d: Deal) => string | undefined): Row[] {
  const m = new Map<string, Row>()
  deals.forEach((d) => {
    const k = keyOf(d); if (!k) return
    const r = m.get(k) ?? { key: k, enquiries: 0, signed: 0, lost: 0, open: 0, value: 0, conv: 0 }
    r.enquiries++
    if (d.won) { r.signed++; r.value += d.value } else if (d.lost) r.lost++; else r.open++
    m.set(k, r)
  })
  return [...m.values()].map((r) => ({ ...r, conv: r.signed + r.lost ? Math.round((r.signed / (r.signed + r.lost)) * 100) : 0 })).sort((a, b) => b.enquiries - a.enquiries)
}

export function buildDataset(all: Deal[]) {
  const deals = all.filter((d) => d.journey)
  const won = deals.filter((d) => d.won)
  const month = (t?: number) => (t ? new Date(t).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) : undefined)
  const bySource = group(deals, (d) => d.journey!.source)
  const byShowroom = group(deals, (d) => SHOWROOM_META[d.journey!.showroom]?.name)
  const byAdviser = group(deals, (d) => d.owner)
  const byArea = group(deals, (d) => d.journey!.postcode?.split(' ')[0]).slice(0, 12)
  const byMonth = group(deals, (d) => month(enquiredAt(d))).sort((a, b) => Date.parse(`1 ${a.key.replace(' ', ' 20')}`) - Date.parse(`1 ${b.key.replace(' ', ' 20')}`))
  // product mix of signed systems
  const withBattery = won.filter((d) => (d.journey!.system?.batteryKwh ?? 0) > 0).length
  const withEv = won.filter((d) => d.journey!.system?.evCharger).length
  const avgKwp = won.length ? won.reduce((s, d) => s + (d.journey!.system?.kwp ?? 0), 0) / won.length : 0
  const avgValue = won.length ? won.reduce((s, d) => s + d.value, 0) / won.length : 0
  const sizeBands = [['Under 4 kWp', 0, 4], ['4–6 kWp', 4, 6], ['6–8 kWp', 6, 8], ['8 kWp +', 8, 99]] as const
  const bySize = sizeBands.map(([label, lo, hi]) => { const l = won.filter((d) => { const k = d.journey!.system?.kwp ?? 0; return k >= lo && k < hi }); return { key: label, signed: l.length, value: l.reduce((s, d) => s + d.value, 0) } })
  // speed: median days between journey steps
  const pairs: [string, string, string][] = [['enquiry', 'contacted', 'Enquiry → first contact'], ['contacted', 'consultation', 'Contact → consultation'], ['consultation', 'proposal', 'Consultation → proposal'], ['proposal', 'signed', 'Proposal → signed'], ['signed', 'install', 'Signed → install']]
  const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
  const speed = pairs.map(([a, b, label]) => ({ key: label, days: Math.round(median(deals.map((d) => { const x = at(d, a), y = at(d, b); return x && y && y > x ? (y - x) / DAY : NaN }).filter((n) => !isNaN(n))) * 10) / 10 }))
  const decided = deals.filter((d) => d.won || d.lost)
  return {
    totals: { enquiries: deals.length, signed: won.length, lost: deals.filter((d) => d.lost).length, open: deals.filter((d) => !d.won && !d.lost).length, signedValue: won.reduce((s, d) => s + d.value, 0), winRate: decided.length ? Math.round((won.length / decided.length) * 100) : 0, avgValue: Math.round(avgValue), avgKwp: Math.round(avgKwp * 10) / 10, batteryAttach: won.length ? Math.round((withBattery / won.length) * 100) : 0, evAttach: won.length ? Math.round((withEv / won.length) * 100) : 0 },
    bySource, byShowroom, byAdviser, byArea, byMonth, bySize, speed,
  }
}
export type Dataset = ReturnType<typeof buildDataset>

/* ---- what an insight looks like (Ovi's tool output and the fallback both produce this) ---- */
export type InsightBlock =
  | { type: 'stats'; items: { label: string; value: string }[] }
  | { type: 'bars'; title?: string; unit: 'money' | 'count' | 'percent' | 'days'; items: { label: string; value: number }[] }
  | { type: 'table'; title?: string; columns: string[]; rows: (string | number)[][] }
  | { type: 'text'; text: string }
export type Insight = { title: string; summary: string; blocks: InsightBlock[] }

export const RENDER_TOOL = {
  name: 'render_insight',
  description: 'Show the answer to the user as an insight card: a short title, a one-to-two sentence summary with the key takeaway, and blocks (headline stats, a bar chart and/or a table). Always call this exactly once.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      summary: { type: 'string', description: 'The takeaway in plain English, UK spelling, £ for money.' },
      blocks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['stats', 'bars', 'table', 'text'] },
            title: { type: 'string' },
            unit: { type: 'string', enum: ['money', 'count', 'percent', 'days'] },
            items: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: {} } } },
            columns: { type: 'array', items: { type: 'string' } },
            rows: { type: 'array', items: { type: 'array', items: {} } },
            text: { type: 'string' },
          },
          required: ['type'],
        },
      },
    },
    required: ['title', 'summary', 'blocks'],
  },
}

/** Deterministic Ovi — answers the common questions straight from the dataset when the live model isn't available. */
export function fallbackInsight(q: string, ds: Dataset): Insight {
  const s = q.toLowerCase()
  const pct = (n: number) => `${n}%`
  const tableOf = (rows: Row[], label: string) => ({ type: 'table' as const, columns: [label, 'Enquiries', 'Signed', 'Win rate', 'Signed £'], rows: rows.map((r) => [r.key, r.enquiries, r.signed, pct(r.conv), money(r.value, { compact: true })]) })
  if (/source|channel|marketing|where.*come|facebook|google|referral/.test(s)) {
    const best = [...ds.bySource].filter((r) => r.enquiries >= 5).sort((a, b) => b.conv - a.conv)[0]
    return { title: 'Which lead sources pay off', summary: best ? `${best.key} converts best at ${best.conv}% — worth more budget. Volume and quality don't always line up: compare enquiries with signed value.` : 'Here is how each source performs.', blocks: [{ type: 'bars', title: 'Win rate by source', unit: 'percent', items: ds.bySource.map((r) => ({ label: r.key, value: r.conv })) }, tableOf(ds.bySource, 'Source')] }
  }
  if (/showroom|cardiff|cheltenham|melksham/.test(s)) return { title: 'Showroom performance', summary: `Compared on enquiries handled, win rate and signed value.`, blocks: [{ type: 'bars', title: 'Signed value by showroom', unit: 'money', items: ds.byShowroom.map((r) => ({ label: r.key, value: r.value })) }, tableOf(ds.byShowroom, 'Showroom')] }
  if (/adviser|advisor|sales ?person|who|team|rep/.test(s)) return { title: 'Adviser performance', summary: 'Win rate and signed value per adviser — look for coaching gaps where volume is high but win rate is low.', blocks: [{ type: 'bars', title: 'Win rate by adviser', unit: 'percent', items: ds.byAdviser.map((r) => ({ label: r.key, value: r.conv })) }, tableOf(ds.byAdviser, 'Adviser')] }
  if (/battery|ev|product|mix|size|kwp|attach/.test(s)) return { title: 'What customers are buying', summary: `${ds.totals.batteryAttach}% of signed homes add a battery and ${ds.totals.evAttach}% an EV charger; the average system is ${ds.totals.avgKwp} kWp at £${Math.round(ds.totals.avgValue / 100) / 10}K.`, blocks: [{ type: 'stats', items: [{ label: 'Battery attach', value: pct(ds.totals.batteryAttach) }, { label: 'EV attach', value: pct(ds.totals.evAttach) }, { label: 'Avg system', value: `${ds.totals.avgKwp} kWp` }, { label: 'Avg value', value: `£${Math.round(ds.totals.avgValue).toLocaleString('en-GB')}` }] }, { type: 'bars', title: 'Signed systems by size', unit: 'count', items: ds.bySize.map((r) => ({ label: r.key, value: r.signed })) }] }
  if (/slow|speed|fast|time|days|bottleneck|stuck|long/.test(s)) { const worst = [...ds.speed].sort((a, b) => b.days - a.days)[0]; return { title: 'Where time goes', summary: `The slowest step is ${worst.key.toLowerCase()} at a median ${worst.days} days.`, blocks: [{ type: 'bars', title: 'Median days per step', unit: 'days', items: ds.speed.map((r) => ({ label: r.key, value: r.days })) }] } }
  if (/area|postcode|town|region|where/.test(s)) return { title: 'Best postcode areas', summary: 'Enquiries and win rate by postcode district — useful for targeting leaflets and ads.', blocks: [{ type: 'bars', title: 'Enquiries by area', unit: 'count', items: ds.byArea.map((r) => ({ label: r.key, value: r.enquiries })) }, tableOf(ds.byArea, 'Area')] }
  return { title: 'Sales at a glance', summary: `${ds.totals.enquiries} enquiries, ${ds.totals.signed} signed (${money(ds.totals.signedValue, { compact: true })}) at a ${ds.totals.winRate}% win rate.`, blocks: [{ type: 'stats', items: [{ label: 'Enquiries', value: String(ds.totals.enquiries) }, { label: 'Signed', value: String(ds.totals.signed) }, { label: 'Win rate', value: pct(ds.totals.winRate) }, { label: 'Signed value', value: money(ds.totals.signedValue, { compact: true }) }] }, { type: 'bars', title: 'Enquiries by month', unit: 'count', items: ds.byMonth.map((r) => ({ label: r.key, value: r.enquiries })) }] }
}

/** Ask the live model; resolves to null if it's not available so the caller can fall back. */
export async function askOviInsight(q: string, ds: Dataset): Promise<Insight | null> {
  try {
    const r = await fetch('/api/ovi', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: `You are Ovi, the analyst inside The Solar House CRM (UK residential solar, battery & EV installer with showrooms in Cardiff, Cheltenham and Melksham). Answer the manager's question using ONLY this dataset (JSON, computed from the CRM). Be specific with numbers, UK English, £ for money. Always respond by calling render_insight once, with a chart (bars) and/or a table that best answers the question.\n\nDATASET:\n${JSON.stringify(ds)}`,
        messages: [{ role: 'user', content: q }],
        tools: [RENDER_TOOL],
      }),
    })
    const data = await r.json()
    if (data.fallback || data.error) return null
    const use = (data.content ?? []).find((c: { type: string }) => c.type === 'tool_use')
    return use ? (use.input as Insight) : null
  } catch { return null }
}
