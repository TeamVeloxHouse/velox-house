/* Solar House demo data generator — realistic domestic volume so the CRM can be felt at scale.
 *
 * ~100 enquiries a month for four months across the four showrooms, each flowing through the real
 * lifecycle (enquiry → contacted → consultation → proposal → survey → signed → DNO → install →
 * handover), with drop-off at each step, so ~50 sign and ~50 installs land a month. Deterministic
 * (seeded PRNG) so the demo looks the same on every machine. */

import type { Deal, Person, Lead, Activity, Journey, JourneyStep, JourneyKey, Showroom, Pipeline } from '../store/types'
import { makeStages } from './pipelines'

// ── Pipeline — the sales half of the journey lives on the board ────────────────────────────
export const SH_STAGES = ['New enquiry', 'Contacted', 'Consultation', 'Proposal sent', 'Survey', 'Signed'] as const
const STAGE_PROB = [10, 20, 40, 60, 80, 100]
export function solarHousePipeline(): Pipeline {
  return { id: 'pipe-default', name: 'Solar House pipeline', stages: makeStages(SH_STAGES.map((name, i) => ({ name, probability: STAGE_PROB[i] }))) }
}
export const JOURNEY: { key: JourneyKey; label: string; stage: string }[] = [
  { key: 'enquiry', label: 'Enquiry', stage: 'New enquiry' },
  { key: 'contacted', label: 'Contacted', stage: 'Contacted' },
  { key: 'consultation', label: 'Consultation', stage: 'Consultation' },
  { key: 'proposal', label: 'Proposal', stage: 'Proposal sent' },
  { key: 'survey', label: 'Survey', stage: 'Survey' },
  { key: 'signed', label: 'Signed', stage: 'Signed' },
  { key: 'dno', label: 'DNO & scheduling', stage: 'Signed' },
  { key: 'install', label: 'Installation', stage: 'Signed' },
  { key: 'handover', label: 'Handover & portal', stage: 'Signed' },
]

export const SHOWROOM_META: Record<Showroom, { name: string; color: string }> = {
  cardiff: { name: 'Cardiff', color: '#0E7A66' },
  cheltenham: { name: 'Cheltenham', color: '#4F46E5' },
  gloucester: { name: 'Gloucester', color: '#D97706' },
  melksham: { name: 'Melksham', color: '#DB2777' },
}

// ── deterministic randomness ────────────────────────────────────────────────────────────────
function prng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

const FIRST = ['Sarah', 'Gareth', 'Priya', 'David', 'Helen', 'Tom', 'Margaret', 'Owen', 'Lucy', 'Chris', 'Emma', 'James', 'Rachel', 'Ian', 'Sian', 'Rhodri', 'Claire', 'Mark', 'Joanne', 'Paul', 'Karen', 'Steve', 'Louise', 'Andrew', 'Nia', 'Dylan', 'Fiona', 'Graham', 'Hannah', 'Keith', 'Laura', 'Martin', 'Nicola', 'Peter', 'Rebecca', 'Simon', 'Tracy', 'Wayne', 'Zoe', 'Aled', 'Bethan', 'Carys', 'Dafydd', 'Elin', 'Geraint', 'Harriet', 'Imogen', 'Jonathan', 'Kirsty', 'Lewis', 'Megan', 'Neil', 'Olivia', 'Philip', 'Ruth', 'Stuart', 'Victoria', 'William', 'Alison', 'Brian']
const LAST = ['Jones', 'Williams', 'Davies', 'Evans', 'Thomas', 'Roberts', 'Hughes', 'Lewis', 'Morgan', 'Griffiths', 'Smith', 'Taylor', 'Brown', 'Wilson', 'Clarke', 'Hall', 'Wood', 'Harris', 'Martin', 'Cooper', 'Ward', 'Turner', 'Hill', 'Moore', 'Walker', 'Wright', 'Green', 'Baker', 'Price', 'Bennett', 'Powell', 'Phillips', 'Watkins', 'Pritchard', 'Rees', 'Owen', 'Jenkins', 'Hopkins', 'Parry', 'Bowen', 'Whitfield', 'Hollis', 'Allen', 'Shah', 'Richards', 'Kelly', 'Marsh', 'Fletcher', 'Chapman', 'Ellis']
const STREETS = ['Church Road', 'Station Road', 'Park Avenue', 'Mill Lane', 'The Crescent', 'Victoria Road', 'Orchard Close', 'Meadow Way', 'Queens Road', 'Highfield Road', 'Manor Drive', 'Oak Tree Close', 'Beech Grove', 'Heol Y Coed', 'Kings Road', 'Rowan Way', 'Willow Close', 'The Paddocks', 'Hawthorn Drive', 'Cedar Avenue', 'Brookside', 'Hillcrest', 'Chestnut Road', 'Vicarage Lane', 'Elm Grove', 'St Marys Road', 'Priory Road', 'Castle View', 'Riverside', 'Lansdown Road']
const AREAS: Record<Showroom, [string, string][]> = {
  cardiff: [['Cardiff', 'CF14'], ['Cardiff', 'CF23'], ['Cardiff', 'CF5'], ['Penarth', 'CF64'], ['Caerphilly', 'CF83'], ['Pontypridd', 'CF37'], ['Barry', 'CF62'], ['Radyr', 'CF15']],
  cheltenham: [['Cheltenham', 'GL50'], ['Cheltenham', 'GL51'], ['Cheltenham', 'GL52'], ['Charlton Kings', 'GL53'], ['Bishops Cleeve', 'GL52'], ['Tewkesbury', 'GL20'], ['Winchcombe', 'GL54']],
  gloucester: [['Gloucester', 'GL1'], ['Gloucester', 'GL2'], ['Gloucester', 'GL4'], ['Quedgeley', 'GL2'], ['Stroud', 'GL5'], ['Stonehouse', 'GL10']],
  melksham: [['Melksham', 'SN12'], ['Chippenham', 'SN15'], ['Trowbridge', 'BA14'], ['Devizes', 'SN10'], ['Corsham', 'SN13'], ['Bradford-on-Avon', 'BA15']],
}
const ADVISERS: Record<Showroom, string[]> = {
  cardiff: ['Jordan Miles', 'Amy Price'], cheltenham: ['Beth Collins', 'Tom Hale'], gloucester: ['Rhys Evans'], melksham: ['Kate Morris'],
}
const SURVEYORS = ['Mark Lewis', 'Ieuan Davies', 'Sam Turner']
const TEAMS: Record<Showroom, string> = { cardiff: 'Install team A (Cardiff)', cheltenham: 'Install team B (Glos)', gloucester: 'Install team B (Glos)', melksham: 'Install team C (Wilts)' }
const SOURCES: [string, number][] = [['Website enquiry', 26], ['Facebook lead ad', 22], ['Showroom walk-in', 14], ['Google search', 12], ['Referral', 10], ['Instagram', 6], ['Leekes in-store', 5], ['Phone call', 5]]
const LOST_REASONS = ['Went with a cheaper quote', 'Not the right time', 'Roof not suitable', 'Couldn’t get finance', 'Stopped responding', 'Moving house', 'Partner not keen']

const DAY = 86_400_000

export type SolarHouseData = { deals: Deal[]; people: Person[]; leads: Lead[]; activities: Activity[] }

export function generateSolarHouse(now = Date.now(), months = 4): SolarHouseData {
  const r = prng(20260924)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const between = (a: number, b: number) => a + r() * (b - a)
  const weighted = <T,>(opts: [T, number][]) => { const tot = opts.reduce((s, [, w]) => s + w, 0); let x = r() * tot; for (const [v, w] of opts) { if ((x -= w) <= 0) return v } return opts[0][0] }

  const deals: Deal[] = [], people: Person[] = [], leads: Lead[] = [], activities: Activity[] = []
  const total = Math.round(100 * months * 1.02)
  const span = months * 30 * DAY
  // Enquiries arrive through the window, a little busier recently (marketing ramp).
  const arrivals = Array.from({ length: total }, () => now - span * Math.pow(r(), 1.08)).sort((a, b) => a - b)

  arrivals.forEach((t0, i) => {
    const showroom = weighted<Showroom>([['cardiff', 35], ['cheltenham', 30], ['gloucester', 20], ['melksham', 15]])
    const [town, district] = pick(AREAS[showroom])
    const first = pick(FIRST), surname = pick(LAST)
    const couple = r() < 0.35
    const name = couple ? `${first} & ${pick(FIRST)} ${surname}` : `${first} ${surname}`
    const street = `${Math.floor(between(1, 140))} ${pick(STREETS)}`
    const postcode = `${district} ${Math.floor(between(1, 9))}${String.fromCharCode(65 + Math.floor(r() * 26))}${String.fromCharCode(65 + Math.floor(r() * 26))}`
    const address = `${street}, ${town} ${postcode}`
    const phone = `07${Math.floor(between(700, 999))} ${Math.floor(between(100000, 999999))}`
    const email = `${first.toLowerCase()}.${surname.toLowerCase()}${Math.floor(r() * 90)}@${pick(['gmail.com', 'outlook.com', 'btinternet.com', 'hotmail.co.uk', 'icloud.com'])}`
    const owner = pick(ADVISERS[showroom])
    const source = showroom === 'melksham' && r() < 0.3 ? 'Leekes in-store' : weighted(SOURCES)
    const propType = weighted([['Semi-detached', 38], ['Detached', 32], ['Terraced', 14], ['Bungalow', 16]])
    const annualKwh = Math.round(between(2600, 6800) / 100) * 100
    const hasEv = r() < 0.28
    const property = { type: propType, bedrooms: propType === 'Detached' ? pick([3, 4, 4, 5]) : pick([2, 3, 3, 4]), roofAspect: weighted([['South', 34], ['South-west', 20], ['South-east', 18], ['East/West', 24], ['North (split)', 4]]), annualKwh, monthlyBill: Math.round((annualKwh * 0.245) / 12 + 12), heating: weighted([['Mains gas', 72], ['Oil', 10], ['Electric', 10], ['LPG', 4], ['Heat pump', 4]]), hasEv }

    // System design (becomes real at proposal)
    const panels = Math.max(8, Math.min(22, Math.round(annualKwh / 390 + between(-2, 3))))
    const kwp = +(panels * 0.45).toFixed(2)
    const batteryKwh = r() < 0.82 ? pick([5, 9.5, 10, 13.5, 15]) : 0
    const evCharger = hasEv && r() < 0.6
    const price = Math.round((3400 + kwp * 980 + batteryKwh * 520 + (evCharger ? 1050 : 0)) / 50) * 50
    const system = { kwp, panels, panelModel: pick(['Aiko Neostar 2P 450W', 'JA Solar 445W Black', 'Trina Vertex S+ 450W']), inverter: batteryKwh ? pick(['Sigenergy SigenStor', 'GivEnergy All-in-One', 'SolarEdge Home Hub']) : pick(['SolarEdge HD-Wave', 'GivEnergy Gen 3']), batteryKwh, evCharger, price, finance: weighted([['Cash', 55], ['0% over 5 yrs', 20], ['9.9% APR over 10 yrs', 25]]) }

    // ── walk the journey ──
    const steps: JourneyStep[] = []
    let t = t0, lost = false, lostReason = ''
    const add = (key: JourneyKey, at: number, data: JourneyStep['data'], by?: string, notes?: string) => { steps.push({ key, at, by, data, notes }) }
    const done = (at: number) => { const s = steps[steps.length - 1]; if (s && at <= now) s.done = at }
    const reach = (p: number, gapLo: number, gapHi: number) => {
      const next = t + between(gapLo, gapHi) * DAY
      if (r() > p) { if (now - t > 35 * DAY) { lost = true; lostReason = pick(LOST_REASONS) } return null }
      return next
    }

    const responseMins = Math.round(Math.pow(r(), 2) * 600 + 4)
    add('enquiry', t0, { channel: source, message: pick(['Interested in solar and battery', 'Want to cut our bills', 'Got an EV, want to charge from solar', 'Looking at a battery for our existing panels', 'Please call me back about a quote']), response: `${responseMins < 60 ? `${responseMins} min` : `${Math.round(responseMins / 60)} h`}` }, source)
    let n1 = reach(0.93, 0.02, 2)
    if (n1 && n1 <= now) {
      done(n1); t = n1
      add('contacted', t, { method: pick(['Phone call', 'Phone call', 'WhatsApp', 'Email']), outcome: pick(['Keen, wants a quote', 'Booked consultation', 'Sent bill info', 'Interested, comparing options']), annualKwh, monthlyBill: `£${property.monthlyBill}` }, owner)
      const n2 = reach(0.8, 2, 12)
      if (n2 && n2 <= now) {
        done(n2); t = n2
        const cType = source === 'Showroom walk-in' || source === 'Leekes in-store' ? 'Showroom visit' : weighted([['Showroom visit', 45], ['Home visit', 35], ['Video call', 20]])
        add('consultation', t, { type: cType, where: cType === 'Showroom visit' ? `${SHOWROOM_META[showroom].name} showroom` : cType === 'Home visit' ? 'At the property' : 'Teams', attendees: couple ? 'Both homeowners' : 'Homeowner', interest: batteryKwh ? 'Solar + battery' : 'Solar only' }, owner)
        const n3 = reach(0.92, 1, 5)
        if (n3 && n3 <= now) {
          done(n3); t = n3
          add('proposal', t, { version: r() < 0.3 ? 'v2' : 'v1', system: `${kwp} kWp · ${panels} panels${batteryKwh ? ` · ${batteryKwh} kWh battery` : ''}${evCharger ? ' · EV charger' : ''}`, price: `£${price.toLocaleString()}`, finance: system.finance, views: Math.floor(between(1, 9)), saving: `£${Math.round(annualKwh * 0.62 * 0.245 + 90)}/yr` }, owner)
          const n4 = reach(0.8, 7, 30)
          if (n4 && n4 <= now) {
            done(n4); t = n4
            const surveyor = pick(SURVEYORS)
            add('survey', t, { surveyor, roof: pick(['Concrete tile, good condition', 'Slate, good condition', 'Clay tile, minor repairs', 'Concrete tile, fair']), scaffold: pick(['Standard', 'Standard', 'Needs bridging over conservatory']), shading: pick(['None', 'Minor (chimney)', 'Tree to west, afternoons']), consumerUnit: pick(['OK', 'OK', 'Needs upgrade (+£450)']), photos: Math.floor(between(18, 46)) }, surveyor)
            const n5 = reach(0.9, 2, 10)
            if (n5 && n5 <= now) {
              done(n5); t = n5
              add('signed', t, { contract: `TSH-${24000 + i}`, deposit: `£${Math.round(price * 0.25).toLocaleString()}`, payment: system.finance === 'Cash' ? pick(['Bank transfer', 'Card']) : 'Finance approved', signedVia: pick(['DocuSign', 'In showroom']) }, owner)
              done(t + between(0, 1) * DAY)
              const dnoAt = t + between(1, 3) * DAY
              if (dnoAt <= now) {
                const g99 = kwp + batteryKwh * 0.4 > 7
                const approved = dnoAt + (g99 ? between(12, 30) : between(0.5, 2)) * DAY
                const installAt = t + between(24, 46) * DAY
                add('dno', dnoAt, { form: g99 ? 'G99' : 'G98', network: showroom === 'melksham' ? 'SSEN' : 'NGED', reference: `${showroom === 'melksham' ? 'SSEN' : 'NGED'}-${Math.floor(between(4000000, 4999999))}`, approved: approved <= now ? new Date(approved).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Awaiting', installBooked: new Date(installAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }, 'Ops team')
                if (approved <= now) done(Math.max(approved, dnoAt))
                if (approved <= now && installAt <= now + 21 * DAY) {
                  // Install is visible once booked (future dates show as "booked for").
                  add('install', installAt, { team: TEAMS[showroom], days: kwp > 6 ? 2 : 1, scaffold: 'Up 2 days before', commissioning: installAt <= now ? 'Commissioned' : 'Booked' }, TEAMS[showroom])
                  const finished = installAt + (kwp > 6 ? 2 : 1) * DAY
                  if (finished <= now) {
                    done(finished)
                    const hand = finished + between(1, 5) * DAY
                    if (hand <= now) {
                      add('handover', hand, { mcs: `MCS-${Math.floor(between(1000000, 9999999))}`, portal: 'Live', firstGen: `${Math.round(between(8, 34))} kWh day one`, review: pick(['5★ Google', '5★ Google', 'Requested', 'Requested', '5★ Trustpilot']) }, owner)
                      done(hand + between(0, 3) * DAY)
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    void n1

    const last = steps[steps.length - 1]
    const stageIdx = Math.min(5, JOURNEY.findIndex((j) => j.key === last.key))
    const signed = steps.some((s) => s.key === 'signed')
    const stage = SH_STAGES[signed ? 5 : stageIdx]
    const daysInStage = (now - last.at) / DAY
    const health = signed ? 'Healthy' : daysInStage > 14 ? 'Stalled' : daysInStage > 6 ? 'At risk' : r() < 0.12 ? 'No next step' : 'Healthy'
    const id = `d${i + 1}`, pid = `p${i + 1}`
    const reachedProposal = steps.some((s) => s.key === 'proposal')

    const nextAction = lost || (signed && steps.some((s) => s.key === 'handover' && s.done)) ? undefined : (() => {
      const k = last.key
      const label = { enquiry: 'Call back within the hour', contacted: 'Book consultation', consultation: 'Send proposal', proposal: 'Follow up on proposal', survey: 'Send contract', signed: 'Submit DNO application', dno: 'Confirm install date', install: 'Complete install checklist', handover: 'Request review' }[k]
      const due = now + between(-3, 5) * DAY
      return { label, due }
    })()

    const journey: Journey = { showroom, source, address, postcode, phone, email, property, system: reachedProposal ? system : undefined, steps, nextAction }
    deals.push({
      id, name, org: `${street}, ${town}`, subtitle: reachedProposal ? `${kwp} kWp${batteryKwh ? ` + ${batteryKwh} kWh battery` : ''}` : `${property.type} · ${property.roofAspect} roof`,
      value: reachedProposal ? price : Math.round(price / 500) * 500, stage, closeDate: new Date(Math.max(now, t) + 14 * DAY).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      owner, health, chips: [{ label: SHOWROOM_META[showroom].name, tone: 'neutral' }], personIds: [pid], probability: signed ? 100 : STAGE_PROB[stageIdx],
      won: signed || undefined, lost: lost || undefined, lostReason: lost ? lostReason : undefined, quoted: reachedProposal || undefined, journey,
    })
    people.push({ id: pid, name, role: 'Homeowner', org: `${street}, ${town}`, phone, email, owner, labels: [SHOWROOM_META[showroom].name, ...(signed ? ['Customer'] : [])] })

    // Lead inbox: the last ~10 days of enquiries.
    if (now - t0 < 10 * DAY) {
      leads.push({ id: `l${i + 1}`, name, role: 'Homeowner', company: address, source, owner, created: relWhen(now - t0), createdAt: t0, score: Math.round(between(45, 96)), status: stageIdx === 0 ? 'new' : stageIdx < 3 ? 'working' : 'qualified', email, phone, value: price, converted: stageIdx > 0 || undefined })
    }

    // Tasks: one live next action per open customer, plus the history of what was done.
    if (nextAction && !lost) {
      const d = new Date(nextAction.due)
      activities.push({ id: `t${i + 1}`, type: last.key === 'enquiry' ? 'call' : 'task', subject: `${nextAction.label} — ${name}`, dealId: id, personId: pid, due: relDue(nextAction.due - now), dueDate: d.toISOString().slice(0, 10), done: false, priority: last.key === 'enquiry' || health === 'Stalled' ? 'High' : 'Medium', who: owner, createdAt: last.at, source: 'ai' })
    }
    steps.filter((s) => s.done).slice(-2).forEach((s, k) => {
      activities.push({ id: `h${i + 1}-${k}`, type: s.key === 'contacted' ? 'call' : s.key === 'consultation' ? 'meeting' : 'task', subject: `${JOURNEY.find((j) => j.key === s.key)!.label} — ${name}`, dealId: id, personId: pid, done: true, completedAt: s.done, who: s.by && !s.by.includes('team') ? s.by : owner, createdAt: s.at, source: 'manual' })
    })
  })

  return { deals: deals.reverse(), people, leads: leads.reverse(), activities }
}

function relWhen(ms: number) { const h = ms / 3_600_000; return h < 1 ? 'Just now' : h < 24 ? `${Math.round(h)}h ago` : h < 48 ? 'Yesterday' : `${Math.round(h / 24)} days ago` }
function relDue(ms: number) { const d = Math.round(ms / DAY); return d < -1 ? `${-d} days overdue` : d === -1 ? 'Yesterday' : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days` }
