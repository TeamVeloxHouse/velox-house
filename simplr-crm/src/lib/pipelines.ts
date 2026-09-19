import type { Pipeline, PipelineStage, Features, ID } from '../store/types'

/** A ramp from a light entry blue through the brand blue to a closing green. */
const RAMP = ['#A7E6DA', '#6FD3BE', '#1FAE94', '#13927B', '#0E8C79', '#0A5F52']
export function stageColor(i: number, n: number): string {
  if (n <= 1) return RAMP[RAMP.length - 1]
  const t = i / (n - 1)
  const idx = Math.round(t * (RAMP.length - 1))
  return RAMP[idx]
}

let sc = 0
const sid = () => `st${Date.now().toString(36)}${sc++}`

export function makeStages(defs: { name: string; probability: number }[]): PipelineStage[] {
  return defs.map((d, i) => ({ id: sid(), name: d.name, probability: d.probability, color: stageColor(i, defs.length) }))
}

export type IndustryTemplate = {
  key: string
  name: string
  emoji: string
  desc: string
  stages: { name: string; probability: number }[]
  features: Features
}

const F = (jobs: boolean, studio: boolean, reach = true, compliance = false, inventory = false): Features => ({ jobs, studio, reach, compliance, inventory })

// Curated starting pipelines across common SME shapes — trade and non-trade.
export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  { key: 'general', name: 'General B2B sales', emoji: '💼', desc: 'A clean, universal sales pipeline for any business.', features: F(false, false),
    stages: [{ name: 'New lead', probability: 10 }, { name: 'Qualified', probability: 30 }, { name: 'Proposal sent', probability: 55 }, { name: 'Negotiation', probability: 78 }, { name: 'Verbal yes', probability: 90 }] },
  { key: 'solar', name: 'Solar & renewables', emoji: '☀️', desc: 'Survey-to-install pipeline with design & delivery.', features: F(true, true),
    stages: [{ name: 'Qualified', probability: 20 }, { name: 'Contact Made', probability: 30 }, { name: 'Demo Scheduled', probability: 45 }, { name: 'Proposal Made', probability: 65 }, { name: 'Negotiations Started', probability: 80 }] },
  { key: 'trades', name: 'Trade services', emoji: '🔧', desc: 'Roofing, HVAC, electrical — enquiry to job done.', features: F(true, false, true, true),
    stages: [{ name: 'Enquiry', probability: 15 }, { name: 'Site survey', probability: 35 }, { name: 'Quote sent', probability: 60 }, { name: 'Follow-up', probability: 75 }, { name: 'Won', probability: 92 }] },
  { key: 'agency', name: 'Agency & creative', emoji: '🎨', desc: 'Studios, marketing & design agencies.', features: F(false, false),
    stages: [{ name: 'New enquiry', probability: 15 }, { name: 'Discovery call', probability: 35 }, { name: 'Proposal', probability: 55 }, { name: 'Pitch', probability: 75 }, { name: 'Won', probability: 90 }] },
  { key: 'recruitment', name: 'Recruitment', emoji: '🧑‍💼', desc: 'Agencies filling roles, candidate to placement.', features: F(false, false),
    stages: [{ name: 'New role', probability: 10 }, { name: 'Sourcing', probability: 30 }, { name: 'Shortlist', probability: 50 }, { name: 'Interviews', probability: 70 }, { name: 'Offer / placed', probability: 90 }] },
  { key: 'saas', name: 'SaaS & software', emoji: '💻', desc: 'Product-led or sales-led software teams.', features: F(false, false),
    stages: [{ name: 'Signed up', probability: 15 }, { name: 'Qualified', probability: 35 }, { name: 'Demo', probability: 55 }, { name: 'Trial / POC', probability: 72 }, { name: 'Proposal', probability: 86 }] },
  { key: 'property', name: 'Property & real estate', emoji: '🏠', desc: 'Sales & lettings, enquiry to completion.', features: F(false, false),
    stages: [{ name: 'Enquiry', probability: 15 }, { name: 'Viewing', probability: 35 }, { name: 'Offer', probability: 55 }, { name: 'Under offer', probability: 78 }, { name: 'Exchange', probability: 92 }] },
  { key: 'consulting', name: 'Consulting & services', emoji: '📊', desc: 'Professional services & advisory firms.', features: F(false, false),
    stages: [{ name: 'Lead', probability: 15 }, { name: 'Scoping', probability: 35 }, { name: 'Proposal', probability: 60 }, { name: 'Contracting', probability: 80 }, { name: 'Signed', probability: 92 }] },
  { key: 'wholesale', name: 'Wholesale & e-commerce', emoji: '📦', desc: 'Product businesses & B2B wholesale.', features: F(false, false, true, false, true),
    stages: [{ name: 'Enquiry', probability: 15 }, { name: 'Samples sent', probability: 35 }, { name: 'Quote', probability: 55 }, { name: 'Negotiation', probability: 75 }, { name: 'PO received', probability: 90 }] },
]

export const templateByKey = (key: string) => INDUSTRY_TEMPLATES.find((t) => t.key === key)

/** Build a full Pipeline object from a template. */
export function pipelineFromTemplate(t: IndustryTemplate, id: ID, name?: string): Pipeline {
  return { id, name: name ?? t.name, stages: makeStages(t.stages) }
}
