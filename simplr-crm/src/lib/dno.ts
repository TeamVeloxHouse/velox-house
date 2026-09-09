/* DNO Autopilot — deterministic classification, MPAN→region resolution, ENA register,
   SLD model + document-pack factory. Pure functions over a project; no UI, no store.

   NB (honesty): this is a defensible *simulation* of the ENA/EREC routing used by tools
   like clrd.uk, tuned to reproduce their worked example (single-phase 8 kW ⇒ RC 34.78 A,
   "G99 Type A, does not meet SGI criteria"). Real submission needs the live ENA type-test
   register + a DNO portal/email backend — both are data-source swaps, not rewrites. */
import type {
  DnoApplication, DnoForm, DnoDevice, PvString, DnoDoc, DnoDocKind,
  StudioProject, ProductLine,
} from '../store/types'

// ── GB distribution network operators, keyed by MPAN distributor id ──────────
// The first two digits of the MPAN core ("bottom line") identify the distributor.
export const DNO_REGIONS: { id: string; code: string; name: string }[] = [
  { id: '10', code: 'UKPN-EPN', name: 'UK Power Networks (Eastern)' },
  { id: '11', code: 'NGED-EMID', name: 'National Grid (East Midlands)' },
  { id: '12', code: 'UKPN-LPN', name: 'UK Power Networks (London)' },
  { id: '13', code: 'SPEN-MANW', name: 'SP Energy Networks (Merseyside & N Wales)' },
  { id: '14', code: 'NGED-WMID', name: 'National Grid (West Midlands)' },
  { id: '15', code: 'NPG-NE', name: 'Northern Powergrid (North East)' },
  { id: '16', code: 'ENWL', name: 'Electricity North West' },
  { id: '17', code: 'SSEN-NSCOT', name: 'SSEN (North Scotland)' },
  { id: '18', code: 'SPEN-SPD', name: 'SP Energy Networks (South Scotland)' },
  { id: '19', code: 'UKPN-SPN', name: 'UK Power Networks (South East)' },
  { id: '20', code: 'SSEN-SEB', name: 'SSEN (Southern England)' },
  { id: '21', code: 'NGED-SWALES', name: 'National Grid (South Wales)' },
  { id: '22', code: 'NGED-SWEST', name: 'National Grid (South West)' },
  { id: '23', code: 'NPG-YORKS', name: 'Northern Powergrid (Yorkshire)' },
]

export function resolveDno(mpan?: string): string {
  if (!mpan) return 'Unresolved — enter MPAN'
  const id = mpan.replace(/\D/g, '').slice(0, 2)
  return DNO_REGIONS.find((r) => r.id === id)?.name ?? `IDNO / unlisted (id ${id || '??'})`
}

// A plausible MPAN for a region (demo helper): distributor id + 11 filler digits.
export function sampleMpan(regionId = '20'): string {
  return `${regionId}00012345672`
}

// ── ENA type-test register (bundled sample of common UK kit) ─────────────────
const REGISTER: { make: string; model: string; ref: string; kind: DnoDevice['kind'] }[] = [
  { make: 'Solis', model: 'S6-EH1P8K-L', ref: 'ENA/INV/SOLIS/17422', kind: 'inverter' },
  { make: 'GivEnergy', model: 'Gen3 Hybrid 5.0kW', ref: 'ENA/INV/GIVE/16988', kind: 'inverter' },
  { make: 'Fox ESS', model: 'H1-6.0-E', ref: 'ENA/INV/FOX/17103', kind: 'inverter' },
  { make: 'SolarEdge', model: 'SE8000H', ref: 'ENA/INV/SEDG/15540', kind: 'inverter' },
  { make: 'Enphase', model: 'IQ8HC', ref: 'ENA/INV/ENPH/16240', kind: 'inverter' },
  { make: 'Growatt', model: 'MIN 6000TL-XH', ref: 'ENA/INV/GROW/16775', kind: 'inverter' },
  { make: 'Alpha ESS', model: 'SMILE-G3-S8', ref: 'ENA/INV/ALPHA/17646', kind: 'inverter' },
  { make: 'Tesla', model: 'Powerwall 3', ref: 'ENA/EESS/TSLA/17901', kind: 'battery' },
  { make: 'GivEnergy', model: 'Giv-Bat 5.2', ref: 'ENA/EESS/GIVE/16990', kind: 'battery' },
]

export function matchTypeTest(make: string, model: string): { typeTestRef?: string; onRegister: boolean } {
  const hit = REGISTER.find(
    (r) => r.make.toLowerCase() === make.toLowerCase() &&
      (r.model.toLowerCase() === model.toLowerCase() || model.toLowerCase().includes(r.model.toLowerCase())),
  )
  if (hit) return { typeTestRef: hit.ref, onRegister: true }
  // fall back to a make-level match (still registered, generic ref)
  const makeHit = REGISTER.find((r) => r.make.toLowerCase() === make.toLowerCase())
  if (makeHit) return { typeTestRef: makeHit.ref, onRegister: true }
  return { onRegister: false }
}

export function registerBrands(): string[] {
  return Array.from(new Set(REGISTER.map((r) => r.make)))
}

// ── The classification engine ────────────────────────────────────────────────
export const G98_LIMIT_A = 16 // A per phase — connect-and-notify ceiling (EREC G98)
const SINGLE_V = 230
const THREE_LINE_V = 400

/** Aggregate rated current per phase (A) for a given AC output. */
export function ratedCurrent(totalOutputKw: number, phase: 1 | 3): number {
  const w = totalOutputKw * 1000
  const a = phase === 1 ? w / SINGLE_V : w / (Math.sqrt(3) * THREE_LINE_V)
  return Math.round(a * 100) / 100
}

export interface Classification {
  form: DnoForm
  classification: string
  aggregateRcA: number
  meetsSgi: boolean
  rationale: string
}

/** Deterministic route from AC output + phase + export limit. */
export function classify(opts: {
  totalOutputKw: number
  phase: 1 | 3
  exportLimitKw?: number
  dnoRegion: string
  mpan?: string
}): Classification {
  const { totalOutputKw, phase, exportLimitKw, dnoRegion } = opts
  const rc = ratedCurrent(totalOutputKw, phase)
  const limited = exportLimitKw != null && exportLimitKw < totalOutputKw
  const phaseLabel = phase === 1 ? 'single-phase' : 'three-phase'
  // SGI = within the connect-and-notify current, i.e. G98-eligible micro-gen.
  const meetsSgi = rc <= G98_LIMIT_A

  let form: DnoForm
  let classification: string
  let reason: string

  if (meetsSgi) {
    form = 'G98'
    classification = 'G98 Connect & Notify'
    reason = `${phaseLabel}, ${totalOutputKw} kW ⇒ aggregate RC ${rc} A, within G98's ${G98_LIMIT_A} A/phase limit. Install, then notify the DNO within 28 days.`
  } else {
    // Above G98. Type A up to ~50 kW; Type B beyond (RfG bands, installer-scale approximation).
    const typeA = totalOutputKw <= 50
    form = typeA ? 'G99-A' : 'G99-B'
    classification = typeA ? 'G99 Type A' : 'G99 Type B'
    reason = `${phaseLabel}, ${totalOutputKw} kW ⇒ aggregate RC ${rc} A, exceeds G98's ${G98_LIMIT_A} A/phase — does not meet SGI criteria. ${classification} requires DNO approval before energising.`
  }

  if (limited) {
    reason += ` Export capped at ${exportLimitKw} kW (below ${totalOutputKw} kW) — a G100 export-limitation scheme is attached.`
    if (form === 'G98' && meetsSgi) {
      // G100 overlay can keep a larger array within the G98 band via limiting.
      classification += ' + G100'
    } else {
      classification += ' + G100'
    }
  }

  reason += ` DNO: ${dnoRegion}.`
  return { form: limited ? (form === 'G98' ? 'G100' : form) : form, classification, aggregateRcA: rc, meetsSgi, rationale: reason }
}

// ── SLD model (rule-generated node chain for the diagram renderer) ────────────
export interface SldNode { key: string; label: string; note?: string }
export function buildSldModel(app: Pick<DnoApplication, 'strings' | 'devices' | 'phase' | 'mpan'>): SldNode[] {
  const totalKwp = app.strings.reduce((s, st) => s + (st.panels * st.watts) / 1000, 0)
  const inverters = app.devices.filter((d) => d.kind === 'inverter')
  const battery = app.devices.find((d) => d.kind === 'battery')
  const invLabel = inverters.map((i) => `${i.make} ${i.model}`).join(' + ') || 'Inverter'
  const nodes: SldNode[] = [
    { key: 'array', label: 'PV array', note: `${Math.round(totalKwp * 100) / 100} kWp · ${app.strings.length} string${app.strings.length === 1 ? '' : 's'}` },
    { key: 'dc', label: 'DC isolators' },
    { key: 'inverter', label: invLabel, note: inverters[0]?.typeTestRef },
  ]
  if (battery) nodes.push({ key: 'battery', label: `${battery.make} ${battery.model}`, note: `${battery.capacityKw} kWh storage` })
  nodes.push(
    { key: 'ac', label: 'AC isolator' },
    { key: 'cu', label: 'Consumer unit', note: app.phase === 1 ? 'Single phase' : 'Three phase' },
    { key: 'meter', label: 'Energy meter', note: app.mpan ? `MPAN ${app.mpan}` : undefined },
    { key: 'cutout', label: 'DNO cutout' },
  )
  return nodes
}

// ── Document pack factory ────────────────────────────────────────────────────
let dseq = 100
const did = () => `dn${(dseq++).toString(36)}`
export const stamp = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** The multi-doc pre-install pack for a form, mirroring CLRD's G99_A1_1.pdf naming. */
export function buildDocPack(app: Pick<DnoApplication, 'form'>, kind: DnoDocKind): DnoDoc[] {
  const base = app.form.replace('-', '') // G99A
  const at = stamp()
  if (kind === 'pre-install') {
    return [
      { id: did(), name: `${base}_Application_1.pdf`, kind, pages: 3, generatedAt: at },
      { id: did(), name: `${base}_SingleLineDiagram.pdf`, kind, pages: 1, generatedAt: at },
      { id: did(), name: `${base}_EquipmentSchedule.pdf`, kind, pages: 2, generatedAt: at },
    ]
  }
  if (kind === 'post-install') {
    return [
      { id: did(), name: `${base}_CommissioningCert.pdf`, kind, pages: 2, generatedAt: at },
      { id: did(), name: `${base}_InstallationConfirmation.pdf`, kind, pages: 1, generatedAt: at },
    ]
  }
  return []
}

// ── Build a draft application from a delivery project ─────────────────────────
let eseq = 500
const eid = () => `ev${(eseq++).toString(36)}`

function inferDevices(products: ProductLine[]): DnoDevice[] {
  const devices: DnoDevice[] = []
  // Inverter sized from PV lines; battery from battery lines. Defaults are demo-realistic.
  const hasPv = products.some((p) => /solar|pv/i.test(p.name))
  if (hasPv) {
    const m = matchTypeTest('Solis', 'S6-EH1P8K-L')
    devices.push({ id: 'dev-inv', kind: 'inverter', make: 'Solis', model: 'S6-EH1P8K-L', capacityKw: 8, powerFactor: 1.0, ...m })
  }
  const batt = products.find((p) => /battery|storage/i.test(p.name))
  if (batt) {
    const kwh = parseFloat((batt.detail.match(/([\d.]+)\s*kWh/i) ?? [])[1] ?? '5')
    const m = matchTypeTest('GivEnergy', 'Giv-Bat 5.2')
    devices.push({ id: 'dev-bat', kind: 'battery', make: 'GivEnergy', model: 'Giv-Bat 5.2', capacityKw: kwh, ...m })
  }
  if (products.some((p) => /ev|charger/i.test(p.name))) {
    devices.push({ id: 'dev-ev', kind: 'ev', make: 'Zappi', model: 'v2.1', capacityKw: 7, onRegister: true, typeTestRef: 'ENA/EVSE/MYEN/12001' })
  }
  return devices
}

function inferStrings(kwp: number): PvString[] {
  // Split roughly evenly into 1–2 strings of ~480 W panels.
  const panels = Math.max(1, Math.round((kwp * 1000) / 480))
  if (panels <= 12) return [{ id: 's1', panels, watts: 480, inverterId: 'dev-inv' }]
  const a = Math.ceil(panels / 2)
  return [
    { id: 's1', panels: a, watts: 480, inverterId: 'dev-inv' },
    { id: 's2', panels: panels - a, watts: 480, inverterId: 'dev-inv' },
  ]
}

export function buildApplication(p: StudioProject, over?: Partial<DnoApplication>): DnoApplication {
  const phase: 1 | 3 = over?.phase ?? ((p.systemKwp ?? 0) > 15 ? 3 : 1)
  const devices = over?.devices ?? inferDevices(p.products)
  const strings = over?.strings ?? inferStrings(p.systemKwp ?? 4)
  const totalOutputKw = devices.filter((d) => d.kind === 'inverter').reduce((s, d) => s + d.capacityKw, 0) || 4
  const mpan = over?.mpan ?? sampleMpan('20')
  const dnoRegion = resolveDno(mpan)
  const cls = classify({ totalOutputKw, phase, exportLimitKw: over?.exportLimitKw, dnoRegion, mpan })
  return {
    ...cls,
    dnoRegion,
    mpan,
    phase,
    strings,
    devices,
    exportScheme: over?.exportScheme ?? 'none',
    exportLimitKw: over?.exportLimitKw,
    installLocation: over?.installLocation ?? 'Loft',
    isolatorLocation: over?.isolatorLocation ?? 'Next to inverter',
    preExisting: over?.preExisting ?? false,
    status: 'draft',
    signatures: {},
    documents: [],
    messages: [],
    events: [{ id: eid(), label: 'Application created', at: stamp() }],
    ...over,
  }
}

/** The steps the AI operator streams while preparing an application (real values from `app`). */
export function autopilotSteps(app: DnoApplication): string[] {
  const inv = app.devices.filter((d) => d.kind === 'inverter')
  const totalKw = inv.reduce((s, d) => s + d.capacityKw, 0)
  const onReg = app.devices.filter((d) => d.onRegister).length
  return [
    'Reading survey & design data',
    `Resolving MPAN → ${app.dnoRegion}`,
    `Calculating aggregate rated current → ${app.aggregateRcA} A`,
    `Classifying connection → ${app.classification}`,
    `Drawing single line diagram from ${app.strings.length} string${app.strings.length === 1 ? '' : 's'} · ${totalKw} kW`,
    `Validating equipment vs ENA register → ${onReg}/${app.devices.length} listed`,
    'Assembling application pack → 3 documents',
    'Ready to review & sign',
  ]
}

export const FORM_TONE: Record<DnoForm, 'positive' | 'accent' | 'warning' | 'neutral'> = {
  G98: 'positive',
  'G99-A': 'accent',
  'G99-B': 'warning',
  G100: 'neutral',
}

export const STATUS_LABEL: Record<DnoStatusKey, string> = {
  draft: 'Draft',
  validated: 'Validated',
  submitted: 'Submitted',
  reviewing: 'Under review',
  info: 'Info requested',
  approved: 'Approved',
  installed: 'Installed',
  pto: 'PTO / complete',
  rejected: 'Rejected',
}
type DnoStatusKey = DnoApplication['status']

export const STATUS_ORDER: DnoStatusKey[] = ['draft', 'validated', 'submitted', 'reviewing', 'approved', 'installed', 'pto']
export function nextStatus(s: DnoStatusKey): DnoStatusKey | null {
  const i = STATUS_ORDER.indexOf(s)
  return i >= 0 && i < STATUS_ORDER.length - 1 ? STATUS_ORDER[i + 1] : null
}
export function statusEventLabel(s: DnoStatusKey): string {
  return ({
    draft: 'Drafted', validated: 'Validated — ready to submit', submitted: 'Submitted to DNO',
    reviewing: 'Under DNO review', info: 'Information requested', approved: 'Approved by DNO',
    installed: 'Installed', pto: 'PTO / handover complete', rejected: 'Rejected by DNO',
  } as Record<DnoStatusKey, string>)[s]
}
/** DNO reference prefix from a region name (e.g. "SSEN (Southern England)" → "SSEN"). */
export function dnoRefPrefix(region: string): string {
  const m = region.match(/^[A-Z]{2,5}/)
  return m ? m[0] : 'DNO'
}
export const newEventId = eid
