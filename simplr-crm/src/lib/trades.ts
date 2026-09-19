import type { TradeKey, TradeProfile, Features, JobKind } from '../store/types'

// The per-industry configuration layer. Picking a trade at signup seeds these
// defaults — job types, survey template, compliance checklist, product
// categories, estimator unit and which modules are switched on. Everything
// stays editable afterwards in Settings → Trade & modules. Adding a new
// vertical is a new entry here, not a new release.

const ON: Features = { jobs: true, studio: true, reach: true, compliance: true, inventory: true }
const feat = (patch: Partial<Features>): Features => ({ ...ON, ...patch })

const jt = (key: JobKind, label: string, defaultMins: number) => ({ key, label, defaultMins })

export const TRADE_PROFILES: TradeProfile[] = [
  {
    key: 'solar',
    name: 'Solar PV & battery',
    tagline: 'Design, quote and install solar, batteries & EV',
    emoji: '☀️',
    accent: '#F5A623',
    jobTypes: [
      jt('survey', 'Site survey', 90),
      jt('showroom', 'Showroom / home consult', 60),
      jt('install', 'Install', 480),
      jt('service', 'Service / monitoring visit', 60),
      jt('remedial', 'Remedial / callback', 120),
    ],
    surveyChecklist: ['Roof pitch & orientation', 'Roof area & shading', 'Meter position & main fuse', 'Consumer unit / spare way', 'Loft access & rafter condition', 'Scaffold requirement', 'Battery / inverter location', 'Existing generation (MCS)'],
    compliance: ['MCS certificate', 'DNO G98/G99 application', 'Building Control notice', 'Electrical (Part P) cert', 'HIES / RECC', 'Handover pack'],
    productCategories: ['Panels', 'Inverters', 'Batteries', 'Mounting', 'EV chargers', 'Cabling & isolators'],
    estimatorUnit: '£/kWp',
    features: feat({}),
  },
  {
    key: 'hvac',
    name: 'HVAC & heat pumps',
    tagline: 'Heat pumps, AC, boilers & servicing',
    emoji: '🌡️',
    accent: '#2FA4B5',
    jobTypes: [
      jt('survey', 'Heat-loss survey', 120),
      jt('showroom', 'Home consultation', 60),
      jt('install', 'Install', 600),
      jt('service', 'Annual service', 60),
      jt('remedial', 'Breakdown / repair', 90),
    ],
    surveyChecklist: ['Room-by-room heat loss', 'Existing system & fuel', 'Radiator / emitter sizing', 'Cylinder & airing space', 'Pipework & flow rate', 'Outdoor unit location & noise', 'Electrical supply & spare load', 'Flue / condensate route'],
    compliance: ['MCS certificate (heat pump)', 'Gas Safe / Building Regs notice', 'F-gas certificate', 'Benchmark commissioning', 'BUS grant paperwork', 'Handover pack'],
    productCategories: ['Heat pumps', 'AC units', 'Boilers', 'Cylinders', 'Radiators & emitters', 'Controls & thermostats'],
    estimatorUnit: '£/kW',
    features: feat({ studio: false }),
  },
  {
    key: 'roofing',
    name: 'Roofing',
    tagline: 'Re-roofs, repairs, flat roofs & guttering',
    emoji: '🏠',
    accent: '#C2703D',
    jobTypes: [
      jt('survey', 'Roof survey', 60),
      jt('showroom', 'Quote appointment', 45),
      jt('install', 'Roofing job', 960),
      jt('service', 'Inspection / clean', 60),
      jt('remedial', 'Leak / repair callout', 120),
    ],
    surveyChecklist: ['Roof type & pitch', 'Area (m²) & measurements', 'Covering condition', 'Felt / membrane & battens', 'Flashing & leadwork', 'Guttering & fascias', 'Access & scaffold', 'Waste & skip requirement'],
    compliance: ['Building Control / FENSA-equivalent', 'Work at height RAMS', 'Scaffold handover / TG20', 'Workmanship guarantee', 'Waste transfer note'],
    productCategories: ['Tiles & slates', 'Membrane & felt', 'Battens & timber', 'Leadwork & flashing', 'Guttering', 'Fixings & sealants'],
    estimatorUnit: '£/m²',
    features: feat({ studio: false }),
  },
  {
    key: 'windows',
    name: 'Windows & doors',
    tagline: 'Windows, doors, conservatories & glazing',
    emoji: '🪟',
    accent: '#5B7FC7',
    jobTypes: [
      jt('survey', 'Technical survey', 60),
      jt('showroom', 'Showroom appointment', 60),
      jt('install', 'Fitting', 480),
      jt('service', 'Adjustment / service', 45),
      jt('remedial', 'Warranty callback', 90),
    ],
    surveyChecklist: ['Opening sizes (per aperture)', 'Frame material & colour', 'Glazing spec (U-value)', 'Cill & reveal detail', 'Lintel / structural check', 'Access & parking', 'Old-unit removal & disposal', 'Trickle vent requirement'],
    compliance: ['FENSA / Certass certificate', 'Building Regs compliance', 'CE / UKCA glazing docs', 'Insurance-backed guarantee', 'Handover pack'],
    productCategories: ['Windows', 'Doors', 'Conservatories', 'Glass units', 'Hardware & locks', 'Trims & cills'],
    estimatorUnit: '£/unit',
    features: feat({ studio: false }),
  },
  {
    key: 'ev',
    name: 'EV charging',
    tagline: 'Home & commercial EV charge points',
    emoji: '🔌',
    accent: '#2E9E6B',
    jobTypes: [
      jt('survey', 'Site survey', 45),
      jt('showroom', 'Consultation', 30),
      jt('install', 'Charger install', 240),
      jt('service', 'Service / firmware', 45),
      jt('remedial', 'Fault callout', 90),
    ],
    surveyChecklist: ['Consumer unit & spare way', 'Main fuse rating & load', 'Earthing arrangement (PME/TT)', 'Cable route & length', 'Charger mounting position', 'Wi-Fi / connectivity', 'Off-street parking confirmed', 'DNO notification threshold'],
    compliance: ['Electrical (Part P) cert', 'DNO notification (ENA)', 'OZEV grant paperwork', 'EVHS / commissioning', 'Handover pack'],
    productCategories: ['Chargers', 'Cabling & protection', 'CT clamps & meters', 'Mounting', 'Load management'],
    estimatorUnit: '£/point',
    features: feat({ studio: true }),
  },
  {
    key: 'insulation',
    name: 'Insulation & retrofit',
    tagline: 'Loft, cavity, EWI & whole-house retrofit',
    emoji: '🧱',
    accent: '#8A6BB0',
    jobTypes: [
      jt('survey', 'Retrofit assessment', 120),
      jt('showroom', 'Home consultation', 45),
      jt('install', 'Install', 600),
      jt('service', 'Inspection', 45),
      jt('remedial', 'Remedial visit', 90),
    ],
    surveyChecklist: ['Wall / loft construction', 'Existing insulation & U-values', 'Damp & ventilation check', 'Area (m²) to treat', 'Access & scaffold', 'Party-wall considerations', 'Ventilation strategy', 'PAS 2035 pathway'],
    compliance: ['TrustMark lodgement', 'PAS 2035 / 2030', 'Building Control notice', 'ECO4 / grant paperwork', 'Guarantee (CIGA/SWIGA)', 'Handover pack'],
    productCategories: ['Loft insulation', 'Cavity fill', 'EWI boards & render', 'Membranes', 'Ventilation', 'Fixings'],
    estimatorUnit: '£/m²',
    features: feat({ studio: false }),
  },
  {
    key: 'general',
    name: 'General installer',
    tagline: 'A blank canvas — turn on what you need',
    emoji: '🧰',
    accent: '#5B6472',
    jobTypes: [
      jt('survey', 'Survey', 60),
      jt('showroom', 'Appointment', 60),
      jt('install', 'Job', 480),
      jt('service', 'Service visit', 60),
      jt('remedial', 'Callback', 90),
    ],
    surveyChecklist: ['Scope & measurements', 'Site access', 'Materials required', 'Photos', 'Health & safety notes'],
    compliance: ['Certificate of works', 'RAMS', 'Guarantee', 'Handover pack'],
    productCategories: ['Materials', 'Labour', 'Plant & access', 'Consumables'],
    estimatorUnit: '£/job',
    features: feat({ studio: false }),
  },
]

export const tradeByKey = (key: TradeKey): TradeProfile =>
  TRADE_PROFILES.find((t) => t.key === key) ?? TRADE_PROFILES[TRADE_PROFILES.length - 1]

export const jobKindMeta: Record<JobKind, { label: string; color: string; bg: string }> = {
  survey: { label: 'Survey', color: '#13927B', bg: '#EAF1FE' },
  showroom: { label: 'Appointment', color: '#159C86', bg: '#F0ECFF' },
  install: { label: 'Install', color: '#E8721A', bg: '#FDEEDF' },
  service: { label: 'Service', color: '#0E9F6E', bg: '#E4F6EE' },
  remedial: { label: 'Callback', color: '#B01B4F', bg: '#FCE7EF' },
}
