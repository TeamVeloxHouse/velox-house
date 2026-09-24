import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { MultiSelect, Stepper } from '../components/inputs'
import { Home, MapPin, Sun, Bolt, Sliders, Target, Check, Sparkle, Search, Layers, ChevronDown, Clock, Person, Radar, Lock } from '../components/icons'
import { useActions, useState_ } from '../store/store'
import { money, classNames } from '../lib/format'
import { SOLAR_STATUSES, type SolarProspect, type SolarProspectStatus } from '../store/types'
import { STATUS_META, scoreTone } from './CommercialSolar'
import { Dropdown } from '../components/Dropdown'
import {
  DEFAULT_CRITERIA, SHOWROOMS, PROPERTY_LABEL, runHomeFinder, homeToProspect, parseBrief, newCampaignId,
  type HomeCriteria, type PropertyType, type Aspect, type Progress, type Stage,
} from '../lib/homeFinder'

const ACCENT = '#13927B'
const MAPBOX = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_MAPBOX_TOKEN || ''
const LS_KEY = 'shc.homefinder.criteria.v1'
const placeSuggest = async (q: string) => { try { const r = await fetch('/api/autocomplete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: q }) }); const j = await r.json(); return (j.suggestions || []).map((s: { text: string }) => s.text) } catch { return [] } }

const PRESETS: { name: string; desc: string; patch: Partial<HomeCriteria> }[] = [
  { name: 'Prime south-facing homes', desc: 'Detached & semis, south roofs, 10+ panels', patch: { propertyTypes: ['detached', 'semi', 'house'], aspects: ['S', 'SE', 'SW'], minPanels: 10, minScore: 60 } },
  { name: 'Big roofs for battery upsell', desc: 'Large footprints, 14+ panels, solar + battery', patch: { footprintMin: 90, minPanels: 14, minRoofM2: 30, focus: 'solar-battery', weights: { roof: 4, aspect: 2, savings: 2, size: 3 } } },
  { name: 'Bungalow belt', desc: 'Bungalows — easy installs, older owners', patch: { propertyTypes: ['bungalow'], includeUntagged: false, minPanels: 8 } },
  { name: 'Fastest payback', desc: 'Rank purely on savings', patch: { weights: { roof: 1, aspect: 2, savings: 5, size: 0 }, minScore: 65 } },
]

export function HomeFinder() {
  const act = useActions()
  const { solarProspects, solarCampaigns, projects, portals } = useState_()
  const [tab, setTab] = useState('build')
  const [c, setC] = useState<HomeCriteria>(() => { try { return { ...DEFAULT_CRITERIA, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') } } catch { return DEFAULT_CRITERIA } })
  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(c)) } catch { /* ignore */ } }, [c])
  const set = (p: Partial<HomeCriteria>) => setC((x) => ({ ...x, ...p }))

  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [campaignId, setCampaignId] = useState<string | null>(null)

  const homes = useMemo(() => solarProspects.filter((p) => p.tool === 'home-finder'), [solarProspects])
  const campaigns = useMemo(() => solarCampaigns.filter((x) => x.tool === 'home-finder').sort((a, b) => b.createdAt - a.createdAt), [solarCampaigns])
  const shown = campaignId ? homes.filter((h) => h.campaignId === campaignId) : homes

  async function run() {
    if (running) return
    setError(null); setRunning(true); setProgress({ stage: 'locate', message: 'Starting…' })
    const where = [...SHOWROOMS.filter((s) => c.showrooms.includes(s.id)).map((s) => s.name.replace(' showroom', '')), ...c.areas].join(', ') || 'area'
    const camp = act.createSolarCampaign({ id: newCampaignId(), name: `${c.radiusKm} km · ${where}`, tool: 'home-finder', area: where, radiusM: c.radiusKm * 1000, targetKwp: c.minKwp, count: c.maxHomes, status: 'scanning' })
    setCampaignId(camp.id)
    let first = true
    try {
      const customerAddresses = [...projects.map((p) => p.address), ...portals.map((p) => p.address)].map((a) => (a || '').split(',')[0].trim()).filter((a) => a.length > 4)
      const r = await runHomeFinder(c, { knownIds: new Set(homes.map((h) => h.id)), customerAddresses }, setProgress, (h) => {
        act.addSolarProspects([homeToProspect(h, camp.id)])
        if (first) { first = false }
      })
      act.updateSolarCampaign(camp.id, { status: 'complete', scanned: r.scanned })
      act.toast(`${r.found} qualifying homes found`)
      if (r.found) setTab('results')
    } catch (e) {
      setError((e as Error).message)
      act.updateSolarCampaign(camp.id, { status: 'complete' })
    } finally { setRunning(false) }
  }

  const tabs = [
    { id: 'build', label: 'Search builder', icon: Sliders },
    { id: 'results', label: 'Results', icon: Home, count: shown.length },
    { id: 'map', label: 'Map', icon: MapPin },
  ]

  return (
    <>
      <TopBar title="Home Finder" crumbs={['Find']} identity={{ icon: Home, accent: ACCENT }} tabs={{ items: tabs, value: tab, onChange: setTab }} />
      <PageBody>
        {tab === 'build' && <Builder c={c} set={set} setC={setC} run={run} running={running} progress={progress} error={error} />}
        {tab === 'results' && <Results homes={shown} all={homes.length} campaigns={campaigns} campaignId={campaignId} setCampaignId={setCampaignId} running={running} progress={progress} onBuild={() => setTab('build')} />}
        {tab === 'map' && <ResultsMap homes={shown} />}
      </PageBody>
    </>
  )
}

/* ═══════════════════════ Builder ═══════════════════════ */

function Builder({ c, set, setC, run, running, progress, error }: {
  c: HomeCriteria; set: (p: Partial<HomeCriteria>) => void; setC: (c: HomeCriteria) => void
  run: () => void; running: boolean; progress: Progress | null; error: string | null
}) {
  const [open, setOpen] = useState<string[]>(['where', 'property', 'roof'])
  const tog = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))
  const toggleIn = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const whereCount = c.showrooms.length + c.areas.length
  const areaKm2 = Math.round(Math.PI * c.radiusKm ** 2 * Math.max(1, whereCount) * 10) / 10

  return (
    <div className="grid grid-cols-[1fr_380px] gap-5 items-start">
      <div className="flex flex-col gap-3 min-w-0">
        {/* 1 · Where */}
        <Section id="where" n={1} icon={MapPin} title="Where to look" open={open} onToggle={tog} badge={<DataBadge kind="live">Geocoding + OpenStreetMap</DataBadge>}
          summary={`${whereCount ? [...SHOWROOMS.filter((s) => c.showrooms.includes(s.id)).map((s) => s.name.replace(' showroom', '')), ...c.areas].join(', ') : 'No area yet'} · ${c.radiusKm} km radius · measure ${c.maxHomes} homes`}>
          <Field label="Start from a showroom">
            <div className="grid grid-cols-2 gap-2">
              {SHOWROOMS.map((s) => {
                const on = c.showrooms.includes(s.id)
                return (
                  <button key={s.id} onClick={() => set({ showrooms: toggleIn(c.showrooms, s.id) })} title={s.address} className={classNames('h-14 rounded-xl border px-3 flex items-center gap-2.5 text-left transition-colors', on ? 'border-accent bg-accent-wash' : 'border-border bg-surface hover:border-input-border')}>
                    <span className={classNames('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', on ? 'bg-accent text-white' : 'bg-control text-muted-b')}><Home size={15} /></span>
                    <span className="min-w-0"><span className="block text-[13px] font-semibold text-ink truncate">{s.name.replace(' showroom', '')}</span><span className={classNames('block text-[11px] truncate', s.confirmed ? 'text-muted-2' : 'text-warning')}>{s.address}</span></span>
                    {on && <Check size={15} className="ml-auto text-accent" />}
                  </button>
                )
              })}
            </div>
          </Field>
          <Field label="Add towns, villages or postcodes" hint="Each becomes its own search centre">
            <MultiSelect values={c.areas} onChange={(v) => set({ areas: v })} asyncSuggest={placeSuggest} icon={Target} placeholder="e.g. Penarth, CF64, Charlton Kings…" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Radius around each centre" hint="Max 5 km — keeps each scan fast">
              <Slider value={c.radiusKm} min={0.3} max={5} step={0.1} onChange={(v) => set({ radiusKm: v })} fmt={(v) => `${v.toFixed(1)} km`} />
            </Field>
            <Field label="Homes to measure" hint="Each is one Google Solar lookup">
              <Stepper value={c.maxHomes} onChange={(v) => set({ maxHomes: v })} min={10} max={150} step={10} />
            </Field>
          </div>
        </Section>

        {/* 2 · Property */}
        <Section id="property" n={2} icon={Home} title="Property" open={open} onToggle={tog} badge={<DataBadge kind="live">OpenStreetMap footprints</DataBadge>}
          summary={`${c.propertyTypes.map((t) => PROPERTY_LABEL[t].split(' ')[0]).join(', ')}${c.includeUntagged ? ' + untagged' : ''} · ${c.footprintMin}–${c.footprintMax} m² footprint`}>
          <Field label="Property types" hint="From OpenStreetMap tags — many UK homes aren't typed, so keep 'House (untyped)' on for coverage">
            <div className="flex flex-wrap gap-2">
              {(['detached', 'semi', 'terrace', 'bungalow', 'house'] as PropertyType[]).map((t) => (
                <Toggle key={t} on={c.propertyTypes.includes(t)} onClick={() => set({ propertyTypes: toggleIn(c.propertyTypes, t) })}>{t === 'house' ? 'House (untyped)' : PROPERTY_LABEL[t]}</Toggle>
              ))}
            </div>
          </Field>
          <Switch on={c.includeUntagged} onChange={(v) => set({ includeUntagged: v })} label="Include untagged buildings in residential streets" hint="Catches homes mapped as plain 'building'. Shops, offices and amenities are always excluded." />
          <Field label="Building footprint" hint="Filters out garages & sheds (small) and flats/commercial blocks (large)">
            <div className="grid grid-cols-2 gap-4">
              <Stepper value={c.footprintMin} onChange={(v) => set({ footprintMin: v })} min={20} max={400} step={5} suffix="m² min" />
              <Stepper value={c.footprintMax} onChange={(v) => set({ footprintMax: v })} min={40} max={800} step={10} suffix="m² max" />
            </div>
          </Field>
        </Section>

        {/* 3 · Roof & solar */}
        <Section id="roof" n={3} icon={Sun} title="Roof & solar" open={open} onToggle={tog} badge={<DataBadge kind="live">Google Solar, measured</DataBadge>}
          summary={`${c.aspects.join('/')} roofs · ${c.minPanels}+ panels · ${c.minKwp}+ kWp · ${c.minYield}+ kWh/kWp`}>
          <Field label="Roof orientation" hint="Planes facing these directions count towards the system">
            <Compass value={c.aspects} onChange={(v) => set({ aspects: v })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Minimum panels on good planes"><Stepper value={c.minPanels} onChange={(v) => set({ minPanels: v })} min={4} max={30} /></Field>
            <Field label="Minimum system size"><Stepper value={c.minKwp} onChange={(v) => set({ minKwp: v })} min={1} max={12} step={0.5} suffix="kWp" format={(n) => n.toFixed(1)} /></Field>
            <Field label="Minimum usable roof area"><Stepper value={c.minRoofM2} onChange={(v) => set({ minRoofM2: v })} min={5} max={120} step={5} suffix="m²" /></Field>
            <Field label="Minimum sunshine (specific yield)" hint="UK south roof ≈ 900–1,000"><Stepper value={c.minYield} onChange={(v) => set({ minYield: v })} min={500} max={1100} step={25} suffix="kWh/kWp" /></Field>
          </div>
        </Section>

        {/* 4 · Energy & household */}
        <Section id="energy" n={4} icon={Bolt} title="Energy & household" open={open} onToggle={tog} badge={<DataBadge kind="model">Modelled · EPC not connected</DataBadge>}
          summary={`${c.annualUseKwh.toLocaleString()} kWh/yr use · ${c.importPence}p import / ${c.exportPence}p export${c.epcBands.length ? ` · EPC ${c.epcBands.join('')}` : ''}`}>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Typical annual use"><Stepper value={c.annualUseKwh} onChange={(v) => set({ annualUseKwh: v })} min={1500} max={12000} step={100} suffix="kWh" format={(n) => n.toLocaleString()} /></Field>
            <Field label="Import tariff"><Stepper value={c.importPence} onChange={(v) => set({ importPence: v })} min={5} max={60} step={0.5} suffix="p/kWh" format={(n) => n.toFixed(1)} /></Field>
            <Field label="Export (SEG) rate"><Stepper value={c.exportPence} onChange={(v) => set({ exportPence: v })} min={0} max={30} step={0.5} suffix="p/kWh" format={(n) => n.toFixed(1)} /></Field>
          </div>
          <LockedGroup reason="Connect the EPC register (free API key) and these filter homes by their real certificate.">
            <Field label="EPC band">
              <div className="flex gap-1.5">{['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((b) => <Toggle key={b} on={c.epcBands.includes(b)} onClick={() => set({ epcBands: toggleIn(c.epcBands, b) })}>{b}</Toggle>)}</div>
            </Field>
            <Field label="Main heating fuel" hint="Off-gas homes (oil / LPG) are prime heat-pump + battery prospects">
              <div className="flex flex-wrap gap-1.5">{['Mains gas', 'Oil', 'LPG', 'Electric', 'Solid fuel'].map((f) => <Toggle key={f} on={c.fuels.includes(f)} onClick={() => set({ fuels: toggleIn(c.fuels, f) })}>{f}</Toggle>)}</div>
            </Field>
          </LockedGroup>
        </Section>

        {/* 5 · Opportunity & scoring */}
        <Section id="score" n={5} icon={Target} title="Opportunity & scoring" open={open} onToggle={tog} badge={<DataBadge kind="model">Your weighting</DataBadge>}
          summary={`${c.focus === 'solar' ? 'Solar only' : c.focus === 'solar-battery' ? 'Solar + battery' : 'Solar + battery + EV'} · min score ${c.minScore}`}>
          <Field label="What are you selling?" hint="Changes system cost, self-consumption and payback">
            <div className="grid grid-cols-3 gap-2">
              {([['solar', 'Solar only', 'Panels + inverter'], ['solar-battery', 'Solar + battery', 'Most popular'], ['battery-ev', 'Solar + battery + EV', 'Whole-home']] as const).map(([k, l, d]) => (
                <button key={k} onClick={() => set({ focus: k })} className={classNames('rounded-xl border px-3 py-2.5 text-left transition-colors', c.focus === k ? 'border-accent bg-accent-wash' : 'border-border hover:border-input-border')}>
                  <div className="text-[13px] font-semibold text-ink">{l}</div><div className="text-[11.5px] text-muted-2">{d}</div>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Score weighting" hint="How much each factor counts towards the 0–100 fit score">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {([['roof', 'Roof capacity'], ['aspect', 'Orientation'], ['savings', 'Savings & payback'], ['size', 'Home size']] as const).map(([k, l]) => (
                <div key={k}>
                  <div className="flex justify-between text-[12px] mb-1"><span className="text-ink-3 font-medium">{l}</span><span className="text-muted-2">{['Off', 'Low', 'Some', 'Medium', 'High', 'Max'][c.weights[k]]}</span></div>
                  <Slider value={c.weights[k]} min={0} max={5} step={1} onChange={(v) => set({ weights: { ...c.weights, [k]: v } })} />
                </div>
              ))}
            </div>
          </Field>
          <Field label="Only keep homes scoring at least">
            <Slider value={c.minScore} min={0} max={95} step={5} onChange={(v) => set({ minScore: v })} fmt={(v) => `${v} / 100`} />
          </Field>
        </Section>

        {/* 6 · Exclusions */}
        <Section id="exclude" n={6} icon={Lock} title="Exclusions" open={open} onToggle={tog}
          summary={[c.excludeFound && 'already-found homes', c.excludeCustomers && 'existing customers'].filter(Boolean).join(' + ') || 'None'}>
          <Switch on={c.excludeFound} onChange={(v) => set({ excludeFound: v })} label="Skip homes already in your prospects" hint="Never measure (or pay for) the same roof twice" />
          <Switch on={c.excludeCustomers} onChange={(v) => set({ excludeCustomers: v })} label="Skip existing customers" hint="Matches against project and customer-portal addresses" />
          <div className="text-[12px] text-muted-2 flex items-center gap-1.5"><Clock size={13} />Conservation areas, listed buildings and homes that already have panels are on the roadmap.</div>
        </Section>
      </div>

      {/* sticky side panel */}
      <div className="sticky top-0 flex flex-col gap-3">
        <Brief c={c} set={set} />
        <div className="rounded-card bg-surface border border-border shadow-card overflow-hidden">
          <div className="p-4 bg-deep-panel">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mint">Your search</div>
            <div className="text-[14px] text-white leading-snug mt-1.5">
              {whereCount ? <>Measure <b>{c.maxHomes}</b> {c.propertyTypes.length === 5 ? 'homes' : c.propertyTypes.map((t) => PROPERTY_LABEL[t].split(' ')[0].toLowerCase()).join(' / ') + ' homes'} within <b>{c.radiusKm} km</b> of {[...SHOWROOMS.filter((s) => c.showrooms.includes(s.id)).map((s) => s.name.replace(' showroom', '')), ...c.areas].join(', ')}, keeping {c.aspects.join('/')}-facing roofs with <b>{c.minPanels}+ panels</b> scoring <b>{c.minScore}+</b>.</> : 'Pick a showroom or add a town to start.'}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3.5">
              <MiniStat v={`${areaKm2}`} l="km² covered" />
              <MiniStat v={String(c.maxHomes)} l="roofs measured" />
              <MiniStat v={`≈${c.maxHomes}`} l="Solar lookups" />
            </div>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <button onClick={run} disabled={running || !whereCount} className="h-11 rounded-control bg-accent-gradient text-white font-semibold text-[14px] flex items-center justify-center gap-2 shadow-primary disabled:opacity-50">
              {running ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Search size={16} />}{running ? 'Finding homes…' : 'Find homes'}
            </button>
            {(running || progress) && <Timeline progress={progress} running={running} />}
            {error && <div className="text-[12.5px] text-negative bg-negative-wash rounded-lg px-3 py-2">{error}</div>}
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-3">Data behind this search</div>
              <Source kind="live" t="Homes & footprints" s="OpenStreetMap" />
              <Source kind="live" t="Roof planes, panels, sunshine" s="Google Solar API" />
              <Source kind="live" t="Addresses" s="Google Geocoding" />
              <Source kind="model" t="Savings, cost & payback" s="Modelled from the measured roof" />
              <Source kind="off" t="EPC band & heating" s="Not connected yet" />
            </div>
          </div>
        </div>
        <div className="rounded-card bg-surface border border-border shadow-card p-4">
          <div className="text-[13px] font-bold text-ink mb-2">Presets</div>
          <div className="flex flex-col gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.name} onClick={() => setC({ ...c, ...p.patch })} className="text-left rounded-lg px-3 py-2 hover:bg-surface-tint border border-transparent hover:border-border transition-colors">
                <div className="text-[13px] font-semibold text-ink-2">{p.name}</div><div className="text-[11.5px] text-muted-2">{p.desc}</div>
              </button>
            ))}
            <button onClick={() => setC(DEFAULT_CRITERIA)} className="text-[12px] font-semibold text-muted-b hover:text-ink-3 mt-1 self-start px-3">Reset to defaults</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Brief({ c, set }: { c: HomeCriteria; set: (p: Partial<HomeCriteria>) => void }) {
  const [text, setText] = useState('')
  const [got, setGot] = useState<string[] | null>(null)
  function apply() {
    const { patch, understood } = parseBrief(text, c)
    set(patch); setGot(understood)
  }
  return (
    <div className="rounded-card bg-surface border border-border shadow-card p-4">
      <div className="flex items-center gap-2 mb-2"><span className="w-7 h-7 rounded-lg bg-accent-gradient text-white flex items-center justify-center"><Sparkle size={14} /></span><div className="text-[13px] font-bold text-ink">Brief Ovi</div><span className="text-[11.5px] text-muted-2">fills the builder for you</span></div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); apply() } }}
        placeholder="e.g. south-facing detached homes within 2 miles of Cheltenham, big roofs, battery" className="w-full rounded-control border border-input-border px-3 py-2 text-[13px] outline-none focus:border-accent resize-none" />
      <div className="flex items-center justify-between mt-2">
        <div className="flex flex-wrap gap-1 min-w-0">{got?.length === 0 && <span className="text-[11.5px] text-muted-2">Didn't catch any filters. Try naming a showroom, postcode or roof type.</span>}{got?.map((g) => <span key={g} className="text-[11px] font-medium bg-accent-wash text-accent rounded px-1.5 py-0.5">{g}</span>)}</div>
        <button onClick={apply} disabled={!text.trim()} className="h-8 px-3 rounded-control border border-border text-[12.5px] font-semibold text-ink-3 hover:bg-control disabled:opacity-50 shrink-0">Apply</button>
      </div>
    </div>
  )
}

const STAGES: { id: Stage; label: string }[] = [
  { id: 'locate', label: 'Locate areas' }, { id: 'homes', label: 'Pull residential buildings' }, { id: 'filter', label: 'Filter by type & size' },
  { id: 'measure', label: 'Measure roofs from satellite' }, { id: 'score', label: 'Score & keep the best' }, { id: 'done', label: 'Done' },
]
function Timeline({ progress, running }: { progress: Progress | null; running: boolean }) {
  const idx = STAGES.findIndex((s) => s.id === (progress?.stage === 'address' ? 'score' : progress?.stage))
  const n = progress?.counts ?? {}
  const countFor: Partial<Record<Stage, string>> = {
    locate: n.locate != null ? `${n.locate} centres` : undefined, homes: n.homes != null ? `${n.homes.toLocaleString()} buildings` : undefined,
    filter: n.filter != null ? `${n.filter.toLocaleString()} match` : undefined, measure: n.measure != null ? `${n.measure} measured` : undefined, score: n.score != null ? `${n.score} qualify` : undefined,
  }
  return (
    <div className="rounded-lg border border-divider p-3 flex flex-col gap-2">
      {STAGES.map((s, i) => {
        const state = i < idx || (s.id === 'done' && progress?.stage === 'done') ? 'done' : i === idx && running ? 'run' : 'wait'
        return (
          <div key={s.id} className="flex items-center gap-2.5 text-[12.5px]">
            <span className={classNames('w-4 h-4 rounded-full flex items-center justify-center shrink-0', state === 'done' ? 'bg-positive text-white' : state === 'run' ? 'border-2 border-accent border-t-transparent animate-spin' : 'border-2 border-border')}>{state === 'done' && <Check size={10} />}</span>
            <span className={state === 'wait' ? 'text-muted-3' : 'text-ink-2 font-medium'}>{s.label}</span>
            {countFor[s.id] && <span className="ml-auto text-[11.5px] text-muted-2">{countFor[s.id]}</span>}
          </div>
        )
      })}
      {running && progress && <div className="text-[11.5px] text-accent mt-1">{progress.message}</div>}
      {progress?.total ? <div className="h-1 rounded-full bg-control overflow-hidden"><div className="h-full bg-accent-500 transition-all" style={{ width: `${((progress.done ?? 0) / progress.total) * 100}%` }} /></div> : null}
    </div>
  )
}

/* ─── builder primitives ─── */

function Section({ id, n, icon: Icon, title, summary, badge, open, onToggle, children }: { id: string; n: number; icon: (p: { size?: number }) => JSX.Element; title: string; summary: string; badge?: ReactNode; open: string[]; onToggle: (id: string) => void; children: ReactNode }) {
  const isOpen = open.includes(id)
  return (
    <div className={classNames('rounded-card bg-surface border shadow-card transition-colors', isOpen ? 'border-border' : 'border-border hover:border-input-border')}>
      <button onClick={() => onToggle(id)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
        <span className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: isOpen ? ACCENT : '#F1F3F7', color: isOpen ? '#fff' : '#6E7887' }}><Icon size={17} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2"><span className="text-[11px] font-semibold text-muted-3">{n}</span><span className="text-[14.5px] font-bold text-ink">{title}</span>{badge}</span>
          <span className="block text-[12.5px] text-muted-b truncate mt-0.5">{summary}</span>
        </span>
        <ChevronDown size={16} className={classNames('text-muted-3 transition-transform', !isOpen && '-rotate-90')} />
      </button>
      {isOpen && <div className="px-4 pb-4 pt-1 flex flex-col gap-4 border-t border-divider-row">{children}</div>}
    </div>
  )
}
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <div className="flex flex-col gap-1.5 pt-2"><div className="flex items-baseline gap-2"><span className="text-[12.5px] font-semibold text-ink-3">{label}</span>{hint && <span className="text-[11.5px] text-muted-2">{hint}</span>}</div>{children}</div>
}
function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className={classNames('h-8 px-3 rounded-lg border text-[12.5px] font-medium flex items-center gap-1.5 transition-colors', on ? 'border-accent bg-accent-wash text-accent' : 'border-border bg-surface text-ink-3 hover:border-input-border')}>{on && <Check size={12} />}{children}</button>
}
function Switch({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button onClick={() => onChange(!on)} className="flex items-start gap-3 text-left pt-1">
      <span className={classNames('w-9 h-5 rounded-full flex items-center px-0.5 shrink-0 mt-0.5 transition-colors', on ? 'bg-accent justify-end' : 'bg-input-border justify-start')}><span className="w-4 h-4 rounded-full bg-white shadow" /></span>
      <span><span className="block text-[13px] font-medium text-ink-2">{label}</span>{hint && <span className="block text-[11.5px] text-muted-2">{hint}</span>}</span>
    </button>
  )
}
function Slider({ value, min, max, step, onChange, fmt }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <div className="flex items-center gap-3">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="flex-1" style={{ accentColor: ACCENT }} />
      {fmt && <span className="text-[12.5px] font-semibold text-ink-2 w-[70px] text-right">{fmt(value)}</span>}
    </div>
  )
}
function Compass({ value, onChange }: { value: Aspect[]; onChange: (v: Aspect[]) => void }) {
  const pts: { a: Aspect; x: number; y: number }[] = [
    { a: 'N', x: 50, y: 10 }, { a: 'NE', x: 78, y: 22 }, { a: 'E', x: 90, y: 50 }, { a: 'SE', x: 78, y: 78 },
    { a: 'S', x: 50, y: 90 }, { a: 'SW', x: 22, y: 78 }, { a: 'W', x: 10, y: 50 }, { a: 'NW', x: 22, y: 22 },
  ]
  const tog = (a: Aspect) => onChange(value.includes(a) ? value.filter((x) => x !== a) : [...value, a])
  return (
    <div className="flex items-center gap-5">
      <div className="relative w-[150px] h-[150px] shrink-0">
        <svg viewBox="0 0 100 100" className="absolute inset-0"><circle cx="50" cy="50" r="40" fill="#F6F8FA" stroke="#E4E8EE" /><circle cx="50" cy="50" r="3" fill="#98A1B0" /></svg>
        {pts.map((p) => {
          const on = value.includes(p.a)
          return <button key={p.a} onClick={() => tog(p.a)} className={classNames('absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full text-[11px] font-bold border transition-colors', on ? 'bg-accent text-white border-accent' : 'bg-white text-muted-b border-border hover:border-input-border')} style={{ left: `${p.x}%`, top: `${p.y}%` }}>{p.a}</button>
        })}
      </div>
      <div className="flex flex-col gap-1.5 text-[12px] text-muted-b">
        <button onClick={() => onChange(['S', 'SE', 'SW'])} className="text-left hover:text-accent">South only <span className="text-muted-3">— best yield</span></button>
        <button onClick={() => onChange(['S', 'SE', 'SW', 'E', 'W'])} className="text-left hover:text-accent">South + east/west <span className="text-muted-3">— recommended</span></button>
        <button onClick={() => onChange(['S', 'SE', 'SW', 'E', 'W', 'NE', 'NW', 'N'])} className="text-left hover:text-accent">Any direction</button>
      </div>
    </div>
  )
}
function LockedGroup({ reason, children }: { reason: string; children: ReactNode }) {
  return (
    <div className="relative rounded-xl border border-dashed border-input-border p-3 pt-1">
      <div className="opacity-50 pointer-events-none flex flex-col gap-2">{children}</div>
      <div className="mt-2 text-[12px] text-ink-3 flex items-center gap-1.5"><Lock size={13} className="text-muted-b" />{reason}</div>
    </div>
  )
}
function DataBadge({ kind, children }: { kind: 'live' | 'model'; children: ReactNode }) {
  return <span className={classNames('text-[10.5px] font-semibold rounded-full px-2 py-0.5 flex items-center gap-1', kind === 'live' ? 'bg-positive-wash text-positive' : 'bg-control text-muted-b')}>{kind === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-positive" />}{children}</span>
}
function Source({ kind, t, s }: { kind: 'live' | 'model' | 'off'; t: string; s: string }) {
  const c = kind === 'live' ? '#0E7C66' : kind === 'model' ? '#98A1B0' : '#D0D5DD'
  return <div className="flex items-center gap-2 text-[12px]"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: c }} /><span className="text-ink-3 font-medium">{t}</span><span className="ml-auto text-muted-2 text-right">{s}</span></div>
}
function MiniStat({ v, l }: { v: string; l: string }) {
  return <div className="rounded-lg bg-white/[0.07] border border-white/[0.08] px-2.5 py-2"><div className="text-[16px] font-bold text-white leading-none">{v}</div><div className="text-[10.5px] text-white/55 mt-1">{l}</div></div>
}

/* ═══════════════════════ Results ═══════════════════════ */

function Results({ homes, all, campaigns, campaignId, setCampaignId, running, progress, onBuild }: {
  homes: SolarProspect[]; all: number; campaigns: import('../store/types').SolarCampaign[]; campaignId: string | null; setCampaignId: (id: string | null) => void
  running: boolean; progress: Progress | null; onBuild: () => void
}) {
  const [sort, setSort] = useState<'score' | 'saving' | 'payback' | 'kwp'>('score')
  const [status, setStatus] = useState<'all' | SolarProspectStatus>('all')
  const rows = useMemo(() => homes
    .filter((h) => status === 'all' || h.status === status)
    .sort((a, b) => sort === 'saving' ? b.year1Saving - a.year1Saving : sort === 'payback' ? a.paybackYears - b.paybackYears : sort === 'kwp' ? b.systemKwp - a.systemKwp : b.score - a.score), [homes, sort, status])

  if (!all && !running) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-20 rounded-card border border-dashed border-border bg-surface">
        <span className="w-14 h-14 rounded-2xl bg-accent-gradient text-white flex items-center justify-center shadow-primary"><Home size={26} /></span>
        <div className="text-[16px] font-bold text-ink">No homes yet</div>
        <div className="text-[13px] text-muted-b max-w-[440px]">Build a search. Ovi pulls every home in the area, measures each roof from satellite and keeps the ones worth knocking on.</div>
        <button onClick={onBuild} className="h-10 px-4 rounded-control bg-accent-gradient text-white text-[13px] font-semibold shadow-primary mt-1">Open the search builder</button>
      </div>
    )
  }

  const saving = homes.reduce((s, h) => s + h.year1Saving, 0)
  const kwp = homes.reduce((s, h) => s + h.systemKwp, 0)
  const avg = Math.round(homes.reduce((s, h) => s + h.score, 0) / (homes.length || 1))
  const south = homes.filter((h) => h.reasons.some((r) => /\bS[EW]?-facing/.test(r))).length

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card bg-surface border border-border shadow-card grid grid-cols-5 divide-x divide-divider">
        <Stat l="Qualifying homes" v={String(homes.length)} h={running ? progress?.message : `${campaigns.length} ${campaigns.length === 1 ? 'search' : 'searches'}`} live={running} />
        <Stat l="Avg. fit score" v={String(avg)} bar={avg / 100} color={scoreTone(avg)} h="Across these homes" />
        <Stat l="South-facing" v={`${south}/${homes.length}`} bar={south / (homes.length || 1)} h="Best planes S / SE / SW" />
        <Stat l="Solar capacity" v={`${Math.round(kwp)} kWp`} h="Recommended systems" />
        <Stat l="Customer savings" v={money(saving, { compact: true })} h="Per year, combined" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-[#E9EDF2] border border-[#DDE3EA] rounded-control p-[3px]">
          {(['all', ...SOLAR_STATUSES.filter((s) => homes.some((h) => h.status === s))] as ('all' | SolarProspectStatus)[]).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={classNames('h-8 px-2.5 rounded-[7px] text-[12.5px] flex items-center gap-1.5', status === s ? 'bg-white text-accent font-bold shadow-[0_1px_3px_rgba(11,18,32,0.14)]' : 'text-muted-b font-medium hover:bg-control')}>
              {s !== 'all' && <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_META[s].tone }} />}{s === 'all' ? 'All' : STATUS_META[s].label}
              <span className={status === s ? 'text-white/60' : 'text-muted-3'}>{s === 'all' ? homes.length : homes.filter((h) => h.status === s).length}</span>
            </button>
          ))}
        </div>
        <Dropdown value={campaignId ?? 'all'} onChange={(e) => setCampaignId(e.target.value === 'all' ? null : e.target.value)} className="ml-auto h-9 px-3 rounded-control border border-border bg-surface text-[13px] outline-none focus:border-accent max-w-[240px]">
          <option value="all">All searches</option>
          {campaigns.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </Dropdown>
        <Dropdown value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-9 px-3 rounded-control border border-border bg-surface text-[13px] outline-none focus:border-accent">
          <option value="score">Sort: Best fit</option><option value="saving">Sort: Biggest saving</option><option value="payback">Sort: Fastest payback</option><option value="kwp">Sort: Largest system</option>
        </Dropdown>
      </div>

      <div className="rounded-card bg-surface border border-border shadow-card overflow-hidden">
        <div className="grid grid-cols-[minmax(250px,1.6fr)_minmax(170px,1fr)_minmax(150px,0.9fr)_minmax(150px,0.9fr)_56px_140px_110px] gap-4 px-4 h-10 items-center border-b border-divider bg-[#FAFBFC] text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-3">
          <span>Home</span><span>Roof</span><span>System</span><span>Savings</span><span>Fit</span><span>Stage</span><span />
        </div>
        {rows.map((h) => <HomeRow key={h.id} h={h} />)}
        {running && <div className="px-4 py-3.5 text-[12.5px] text-accent flex items-center gap-2 border-t border-divider-row"><span className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" />{progress?.message}</div>}
        {!rows.length && !running && <div className="px-4 py-10 text-center text-[13px] text-muted-b">No homes match these filters.</div>}
      </div>
    </div>
  )
}

function HomeRow({ h }: { h: SolarProspect }) {
  const act = useActions()
  const [open, setOpen] = useState(false)
  const aspect = h.reasons[0]?.match(/\b([NSEW]{1,2})-facing/)?.[1] ?? '—'
  const [street, ...rest] = h.address.split(',')
  const meta = STATUS_META[h.status]
  function addLead(e: React.MouseEvent) {
    e.stopPropagation()
    act.addLead({ name: `Homeowner · ${street}`, company: h.address, role: 'Homeowner', source: 'Home Finder', score: h.score, value: Math.round(h.year1Saving * h.paybackYears) })
    act.setSolarProspectStatus(h.id, 'researched')
    act.toast('Added to Leads')
  }
  return (
    <div className="border-b border-divider-row last:border-0">
      <div onClick={() => setOpen((o) => !o)} className="grid grid-cols-[minmax(250px,1.6fr)_minmax(170px,1fr)_minmax(150px,0.9fr)_minmax(150px,0.9fr)_56px_140px_110px] gap-4 px-4 py-3 items-center hover:bg-[#FAFCFB] cursor-pointer group">
        <div className="flex items-center gap-3 min-w-0">
          <RoofThumb ring={h.roofFootprint} center={h.center} />
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-ink truncate group-hover:text-accent">{street}</div>
            <div className="text-[12px] text-muted-2 truncate">{rest.join(',').trim() || '—'}</div>
            <div className="text-[11.5px] text-muted-3 truncate">{h.category} · {h.distanceM != null ? `${(h.distanceM / 1000).toFixed(1)} km away` : ''}</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-[11px] font-bold shrink-0" style={{ borderColor: aspect.startsWith('S') ? '#0E9F6E' : '#F59E0B', color: aspect.startsWith('S') ? '#0E7C66' : '#B45309' }}>{aspect}</span>
          <div>
            <div className="text-[13px] font-semibold text-ink-2">{h.roofAreaM2} m² usable</div>
            {h.roofMeasured
              ? <div className="text-[11.5px] text-muted-2">{h.reasons[0]?.split(' ')[0]} panels fit · measured</div>
              : <div className="text-[11px] font-semibold text-warning bg-warning-wash rounded px-1.5 py-px w-fit mt-0.5" title="Google Solar was unavailable — estimated from the building footprint">Estimated roof</div>}
          </div>
        </div>
        <div><div className="text-[14px] font-bold text-ink">{h.systemKwp} <span className="text-[11.5px] font-semibold text-muted-2">kWp</span></div><div className="text-[11.5px] text-muted-2">{h.panels} panels · {h.annualGenKwh.toLocaleString()} kWh/yr</div></div>
        <div><div className="text-[13.5px] font-semibold text-positive">{money(h.year1Saving)}/yr</div><div className="text-[11.5px] text-muted-2">{h.paybackYears}-yr payback</div></div>
        <Ring score={h.score} />
        <div onClick={(e) => e.stopPropagation()} className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pointer-events-none" style={{ background: meta.tone }} />
          <Dropdown value={h.status} onChange={(e) => act.setSolarProspectStatus(h.id, e.target.value as SolarProspectStatus)} className="h-8 w-full pl-6 pr-2 rounded-full border border-border bg-surface text-[12px] font-semibold text-ink-3 outline-none focus:border-accent cursor-pointer">
            {SOLAR_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </Dropdown>
        </div>
        <button onClick={addLead} className="h-8 px-2.5 rounded-control border border-border text-[12px] font-semibold text-ink-3 hover:border-accent hover:text-accent hover:bg-accent-wash flex items-center gap-1.5 justify-center"><Person size={13} />Add lead</button>
      </div>
      {open && (
        <div className="px-4 pb-4 grid grid-cols-[1fr_1fr] gap-4">
          <div className="rounded-xl bg-surface-tint border border-divider p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-3 mb-2">Why this home</div>
            <ul className="flex flex-col gap-1.5">{h.reasons.map((r) => <li key={r} className="text-[12.5px] text-ink-3 flex gap-2"><Check size={14} className="text-positive shrink-0 mt-0.5" />{r}</li>)}</ul>
          </div>
          <div className="rounded-xl bg-surface-tint border border-divider p-3.5 grid grid-cols-3 gap-3">
            {[['Generation', `${h.annualGenKwh.toLocaleString()} kWh`], ['Self-use', `${h.selfConsumptionPct}%`], ['25-yr saving', money(h.lifetimeSaving, { compact: true })], ['CO₂ saved', `${h.co2PerYearTonnes} t/yr`], ['Footprint', h.category ?? '—'], ['Distance', h.distanceM != null ? `${(h.distanceM / 1000).toFixed(1)} km` : '—']].map(([l, v]) => (
              <div key={l}><div className="text-[11px] text-muted-2">{l}</div><div className="text-[13px] font-semibold text-ink-2 truncate">{v}</div></div>
            ))}
            {h.center && <a onClick={(e) => e.stopPropagation()} href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${h.center.lat},${h.center.lng}`} target="_blank" rel="noreferrer" className="col-span-3 text-[12px] font-semibold text-accent hover:underline flex items-center gap-1"><Radar size={13} />Open Street View</a>}
          </div>
        </div>
      )}
    </div>
  )
}

/** Mapbox satellite thumbnail of the actual roof, with the OSM outline drawn on top. */
function RoofThumb({ ring, center }: { ring?: { lat: number; lng: number }[]; center?: { lat: number; lng: number } }) {
  const [ok, setOk] = useState(true)
  if (!MAPBOX || !center || !ok) return <Footprint ring={ring} />
  const overlay = ring?.length
    ? `geojson(${encodeURIComponent(JSON.stringify({ type: 'Feature', properties: { stroke: '#62E4CC', 'stroke-width': 2, fill: '#62E4CC', 'fill-opacity': 0.18 }, geometry: { type: 'Polygon', coordinates: [ring.map((p) => [+p.lng.toFixed(6), +p.lat.toFixed(6)])] } }))})/`
    : ''
  const src = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${overlay}${center.lng.toFixed(6)},${center.lat.toFixed(6)},19.2,0/112x88@2x?attribution=false&logo=false&access_token=${MAPBOX}`
  return <img src={src} onError={() => setOk(false)} alt="" className="w-14 h-11 rounded-lg object-cover shrink-0 border border-border bg-control" loading="lazy" />
}

function Footprint({ ring }: { ring?: { lat: number; lng: number }[] }) {
  if (!ring?.length) return <span className="w-11 h-11 rounded-lg bg-accent-wash text-accent flex items-center justify-center shrink-0"><Home size={18} /></span>
  const lats = ring.map((p) => p.lat), lngs = ring.map((p) => p.lng)
  const [a, b, c2, d] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)]
  const k = Math.cos((a * Math.PI) / 180)
  const w = (d - c2) * k, hgt = b - a, s = 34 / Math.max(w, hgt, 1e-9)
  const pts = ring.map((p) => `${4 + ((p.lng - c2) * k) * s + (34 - w * s) / 2},${4 + (b - p.lat) * s + (34 - hgt * s) / 2}`).join(' ')
  return <svg width="44" height="44" viewBox="0 0 42 42" className="shrink-0 rounded-lg bg-[#F3F6F8] border border-border"><polygon points={pts} fill="#A7E6DA" stroke={ACCENT} strokeWidth="1.5" /></svg>
}
function Ring({ score }: { score: number }) {
  const r = 16, c = 2 * Math.PI * r
  return (
    <div className="relative w-10 h-10" title={`Fit score ${score}/100`}>
      <svg viewBox="0 0 40 40" className="w-10 h-10 -rotate-90"><circle cx="20" cy="20" r={r} fill="none" stroke="#EEF1F4" strokeWidth="4" /><circle cx="20" cy="20" r={r} fill="none" stroke={scoreTone(score)} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} /></svg>
      <span className="absolute inset-0 flex items-center justify-center text-[12px] font-bold text-ink">{score}</span>
    </div>
  )
}
function Stat({ l, v, h, bar, color = '#1FAE94', live }: { l: string; v: string; h?: string; bar?: number; color?: string; live?: boolean }) {
  return (
    <div className="px-4 py-3.5 min-w-0">
      <div className="text-[11.5px] font-medium text-muted-b flex items-center gap-1.5">{live && <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse" />}{l}</div>
      <div className="text-[22px] font-bold text-ink tracking-[-0.02em] leading-tight mt-1">{v}</div>
      {bar != null && <div className="h-1 rounded-full bg-control mt-2 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.round(Math.min(1, bar) * 100)}%`, background: color }} /></div>}
      {h && <div className="text-[11.5px] text-muted-2 mt-1.5 truncate">{h}</div>}
    </div>
  )
}

/* ═══════════════════════ Map ═══════════════════════ */

function ResultsMap({ homes }: { homes: SolarProspect[] }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  useEffect(() => {
    if (!el.current || map.current) return
    map.current = L.map(el.current, { zoomControl: true }).setView([51.7, -2.6], 9)
    if (MAPBOX) {
      L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX}`, { tileSize: 512, zoomOffset: -1, maxZoom: 21, attribution: '© Mapbox © OpenStreetMap' }).addTo(map.current)
    } else {
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20, attribution: 'Esri' }).addTo(map.current)
    }
    // Showroom pins, so every search reads against where the team actually is.
    for (const s of SHOWROOMS) {
      L.marker([s.center.lat, s.center.lng], { icon: L.divIcon({ className: '', html: `<div style="background:#15223B;color:#62E4CC;font:600 11px Instrument Sans,sans-serif;padding:4px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.3)">${s.name.replace(' showroom', '')}${s.confirmed ? '' : ' (approx.)'}</div>`, iconAnchor: [30, 12] }) })
        .bindPopup(`<b>${s.name}</b><br/>${s.address}`).addTo(map.current)
    }
    return () => { map.current?.remove(); map.current = null }
  }, [])
  useEffect(() => {
    const m = map.current; if (!m) return
    const layer = L.layerGroup().addTo(m)
    const pts: L.LatLngExpression[] = []
    for (const h of homes) {
      if (!h.center) continue
      pts.push([h.center.lat, h.center.lng])
      const col = scoreTone(h.score)
      if (h.roofFootprint?.length) L.polygon(h.roofFootprint.map((p) => [p.lat, p.lng] as L.LatLngTuple), { color: col, weight: 2, fillOpacity: 0.35 }).addTo(layer)
      L.circleMarker([h.center.lat, h.center.lng], { radius: 6, color: '#fff', weight: 2, fillColor: col, fillOpacity: 1 })
        .bindPopup(`<b>${h.address.split(',')[0]}</b><br/>${h.systemKwp} kWp · £${h.year1Saving}/yr · score ${h.score}`).addTo(layer)
    }
    if (pts.length) m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 18 })
    return () => { layer.remove() }
  }, [homes])
  return (
    <div className="rounded-card overflow-hidden border border-border shadow-card relative flex-1 min-h-[560px]">
      <div ref={el} className="absolute inset-0" />
      {!homes.length && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="bg-white/95 rounded-xl px-4 py-3 text-[13px] text-ink-3 shadow-lift flex items-center gap-2"><Layers size={15} />Run a search to see homes on the map</div></div>}
    </div>
  )
}
