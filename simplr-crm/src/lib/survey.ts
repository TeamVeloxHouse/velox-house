/* Domestic site-survey engine — the data-driven spec the mobile capture wizard renders from, plus
 * completeness scoring and the mappers that turn a submitted survey into DNO site details.
 *
 * Modelled on how market-leading field apps (Scoop et al.) structure a domestic survey: a guided,
 * section-per-screen flow with required fields + forced photo prompts, covering everything the best
 * UK installers capture — solar, battery, EV and heat pump. Answers are stored flat (keyed by the
 * field ids below) so adding a question is a one-line edit here, not a schema change. */
import type { SiteSurvey, SurveyProductKey, RoofFace, DnoApplication } from '../store/types'

export type FieldType = 'text' | 'number' | 'select' | 'textarea' | 'toggle'
export interface SurveyField {
  id: string // e.g. 'elec.mainFuse'
  label: string
  type: FieldType
  options?: string[]
  unit?: string
  required?: boolean
  placeholder?: string
  hint?: string
}
export interface PhotoSlot { key: string; label: string; required?: boolean }
export interface SurveySection {
  key: string
  title: string
  emoji: string
  blurb: string
  product?: SurveyProductKey // shown only when this product is in scope (undefined = always)
  roof?: boolean // special repeatable roof-face step
  fields: SurveyField[]
  photos: PhotoSlot[]
}

export const SURVEY_PRODUCTS: { key: SurveyProductKey; label: string; emoji: string }[] = [
  { key: 'solar', label: 'Solar PV', emoji: '☀️' },
  { key: 'battery', label: 'Battery storage', emoji: '🔋' },
  { key: 'ev', label: 'EV charger', emoji: '🚗' },
  { key: 'ashp', label: 'Heat pump', emoji: '♨️' },
  { key: 'hotwater', label: 'Hot water / diverter', emoji: '🚿' },
]
export const productLabel = (k: SurveyProductKey) => SURVEY_PRODUCTS.find((p) => p.key === k)?.label ?? k
export const productEmoji = (k: SurveyProductKey) => SURVEY_PRODUCTS.find((p) => p.key === k)?.emoji ?? '•'

// ── The survey spec ─────────────────────────────────────────────────────────
export const SURVEY_SECTIONS: SurveySection[] = [
  {
    key: 'property', title: 'Property & access to home', emoji: '🏠', blurb: 'Confirm the property and who we spoke to.',
    fields: [
      { id: 'prop.type', label: 'Property type', type: 'select', required: true, options: ['Detached', 'Semi-detached', 'Terraced', 'End terrace', 'Bungalow', 'Flat / maisonette', 'Other'] },
      { id: 'prop.age', label: 'Construction era', type: 'select', options: ['Pre-1919', '1919–1944', '1945–1964', '1965–1980', '1981–2000', 'Post-2000'] },
      { id: 'prop.tenure', label: 'Tenure', type: 'select', options: ['Owner-occupied', 'Private rental', 'Housing association', 'Other'] },
      { id: 'prop.present', label: 'Homeowner present at survey', type: 'toggle' },
      { id: 'prop.listed', label: 'Listed building / conservation area', type: 'toggle', hint: 'May affect planning' },
      { id: 'prop.notes', label: 'Notes', type: 'textarea', placeholder: 'Parking, keysafe, dogs, anything the install crew should know…' },
    ],
    photos: [{ key: 'front-elevation', label: 'Front of property', required: true }],
  },
  {
    key: 'roof', title: 'Roof', emoji: '🧱', blurb: 'Add each roof face we could put panels on.', product: 'solar', roof: true,
    fields: [], photos: [],
  },
  {
    key: 'shading', title: 'Shading', emoji: '🌤️', blurb: 'What blocks the sun, and roughly how much.', product: 'solar',
    fields: [
      { id: 'shade.level', label: 'Overall shading', type: 'select', required: true, options: ['None', 'Light', 'Moderate', 'Heavy'] },
      { id: 'shade.sources', label: 'Shading sources', type: 'text', placeholder: 'Trees, chimney, neighbouring house, dormer…' },
      { id: 'shade.loss', label: 'Estimated annual yield loss', type: 'number', unit: '%' },
    ],
    photos: [{ key: 'horizon', label: 'Horizon from array location', required: true }],
  },
  {
    key: 'loft', title: 'Loft & roof structure', emoji: '🪜', blurb: 'The structural (MCS MIS 3002) check.', product: 'solar',
    fields: [
      { id: 'loft.rafter', label: 'Rafter size', type: 'text', placeholder: 'e.g. 47 × 100 mm' },
      { id: 'loft.spacing', label: 'Rafter spacing (centres)', type: 'number', unit: 'mm' },
      { id: 'loft.membrane', label: 'Felt / membrane present', type: 'toggle' },
      { id: 'loft.condition', label: 'Structure condition', type: 'select', options: ['Good', 'Fair', 'Poor — flag'] },
      { id: 'loft.access', label: 'Loft access', type: 'select', options: ['Easy', 'Restricted', 'None'] },
      { id: 'loft.notes', label: 'Notes', type: 'textarea', placeholder: 'Spread, sag, damp, woodworm, insulation depth…' },
    ],
    photos: [{ key: 'rafters', label: 'Rafters / structure', required: true }, { key: 'defect', label: 'Any defect', required: false }],
  },
  {
    key: 'electrical', title: 'Electrics & consumer unit', emoji: '⚡', blurb: 'The DNO-critical detail — get this right.',
    fields: [
      { id: 'elec.mainFuse', label: 'Main fuse rating', type: 'select', required: true, options: ['60 A', '80 A', '100 A', 'Unknown'] },
      { id: 'elec.phase', label: 'Supply phase', type: 'select', required: true, options: ['Single phase', 'Three phase'] },
      { id: 'elec.meter', label: 'Meter type', type: 'select', options: ['Smart (SMETS2)', 'Smart (SMETS1)', 'Traditional', 'Economy 7'] },
      { id: 'elec.earthing', label: 'Earthing arrangement', type: 'select', required: true, options: ['TN-S', 'TN-C-S (PME)', 'TT'] },
      { id: 'elec.spareWays', label: 'Spare ways in consumer unit', type: 'number' },
      { id: 'elec.existingGen', label: 'Existing generation on site', type: 'toggle', hint: 'Solar/battery already fitted — affects G98/G99' },
      { id: 'elec.existingGenKw', label: 'Existing generation size', type: 'number', unit: 'kW' },
      { id: 'elec.inverterLoc', label: 'Proposed inverter location', type: 'text', required: true, placeholder: 'Loft / garage / utility…' },
      { id: 'elec.isolatorLoc', label: 'Proposed isolator location', type: 'text', placeholder: 'Beside meter / external…' },
      { id: 'elec.cableRun', label: 'Cable run: CU → inverter', type: 'number', unit: 'm' },
    ],
    photos: [{ key: 'consumer-unit', label: 'Consumer unit (open)', required: true }, { key: 'meter', label: 'Meter & main fuse', required: true }, { key: 'earthing', label: 'Earthing point', required: false }],
  },
  {
    key: 'battery', title: 'Battery storage', emoji: '🔋', blurb: 'Where the battery goes and how it connects.', product: 'battery',
    fields: [
      { id: 'bat.location', label: 'Proposed location', type: 'text', required: true, placeholder: 'Garage / utility / loft / external' },
      { id: 'bat.env', label: 'Indoor / outdoor', type: 'select', options: ['Indoor', 'Garage', 'Outdoor (IP-rated)'] },
      { id: 'bat.wall', label: 'Mounting surface', type: 'select', options: ['Brick', 'Block', 'Plasterboard + noggins', 'Floor-stand', 'Other'] },
      { id: 'bat.distance', label: 'Distance to consumer unit', type: 'number', unit: 'm' },
      { id: 'bat.backup', label: 'Backup / EPS required', type: 'toggle' },
      { id: 'bat.notes', label: 'Notes', type: 'textarea', placeholder: 'Ventilation, temperature, access…' },
    ],
    photos: [{ key: 'battery-loc', label: 'Proposed battery location', required: true }],
  },
  {
    key: 'ev', title: 'EV charger', emoji: '🚗', blurb: 'Charge point position and supply.', product: 'ev',
    fields: [
      { id: 'ev.location', label: 'Charger location', type: 'text', required: true },
      { id: 'ev.parking', label: 'Parking', type: 'select', options: ['Off-street driveway', 'Garage', 'On-street', 'Shared'] },
      { id: 'ev.distance', label: 'Distance to consumer unit', type: 'number', unit: 'm' },
      { id: 'ev.mount', label: 'Mounting', type: 'select', options: ['Wall', 'Post / pedestal'] },
      { id: 'ev.tethered', label: 'Type', type: 'select', options: ['Tethered', 'Untethered (socket)'] },
      { id: 'ev.loadmgmt', label: 'Load management / CT clamp needed', type: 'toggle' },
    ],
    photos: [{ key: 'ev-loc', label: 'Charger location & route', required: true }],
  },
  {
    key: 'heatpump', title: 'Heat pump', emoji: '♨️', blurb: 'Heat loss, emitters and the outdoor unit.', product: 'ashp',
    fields: [
      { id: 'hp.floorArea', label: 'Total floor area', type: 'number', unit: 'm²', required: true },
      { id: 'hp.existing', label: 'Existing heating', type: 'select', required: true, options: ['Gas boiler', 'Oil', 'LPG', 'Electric', 'Solid fuel', 'Other'] },
      { id: 'hp.emitters', label: 'Emitters', type: 'select', options: ['Radiators', 'Underfloor', 'Mixed'] },
      { id: 'hp.emitterUpgrade', label: 'Emitter suitability', type: 'select', options: ['Adequate as-is', 'Some upgrades', 'Full upgrade needed'] },
      { id: 'hp.insulation', label: 'Insulation level', type: 'select', options: ['Good', 'Average', 'Poor'] },
      { id: 'hp.cylinderSpace', label: 'Space for hot-water cylinder', type: 'toggle' },
      { id: 'hp.cylinderLoc', label: 'Cylinder location', type: 'text', placeholder: 'Airing cupboard / utility…' },
      { id: 'hp.unitLoc', label: 'Outdoor unit location', type: 'text', required: true },
      { id: 'hp.clearance', label: 'Clearances & noise OK (MCS 020)', type: 'toggle' },
      { id: 'hp.condensate', label: 'Condensate route', type: 'text' },
    ],
    photos: [{ key: 'hp-boiler', label: 'Existing boiler / cylinder', required: true }, { key: 'hp-unit', label: 'Outdoor unit location', required: true }, { key: 'hp-emitters', label: 'Representative emitters', required: false }],
  },
  {
    key: 'hotwater', title: 'Hot water', emoji: '🚿', blurb: 'Existing hot water and diverter options.', product: 'hotwater',
    fields: [
      { id: 'hw.type', label: 'Current hot water', type: 'select', options: ['Combi boiler', 'Cylinder', 'Immersion', 'Other'] },
      { id: 'hw.diverter', label: 'Solar hot-water diverter wanted', type: 'toggle' },
    ],
    photos: [],
  },
  {
    key: 'access', title: 'Access, scaffold & H&S', emoji: '🚧', blurb: 'What the install crew will need on the day.',
    fields: [
      { id: 'acc.scaffoldSides', label: 'Scaffold — sides needed', type: 'number' },
      { id: 'acc.scaffoldHeight', label: 'Scaffold — height', type: 'number', unit: 'm' },
      { id: 'acc.fragile', label: 'Fragile roof covering', type: 'toggle' },
      { id: 'acc.asbestos', label: 'Asbestos suspected', type: 'toggle', hint: 'Flag for a survey before works' },
      { id: 'acc.parking', label: 'Parking / welfare', type: 'select', options: ['Good', 'Limited', 'None — needs planning'] },
      { id: 'acc.hazards', label: 'Hazards & notes', type: 'textarea', placeholder: 'Overhead lines, restricted access, skip location…' },
    ],
    photos: [{ key: 'access', label: 'Access / street view', required: false }],
  },
]

/** Sections that apply to a survey given the products in scope (always-on sections + matching products). */
export function sectionsFor(products: SurveyProductKey[]): SurveySection[] {
  return SURVEY_SECTIONS.filter((s) => !s.product || products.includes(s.product))
}

export const COVERINGS = ['Slate', 'Concrete tile', 'Clay tile', 'Metal', 'Felt (flat)', 'EPDM (flat)', 'Other']
export const CONDITIONS = ['Good', 'Fair', 'Poor — flag']

/** Compass label from degrees-from-north. */
export function compass8(deg?: number): string {
  if (deg == null) return '—'
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8]
}

// ── Completeness ─────────────────────────────────────────────────────────────
export interface Completeness { pct: number; done: number; total: number; missing: string[] }
/** Required-field + required-photo coverage across the sections in scope. Roof counts as complete
 *  once at least one face has orientation + pitch. */
export function completeness(s: SiteSurvey): Completeness {
  const sections = sectionsFor(s.products)
  const missing: string[] = []
  let total = 0, done = 0
  for (const sec of sections) {
    if (sec.roof) {
      total += 1
      const ok = s.roof.length > 0 && s.roof.every((f) => f.orientationDeg != null && f.pitchDeg != null)
      if (ok) done += 1
      else missing.push(s.roof.length === 0 ? 'Roof: add at least one face' : 'Roof: each face needs orientation + pitch')
      continue
    }
    for (const f of sec.fields) {
      if (!f.required) continue
      total += 1
      if ((s.answers[f.id] ?? '').trim()) done += 1
      else missing.push(`${sec.title}: ${f.label}`)
    }
    for (const p of sec.photos) {
      if (!p.required) continue
      total += 1
      if (s.photos.some((ph) => ph.section === sec.key && ph.key === p.key && ph.captured)) done += 1
      else missing.push(`${sec.title}: photo — ${p.label}`)
    }
  }
  return { pct: total === 0 ? 100 : Math.round((done / total) * 100), done, total, missing }
}

/** Build the photo slots a survey should hold for its products (used to seed the capture trays). */
export function photoSlotsFor(products: SurveyProductKey[]): { section: string; key: string; label: string; required?: boolean }[] {
  return sectionsFor(products).flatMap((sec) => sec.photos.map((p) => ({ section: sec.key, ...p })))
}

// ── DNO pre-fill ─────────────────────────────────────────────────────────────
/** Map a submitted survey's electrical answers onto DNO site details (CLRD-parity fields). */
export function surveyToDnoSite(s: SiteSurvey): Partial<DnoApplication> {
  const a = s.answers
  const phase: 1 | 3 = a['elec.phase'] === 'Three phase' ? 3 : 1
  return {
    phase,
    installLocation: a['elec.inverterLoc'] || undefined,
    isolatorLocation: a['elec.isolatorLoc'] || undefined,
    preExisting: a['elec.existingGen'] === 'true',
  }
}

/** Plain-English risk flags Ovi / the office team should see from a submitted survey. */
export function surveyFlags(s: SiteSurvey): string[] {
  const a = s.answers
  const flags: string[] = []
  if (a['elec.earthing'] === 'TT') flags.push('TT earthing — additional earth electrode likely required')
  if (a['elec.mainFuse'] === '60 A') flags.push('60 A main fuse — check headroom before sizing the inverter')
  if (a['elec.existingGen'] === 'true') flags.push('Existing generation on site — cumulative G98/G99 assessment needed')
  if (a['loft.condition'] === 'Poor — flag') flags.push('Roof structure poor — structural sign-off before install')
  if (a['acc.asbestos'] === 'true') flags.push('Asbestos suspected — survey before any works')
  if (a['acc.fragile'] === 'true') flags.push('Fragile roof — edge protection / crawl boards required')
  if (a['shade.level'] === 'Heavy') flags.push('Heavy shading — validate yield and consider optimisers')
  if (a['hp.emitterUpgrade'] === 'Full upgrade needed') flags.push('Heat pump: full emitter upgrade needed — reflect in quote')
  return flags
}

let rc = 0
export const surveyRef = () => `SUR-${(2100 + Date.now() % 9000 + rc++).toString().slice(-4)}`
export const newRoofFace = (name: string): RoofFace => ({ id: `rf${Date.now().toString(36)}${rc++}`, name })
