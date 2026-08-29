import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Chip, Segmented, Kpi } from '../components/ui'
import { Sun, Radar, Search, Send, Sparkle, Person, Check, Bolt, Target, Layers, Building, Flow } from '../components/icons'
import { useActions, useState_ } from '../store/store'
import { money, classNames } from '../lib/format'
import { runCommercialSolarEngine, type CommercialProspect, type EngineProgress, type CommercialCriteria } from '../lib/commercialSolar'
import { parseBrief, geocodeLocation, prospectToSolar, revealContactsFor, type ParsedBrief } from '../lib/commercialFinder'
import type { SolarProspect, SolarProspectStatus } from '../store/types'
import { SOLAR_STATUSES } from '../store/types'

type Mode = 'radius' | 'bulk' | 'single'
type Params = { industry: string; targetKwp: number; location: string; radiusKm: number; count: number; jobTitles: string[] }
type ChatMsg = { role: 'ovi' | 'you'; text: string }

const DEFAULT_PARAMS: Params = { industry: 'warehouses', targetKwp: 250, location: '', radiusKm: 5, count: 20, jobTitles: ['Managing Director', 'Facilities Manager'] }
const MODE_LABELS: Record<Mode, string> = { radius: 'Radius (pin)', bulk: 'Bulk (area)', single: 'Single site' }

const STARTERS = [
  'Find 30 warehouses within 5km of Wolverhampton, target 250 kWp',
  'Scan manufacturing sites in the West Midlands for Facilities Managers',
  'Cold storage businesses near B70, 500 kWp+, contact Operations Directors',
]

const STATUS_META: Record<SolarProspectStatus, { label: string; tone: string }> = {
  prospected: { label: 'Prospected', tone: '#64748B' },
  researched: { label: 'Researched', tone: '#7C3AED' },
  contacted: { label: 'Contacted', tone: '#3B6BF5' },
  replied: { label: 'Replied', tone: '#0EA5E9' },
  meeting: { label: 'Meeting', tone: '#F59E0B' },
  proposal: { label: 'Proposal', tone: '#8B5CF6' },
  won: { label: 'Won', tone: '#0E9F6E' },
  lost: { label: 'Lost', tone: '#B01B4F' },
}

const scoreTone = (s: number) => (s >= 80 ? '#0E9F6E' : s >= 65 ? '#3B6BF5' : '#F59E0B')

/* ============================ Finder ============================ */
export function CommercialSolarFinder() {
  const act = useActions()
  const nav = useNavigate()
  const { solarProspects, solarCampaigns } = useState_()
  const [mode, setMode] = useState<Mode>('radius')
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS)
  const [chat, setChat] = useState<ChatMsg[]>([
    { role: 'ovi', text: "I'm Ovi. Tell me who you're after and I'll scan the roofs, measure every one, and score the hottest solar prospects. Try a starter below, or just describe your ideal customer." },
  ])
  const [draft, setDraft] = useState('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<EngineProgress | null>(null)
  const [results, setResults] = useState<CommercialProspect[]>([])
  const [lastCampaign, setLastCampaign] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const set = (patch: Partial<Params>) => setParams((p) => ({ ...p, ...patch }))

  function applyBrief(b: ParsedBrief): Params {
    const next: Params = { ...params }
    if (b.industry) next.industry = b.industry
    if (b.location) next.location = b.location
    if (b.radiusKm) next.radiusKm = b.radiusKm
    if (b.targetKwp) next.targetKwp = b.targetKwp
    if (b.count) next.count = b.count
    if (b.jobTitles?.length) next.jobTitles = b.jobTitles
    setParams(next)
    return next
  }

  function sendChat(text: string) {
    const t = text.trim()
    if (!t) return
    setDraft('')
    setChat((c) => [...c, { role: 'you', text: t }])
    const brief = parseBrief(t)
    const next = applyBrief(brief)
    if (mode === 'single' && !brief.location) setMode('radius')
    const needsLoc = mode !== 'bulk' ? !next.location : !next.location
    const summary = `Got it — ${next.count} ${next.industry}${next.location ? (mode === 'radius' ? ` within ${next.radiusKm} km of ${next.location}` : ` in ${next.location}`) : ''}, targeting ~${next.targetKwp} kWp roofs${next.jobTitles.length ? `, decision-makers: ${next.jobTitles.join(', ')}` : ''}.`
    const ask = needsLoc ? ' Where should I look? Give me a town, postcode, or area.' : ' Hit **Run scan** and I’ll get to work.'
    setChat((c) => [...c, { role: 'ovi', text: summary + ask }])
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function runScan() {
    if (running) return
    if (mode !== 'bulk' && !params.location) { act.toast('Add a location to scan from', 'warning'); return }
    if (mode === 'bulk' && !params.location) { act.toast('Add an area to scan', 'warning'); return }
    setRunning(true); setResults([]); setProgress(null); setLastCampaign(null)

    // Resolve the pin for radius/single modes.
    let pin: { lat: number; lng: number } | undefined
    if (mode !== 'bulk') {
      setProgress({ stage: 'discover', message: `Locating ${params.location}…` })
      const g = await geocodeLocation(params.location)
      if (!g) { act.toast('Could not find that location', 'warning'); setRunning(false); return }
      pin = { lat: g.lat, lng: g.lng }
    }

    const campaign = act.createSolarCampaign({
      name: campaignName(mode, params),
      industry: params.industry, area: mode === 'bulk' ? params.location : undefined,
      pin, radiusM: mode === 'radius' ? params.radiusKm * 1000 : mode === 'single' ? 200 : undefined,
      targetKwp: params.targetKwp, jobTitles: params.jobTitles, count: mode === 'single' ? 1 : params.count, status: 'scanning',
    })

    const criteria: CommercialCriteria = {
      industry: params.industry,
      area: mode === 'bulk' ? params.location : undefined,
      pin, radiusM: mode === 'radius' ? params.radiusKm * 1000 : mode === 'single' ? 200 : undefined,
      targetKwp: params.targetKwp, jobTitles: params.jobTitles,
      count: mode === 'single' ? 1 : params.count,
      skipPeople: true, // reveal contacts on demand — don't spend PDL during the scan
    }

    const live: CommercialProspect[] = []
    const { scanned } = await runCommercialSolarEngine(
      criteria,
      (p) => setProgress(p),
      (prospect) => { live.push(prospect); setResults((r) => [...r, prospect].sort((a, b) => b.score - a.score)) },
    )

    // Persist as prospects under the campaign.
    act.addSolarProspects(live.map((p) => prospectToSolar(p, campaign.id)))
    act.updateSolarCampaign(campaign.id, { status: 'complete', scanned })
    setLastCampaign(campaign.id)
    setRunning(false)
    setChat((c) => [...c, { role: 'ovi', text: `Done — I scanned ${scanned} buildings and qualified **${live.length}** with roofs worth pursuing. They're saved to the campaign and your pipeline. Reveal contacts on the ones you like.` }])
    act.toast(`${live.length} prospects saved to pipeline`)
  }

  const totalKwp = results.reduce((s, p) => s + p.design.systemKwp, 0)
  const totalSaving = results.reduce((s, p) => s + p.design.annualSavings, 0)

  return (
    <>
      <TopBar title="Commercial Solar Finder" crumbs={['Find', 'Prospecting']}
        actions={<Button variant="secondary" icon={<Flow size={15} />} onClick={() => nav('/reach/solar/pipeline')}>Pipeline</Button>} />
      <PageBody>
        <div className="grid grid-cols-[380px_1fr] gap-5 flex-1 min-h-0">
          {/* ─── Ovi chat ─── */}
          <div className="flex flex-col rounded-card bg-surface border border-border overflow-hidden min-h-0">
            <div className="px-4 py-3 border-b border-divider flex items-center gap-2.5" style={{ background: 'linear-gradient(135deg,#3B6BF5 0%,#7C3AED 100%)' }}>
              <span className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white"><Sparkle size={17} /></span>
              <div><div className="text-white font-bold text-[14px] leading-tight">Ovi finds your leads</div><div className="text-white/70 text-[11.5px]">Chat to set up a scan</div></div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
              {chat.map((m, i) => (
                <div key={i} className={classNames('max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug', m.role === 'ovi' ? 'bg-control text-ink-2 self-start rounded-tl-sm' : 'text-white self-end rounded-tr-sm')} style={m.role === 'you' ? { background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' } : undefined}>
                  {renderText(m.text)}
                </div>
              ))}
              {chat.length === 1 && (
                <div className="flex flex-col gap-2 mt-1">
                  <div className="eyebrow text-[10px] text-muted-3">Try a starter</div>
                  {STARTERS.map((s) => (
                    <button key={s} onClick={() => sendChat(s)} className="text-left text-[12.5px] px-3 py-2 rounded-xl border border-border bg-surface hover:border-accent hover:bg-accent-wash text-ink-3 transition-colors">{s}</button>
                  ))}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-divider flex items-center gap-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChat(draft)}
                placeholder="Describe your ideal customer…" className="flex-1 h-10 px-3 rounded-control border border-input-border bg-white text-[13.5px] outline-none focus:border-accent" />
              <button onClick={() => sendChat(draft)} className="w-10 h-10 rounded-control text-white flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Send size={16} /></button>
            </div>
          </div>

          {/* ─── Modes + params + results ─── */}
          <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">
            <div className="flex items-center justify-between gap-3">
              <Segmented value={MODE_LABELS[mode]} options={Object.values(MODE_LABELS)}
                onChange={(l) => setMode((Object.keys(MODE_LABELS) as Mode[]).find((k) => MODE_LABELS[k] === l) ?? 'radius')} />
              <Button variant="primary" icon={<Radar size={16} />} onClick={runScan} className={running ? 'opacity-60 pointer-events-none' : ''}>
                {running ? 'Scanning…' : mode === 'single' ? 'Analyse site' : 'Run scan'}
              </Button>
            </div>

            <ParamsPanel mode={mode} params={params} set={set} />

            {running && progress && (
              <div className="rounded-card bg-surface border border-border px-4 py-3 flex items-center gap-3">
                <span className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin shrink-0" />
                <div className="flex-1 text-[13px] text-ink-2">{progress.message}</div>
                {progress.scanned != null && <div className="text-[12px] text-muted-2">{progress.found ?? 0} qualified · {progress.scanned}/{progress.total ?? '…'} scanned</div>}
              </div>
            )}

            {results.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <Kpi variant="deep" label="Qualified" value={String(results.length)} delta={lastCampaign ? 'Saved to pipeline' : 'Scanning…'} />
                <Kpi variant="blue" label="Total capacity" value={`${Math.round(totalKwp)} kWp`} delta="Combined" deltaTone="muted" />
                <Kpi label="Est. annual savings" value={money(totalSaving, { compact: true })} delta="Across all sites" />
              </div>
            )}

            {results.length === 0 && !running ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-2 gap-3 pb-4">
                {results.map((p) => <ScoredCard key={p.id} p={p} campaignId={lastCampaign} />)}
              </div>
            )}

            {solarCampaigns.length > 0 && results.length === 0 && !running && (
              <RecentCampaigns campaigns={solarCampaigns} prospects={solarProspects} onOpen={() => nav('/reach/solar/pipeline')} />
            )}
          </div>
        </div>
      </PageBody>
    </>
  )
}

function campaignName(mode: Mode, p: Params): string {
  if (mode === 'bulk') return `${cap(p.industry)} in ${p.location || 'area'}`
  if (mode === 'single') return `Single site · ${p.location}`
  return `${cap(p.industry)} · ${p.radiusKm}km of ${p.location}`
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function ParamsPanel({ mode, params, set }: { mode: Mode; params: Params; set: (p: Partial<Params>) => void }) {
  return (
    <div className="rounded-card bg-surface border border-border p-4 grid grid-cols-2 gap-x-5 gap-y-3.5">
      <Field label={mode === 'single' ? 'Address or place' : mode === 'bulk' ? 'Area (town / postcode)' : 'Centre (town / postcode)'}>
        <input value={params.location} onChange={(e) => set({ location: e.target.value })} placeholder={mode === 'bulk' ? 'e.g. West Midlands' : 'e.g. Wolverhampton'} className={inputCls} />
      </Field>
      <Field label="Industry">
        <input value={params.industry} onChange={(e) => set({ industry: e.target.value })} placeholder="warehouses, manufacturing…" className={inputCls} />
      </Field>
      {mode === 'radius' && (
        <Field label={`Radius — ${params.radiusKm} km`}>
          <input type="range" min={0.5} max={25} step={0.5} value={params.radiusKm} onChange={(e) => set({ radiusKm: parseFloat(e.target.value) })} className="w-full accent-accent" />
        </Field>
      )}
      <Field label={`Target system size — ${params.targetKwp} kWp`}>
        <input type="range" min={20} max={1000} step={10} value={params.targetKwp} onChange={(e) => set({ targetKwp: parseInt(e.target.value, 10) })} className="w-full accent-accent" />
      </Field>
      {mode !== 'single' && (
        <Field label={`How many — ${params.count}`}>
          <input type="range" min={5} max={100} step={5} value={params.count} onChange={(e) => set({ count: parseInt(e.target.value, 10) })} className="w-full accent-accent" />
        </Field>
      )}
      <Field label="Decision-maker titles" full>
        <input value={params.jobTitles.join(', ')} onChange={(e) => set({ jobTitles: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="Managing Director, Facilities Manager" className={inputCls} />
      </Field>
    </div>
  )
}
const inputCls = 'h-9 w-full px-3 rounded-control border border-input-border bg-white text-[13px] outline-none focus:border-accent'
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={classNames('flex flex-col gap-1.5', full && 'col-span-2')}><span className="eyebrow text-[10px] text-muted-3">{label}</span>{children}</label>
}

/* ─── Scored roof card ─── */
function ScoredCard({ p, campaignId }: { p: CommercialProspect; campaignId: string | null }) {
  const act = useActions()
  const { solarProspects } = useState_()
  const stored = solarProspects.find((s) => s.id === p.id)
  const [revealing, setRevealing] = useState(false)
  const d = p.design

  async function reveal() {
    if (!stored || revealing) return
    setRevealing(true)
    const contacts = await revealContactsFor(stored, undefined)
    act.revealSolarContacts(stored.id, contacts)
    setRevealing(false)
  }

  return (
    <div className="rounded-card bg-surface border border-border overflow-hidden flex flex-col">
      <div className="relative h-[130px] bg-control">
        {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />}
        <span className="absolute top-2 left-2 text-[11px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: scoreTone(p.score) }}>{p.score}</span>
        {p.roofMeasured && <span className="absolute top-2 right-2 text-[10px] font-semibold text-white bg-black/45 px-1.5 py-0.5 rounded">Measured</span>}
        {p.distanceM != null && <span className="absolute bottom-2 right-2 text-[10px] font-semibold text-white bg-black/45 px-1.5 py-0.5 rounded">{(p.distanceM / 1000).toFixed(1)} km</span>}
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <div className="font-bold text-[13.5px] text-ink truncate">{p.company}</div>
          <div className="text-[11.5px] text-muted-2 truncate">{p.address}</div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <Stat v={`${Math.round(d.systemKwp)}`} u="kWp" />
          <Stat v={money(d.annualSavings, { compact: true })} u="yr 1" />
          <Stat v={`${d.payback.toFixed(1)}y`} u="payback" />
        </div>
        {stored?.contactsRevealed && stored.contacts.length > 0 ? (
          <div className="flex flex-col gap-1">
            {stored.contacts.slice(0, 2).map((c) => (
              <div key={c.id} className="flex items-center gap-1.5 text-[11.5px]"><Person size={12} className="text-muted-2 shrink-0" /><span className="font-semibold text-ink-2 truncate">{c.name}</span><span className="text-muted-2 truncate">· {c.title}</span></div>
            ))}
          </div>
        ) : (
          <button onClick={reveal} disabled={revealing} className="text-[12px] font-semibold text-accent flex items-center gap-1.5 hover:underline disabled:opacity-50">
            {revealing ? <span className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" /> : <Person size={13} />}
            {revealing ? 'Revealing…' : 'Reveal contacts (1 credit)'}
          </button>
        )}
        <div className="mt-auto flex items-center gap-2 pt-1">
          {stored && (
            <select value={stored.status} onChange={(e) => act.setSolarProspectStatus(stored.id, e.target.value as SolarProspectStatus)}
              className="flex-1 h-8 px-2 rounded-control border border-input-border bg-white text-[12px] outline-none focus:border-accent">
              {SOLAR_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          )}
        </div>
      </div>
    </div>
  )
}
function Stat({ v, u }: { v: string; u: string }) {
  return <div className="rounded-lg bg-control py-1.5"><div className="text-[14px] font-bold text-ink leading-none">{v}</div><div className="text-[9.5px] text-muted-2 mt-0.5 uppercase tracking-wide">{u}</div></div>
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16 rounded-card border border-dashed border-border">
      <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Sun size={28} /></span>
      <div className="text-[16px] font-bold text-ink">Chat to Ovi, or set it up on the right</div>
      <div className="text-[13px] text-muted-b max-w-[460px]">Pick a mode — <b>Radius</b> scans every business around a pin, <b>Bulk</b> sweeps a whole area, <b>Single site</b> measures one roof. Ovi measures each roof from satellite, sizes the system for best payback, and scores the hottest prospects.</div>
    </div>
  )
}

function RecentCampaigns({ campaigns, prospects, onOpen }: { campaigns: import('../store/types').SolarCampaign[]; prospects: SolarProspect[]; onOpen: () => void }) {
  return (
    <div className="rounded-card bg-surface border border-border p-4">
      <div className="flex items-center justify-between mb-3"><div className="font-bold text-[14px] text-ink">Saved campaigns</div><button onClick={onOpen} className="text-[12.5px] font-semibold text-accent hover:underline">Open pipeline →</button></div>
      <div className="flex flex-col gap-2">
        {campaigns.slice(0, 5).map((c) => {
          const n = prospects.filter((p) => p.campaignId === c.id).length
          return (
            <div key={c.id} className="flex items-center gap-3 py-2 border-b border-divider last:border-0">
              <span className="w-8 h-8 rounded-lg bg-accent-wash flex items-center justify-center text-accent shrink-0"><Radar size={15} /></span>
              <div className="flex-1 min-w-0"><div className="font-semibold text-[13px] text-ink-2 truncate">{c.name}</div><div className="text-[11.5px] text-muted-2">{n} prospects · {c.status}</div></div>
              <Chip tone="neutral">{n}</Chip>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ============================ Pipeline (Kanban + List) ============================ */
export function SolarPipeline() {
  const nav = useNavigate()
  const act = useActions()
  const { solarProspects, solarCampaigns } = useState_()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [campaignFilter, setCampaignFilter] = useState<string>('all')

  const filtered = useMemo(() => solarProspects.filter((p) => campaignFilter === 'all' || p.campaignId === campaignFilter), [solarProspects, campaignFilter])

  return (
    <>
      <TopBar title="Solar pipeline" crumbs={['Find', 'Commercial Solar']}
        actions={<Button variant="primary" icon={<Radar size={15} />} onClick={() => nav('/reach/solar')}>New scan</Button>} />
      <PageBody>
        <div className="flex items-center justify-between gap-3">
          <Segmented value={view === 'kanban' ? 'Kanban' : 'List'} options={['Kanban', 'List']} onChange={(l) => setView(l === 'Kanban' ? 'kanban' : 'list')} />
          <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} className="h-9 px-3 rounded-control border border-input-border bg-white text-[13px] outline-none focus:border-accent">
            <option value="all">All campaigns ({solarProspects.length})</option>
            {solarCampaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16">
            <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Flow size={26} /></span>
            <div className="text-[16px] font-bold text-ink">No prospects yet</div>
            <div className="text-[13px] text-muted-b">Run a scan in the Commercial Solar Finder to fill your pipeline.</div>
            <Button variant="primary" icon={<Radar size={15} />} onClick={() => nav('/reach/solar')}>Open the finder</Button>
          </div>
        ) : view === 'kanban' ? (
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-3 min-w-max pb-4">
              {SOLAR_STATUSES.map((s) => {
                const col = filtered.filter((p) => p.status === s)
                return (
                  <div key={s} className="w-[248px] shrink-0 flex flex-col">
                    <div className="flex items-center gap-2 px-1 mb-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: STATUS_META[s].tone }} />
                      <span className="text-[12.5px] font-bold text-ink-2">{STATUS_META[s].label}</span>
                      <span className="text-[11px] text-muted-2">{col.length}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {col.map((p) => <PipelineCard key={p.id} p={p} onMove={(st) => act.setSolarProspectStatus(p.id, st)} />)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-card bg-surface border border-border overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.2fr] px-4 py-2.5 border-b border-divider eyebrow text-[10px] text-muted-3">
              <span>Company</span><span className="text-right">kWp</span><span className="text-right">Yr 1</span><span className="text-right">Payback</span><span>Status</span>
            </div>
            {filtered.map((p) => (
              <div key={p.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1.2fr] px-4 py-2.5 border-b border-divider last:border-0 items-center text-[13px] hover:bg-control/40">
                <div className="min-w-0"><div className="font-semibold text-ink-2 truncate">{p.company}</div><div className="text-[11.5px] text-muted-2 truncate">{p.address}</div></div>
                <div className="text-right font-semibold text-ink-2">{Math.round(p.systemKwp)}</div>
                <div className="text-right text-positive font-semibold">{money(p.year1Saving, { compact: true })}</div>
                <div className="text-right text-ink-2">{p.paybackYears}y</div>
                <select value={p.status} onChange={(e) => act.setSolarProspectStatus(p.id, e.target.value as SolarProspectStatus)} className="h-8 px-2 rounded-control border border-input-border bg-white text-[12px] outline-none focus:border-accent">
                  {SOLAR_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </PageBody>
    </>
  )
}

function PipelineCard({ p, onMove }: { p: SolarProspect; onMove: (s: SolarProspectStatus) => void }) {
  const idx = SOLAR_STATUSES.indexOf(p.status)
  return (
    <div className="rounded-xl bg-surface border border-border p-2.5 flex flex-col gap-2">
      <div className="flex items-start gap-2">
        {p.imageUrl && <img src={p.imageUrl} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />}
        <div className="min-w-0 flex-1"><div className="font-bold text-[12.5px] text-ink truncate">{p.company}</div><div className="text-[11px] text-muted-2 truncate">{Math.round(p.systemKwp)} kWp · {money(p.year1Saving, { compact: true })}/yr</div></div>
        <span className="text-[10.5px] font-bold text-white px-1.5 py-0.5 rounded-full shrink-0" style={{ background: scoreTone(p.score) }}>{p.score}</span>
      </div>
      <div className="flex items-center gap-1">
        <button disabled={idx <= 0} onClick={() => onMove(SOLAR_STATUSES[idx - 1])} className="flex-1 h-6 rounded-md border border-border text-[11px] text-muted-b hover:bg-control disabled:opacity-30">←</button>
        {p.contactsRevealed && p.contacts[0] && <span className="text-[10.5px] text-muted-2 truncate px-1">{p.contacts[0].name}</span>}
        <button disabled={idx >= SOLAR_STATUSES.length - 1} onClick={() => onMove(SOLAR_STATUSES[idx + 1])} className="flex-1 h-6 rounded-md border border-border text-[11px] text-muted-b hover:bg-control disabled:opacity-30">→</button>
      </div>
    </div>
  )
}

/* tiny markdown-ish bold renderer for chat */
function renderText(t: string) {
  const parts = t.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>))
}
