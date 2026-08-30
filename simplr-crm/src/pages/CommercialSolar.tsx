import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Chip, Segmented, Kpi } from '../components/ui'
import { PillTabs } from '../components/chrome'
import { Sun, Radar, Send, Sparkle, Person, Bolt, Flow, Search, Building, Layers, Check, Target, Envelope } from '../components/icons'
import { useActions, useState_ } from '../store/store'
import { money, classNames } from '../lib/format'
import { runCommercialSolarEngine, type CommercialProspect, type EngineProgress, type CommercialCriteria } from '../lib/commercialSolar'
import { parseBrief, geocodeLocation, prospectToSolar, revealContactsFor, type ParsedBrief } from '../lib/commercialFinder'
import type { SolarProspect, SolarProspectStatus } from '../store/types'
import { SOLAR_STATUSES } from '../store/types'
import { RoofOverlay } from '../components/RoofOverlay'

const TOOL = 'commercial-solar'

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

export const STATUS_META: Record<SolarProspectStatus, { label: string; tone: string }> = {
  prospected: { label: 'Prospected', tone: '#64748B' }, researched: { label: 'Researched', tone: '#7C3AED' },
  contacted: { label: 'Contacted', tone: '#3B6BF5' }, replied: { label: 'Replied', tone: '#0EA5E9' },
  meeting: { label: 'Meeting', tone: '#F59E0B' }, proposal: { label: 'Proposal', tone: '#8B5CF6' },
  won: { label: 'Won', tone: '#0E9F6E' }, lost: { label: 'Lost', tone: '#B01B4F' },
}
export const scoreTone = (s: number) => (s >= 80 ? '#0E9F6E' : s >= 65 ? '#3B6BF5' : '#F59E0B')

/* ══════════════════════ The Commercial Solar Tool (tabbed) ══════════════════════ */
export function CommercialSolarTool() {
  const act = useActions()
  const nav = useNavigate()
  const { solarProspects, solarCampaigns } = useState_()
  const [tab, setTab] = useState('chat')
  const [detailId, setDetailId] = useState<string | null>(null)

  // scan setup
  const [mode, setMode] = useState<Mode>('radius')
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS)
  const [chat, setChat] = useState<ChatMsg[]>([{ role: 'ovi', text: "I'm Ovi. Tell me who you're after and I'll scan the roofs, measure every one, and score the hottest solar prospects. Try a starter below, or just describe your ideal customer." }])
  const [draft, setDraft] = useState('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<EngineProgress | null>(null)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const toolProspects = useMemo(() => solarProspects.filter((p) => (p.tool ?? TOOL) === TOOL), [solarProspects])
  const toolCampaigns = useMemo(() => solarCampaigns.filter((c) => (c.tool ?? TOOL) === TOOL), [solarCampaigns])
  const currentProspects = useMemo(() => (campaignId ? toolProspects.filter((p) => p.campaignId === campaignId) : toolProspects), [toolProspects, campaignId])
  const detail = detailId ? solarProspects.find((p) => p.id === detailId) ?? null : null

  const set = (patch: Partial<Params>) => setParams((p) => ({ ...p, ...patch }))
  function applyBrief(b: ParsedBrief): Params {
    const next: Params = { ...params }
    if (b.industry) next.industry = b.industry; if (b.location) next.location = b.location
    if (b.radiusKm) next.radiusKm = b.radiusKm; if (b.targetKwp) next.targetKwp = b.targetKwp
    if (b.count) next.count = b.count; if (b.jobTitles?.length) next.jobTitles = b.jobTitles
    setParams(next); return next
  }
  function sendChat(text: string) {
    const t = text.trim(); if (!t) return
    setDraft(''); setChat((c) => [...c, { role: 'you', text: t }])
    const next = applyBrief(parseBrief(t))
    const needsLoc = !next.location
    const summary = `Got it — ${next.count} ${next.industry}${next.location ? (mode === 'radius' ? ` within ${next.radiusKm} km of ${next.location}` : ` in ${next.location}`) : ''}, targeting ~${next.targetKwp} kWp roofs${next.jobTitles.length ? `, decision-makers: ${next.jobTitles.join(', ')}` : ''}.`
    setChat((c) => [...c, { role: 'ovi', text: summary + (needsLoc ? ' Where should I look? Give me a town, postcode, or area.' : ' Hit **Run scan** and I’ll get to work.') }])
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function runScan() {
    if (running) return
    if (!params.location) { act.toast('Add a location to scan', 'warning'); return }
    setRunning(true); setProgress(null)
    let pin: { lat: number; lng: number } | undefined
    if (mode !== 'bulk') {
      setProgress({ stage: 'discover', message: `Locating ${params.location}…` })
      const g = await geocodeLocation(params.location)
      if (!g) { act.toast('Could not find that location', 'warning'); setRunning(false); return }
      pin = { lat: g.lat, lng: g.lng }
    }
    const campaign = act.createSolarCampaign({
      name: campaignName(mode, params), tool: TOOL, industry: params.industry,
      area: mode === 'bulk' ? params.location : undefined, pin,
      radiusM: mode === 'radius' ? params.radiusKm * 1000 : mode === 'single' ? 200 : undefined,
      targetKwp: params.targetKwp, jobTitles: params.jobTitles, count: mode === 'single' ? 1 : params.count, status: 'scanning',
    })
    setCampaignId(campaign.id)
    const criteria: CommercialCriteria = {
      industry: params.industry, area: mode === 'bulk' ? params.location : undefined, pin,
      radiusM: mode === 'radius' ? params.radiusKm * 1000 : mode === 'single' ? 200 : undefined,
      targetKwp: params.targetKwp, jobTitles: params.jobTitles, count: mode === 'single' ? 1 : params.count, skipPeople: true,
    }
    let first = true; let n = 0
    const { scanned } = await runCommercialSolarEngine(criteria, (p) => setProgress(p), (prospect: CommercialProspect) => {
      act.addSolarProspects([prospectToSolar(prospect, campaign.id, TOOL)]); n++
      if (first) { first = false; setTab('roofs') } // jump to the roofs as they appear
    })
    act.updateSolarCampaign(campaign.id, { status: 'complete', scanned })
    setRunning(false)
    setChat((c) => [...c, { role: 'ovi', text: `Done — I scanned ${scanned} buildings and qualified **${n}** with roofs worth pursuing. Open **Scanned roofs** to see them, or the **Pipeline** to work them.` }])
    act.toast(`${n} prospects saved`)
  }

  const tabs = [
    { id: 'chat', label: 'Chat', icon: Sparkle },
    { id: 'roofs', label: `Scanned roofs${currentProspects.length ? ` (${currentProspects.length})` : ''}`, icon: Sun },
    { id: 'pipeline', label: 'Pipeline', icon: Flow },
    { id: 'database', label: 'Database', icon: Layers },
  ]

  return (
    <>
      <TopBar title="Commercial Solar Finder" crumbs={['Tools']}
        center={<PillTabs tabs={tabs} value={tab} onChange={setTab} />}
        actions={<Button variant="secondary" icon={<Radar size={15} />} onClick={() => nav('/tools')}>All tools</Button>} />
      <PageBody>
        {tab === 'chat' && (
          <ChatTab {...{ mode, setMode, params, set, chat, draft, setDraft, sendChat, running, progress, runScan, chatEndRef }} />
        )}
        {tab === 'roofs' && (
          <RoofsTab prospects={currentProspects} running={running} progress={progress}
            campaigns={toolCampaigns} campaignId={campaignId} setCampaignId={setCampaignId} onOpen={setDetailId} />
        )}
        {tab === 'pipeline' && <PipelineBoard prospects={toolProspects} onOpen={setDetailId} />}
        {tab === 'database' && <ProspectDatabase prospects={toolProspects} onOpen={setDetailId} />}
      </PageBody>
      {detail && <ProspectDetail p={detail} jobTitles={params.jobTitles} onClose={() => setDetailId(null)} />}
    </>
  )
}

function campaignName(mode: Mode, p: Params): string {
  if (mode === 'bulk') return `${cap(p.industry)} in ${p.location || 'area'}`
  if (mode === 'single') return `Single site · ${p.location}`
  return `${cap(p.industry)} · ${p.radiusKm}km of ${p.location}`
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/* ─────────── Chat tab (setup) ─────────── */
function ChatTab({ mode, setMode, params, set, chat, draft, setDraft, sendChat, running, progress, runScan, chatEndRef }: any) {
  return (
    <div className="grid grid-cols-[minmax(360px,420px)_1fr] gap-5 flex-1 min-h-0">
      <div className="flex flex-col rounded-card bg-surface border border-border overflow-hidden min-h-0">
        <div className="px-4 py-3 border-b border-divider flex items-center gap-2.5" style={{ background: 'linear-gradient(135deg,#3B6BF5 0%,#7C3AED 100%)' }}>
          <span className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white"><Sparkle size={17} /></span>
          <div><div className="text-white font-bold text-[14px] leading-tight">Ovi finds your leads</div><div className="text-white/70 text-[11.5px]">Describe your ideal customer</div></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
          {chat.map((m: ChatMsg, i: number) => (
            <div key={i} className={classNames('max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug', m.role === 'ovi' ? 'bg-control text-ink-2 self-start rounded-tl-sm' : 'text-white self-end rounded-tr-sm')} style={m.role === 'you' ? { background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' } : undefined}>{renderText(m.text)}</div>
          ))}
          {chat.length === 1 && (
            <div className="flex flex-col gap-2 mt-1">
              <div className="eyebrow text-[10px] text-muted-3">Try a starter</div>
              {STARTERS.map((s) => <button key={s} onClick={() => sendChat(s)} className="text-left text-[12.5px] px-3 py-2 rounded-xl border border-border bg-surface hover:border-accent hover:bg-accent-wash text-ink-3 transition-colors">{s}</button>)}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="p-3 border-t border-divider flex items-center gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChat(draft)} placeholder="Describe your ideal customer…" className="flex-1 h-10 px-3 rounded-control border border-input-border bg-white text-[13.5px] outline-none focus:border-accent" />
          <button onClick={() => sendChat(draft)} className="w-10 h-10 rounded-control text-white flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Send size={16} /></button>
        </div>
      </div>

      <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <Segmented value={MODE_LABELS[mode as Mode]} options={Object.values(MODE_LABELS)} onChange={(l) => setMode((Object.keys(MODE_LABELS) as Mode[]).find((k) => MODE_LABELS[k] === l) ?? 'radius')} />
          <Button variant="primary" icon={<Radar size={16} />} onClick={runScan} className={running ? 'opacity-60 pointer-events-none' : ''}>{running ? 'Scanning…' : mode === 'single' ? 'Analyse site' : 'Run scan'}</Button>
        </div>
        <ParamsPanel mode={mode} params={params} set={set} />
        {running && progress && (
          <div className="rounded-card bg-surface border border-border px-4 py-3 flex items-center gap-3">
            <span className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin shrink-0" />
            <div className="flex-1 text-[13px] text-ink-2">{progress.message}</div>
            {progress.scanned != null && <div className="text-[12px] text-muted-2">{progress.found ?? 0} qualified · {progress.scanned}/{progress.total ?? '…'}</div>}
          </div>
        )}
        <HowItWorks />
      </div>
    </div>
  )
}

function HowItWorks() {
  const steps = [
    { icon: Radar, t: 'Discover', d: 'Scan every business in a radius, area, or a single site' },
    { icon: Sun, t: 'Measure', d: 'Each roof measured from satellite — real kWp potential' },
    { icon: Target, t: 'Score', d: 'Sized for best payback, scored on the opportunity' },
    { icon: Person, t: 'Reveal', d: 'Unlock the decision-makers when you’re ready' },
  ]
  return (
    <div className="rounded-card bg-surface border border-border p-4 grid grid-cols-4 gap-3">
      {steps.map((s, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><s.icon size={17} /></span>
          <div className="text-[13px] font-bold text-ink mt-1">{i + 1}. {s.t}</div>
          <div className="text-[11.5px] text-muted-b leading-snug">{s.d}</div>
        </div>
      ))}
    </div>
  )
}

const inputCls = 'h-9 w-full px-3 rounded-control border border-input-border bg-white text-[13px] outline-none focus:border-accent'
function ParamsPanel({ mode, params, set }: { mode: Mode; params: Params; set: (p: Partial<Params>) => void }) {
  return (
    <div className="rounded-card bg-surface border border-border p-4 grid grid-cols-2 gap-x-5 gap-y-3.5">
      <Field label={mode === 'single' ? 'Address or place' : mode === 'bulk' ? 'Area (town / postcode)' : 'Centre (town / postcode)'}>
        <input value={params.location} onChange={(e) => set({ location: e.target.value })} placeholder={mode === 'bulk' ? 'e.g. West Midlands' : 'e.g. Wolverhampton'} className={inputCls} />
      </Field>
      <Field label="Industry"><input value={params.industry} onChange={(e) => set({ industry: e.target.value })} placeholder="warehouses, manufacturing…" className={inputCls} /></Field>
      {mode === 'radius' && <Field label={`Radius — ${params.radiusKm} km`}><input type="range" min={0.5} max={25} step={0.5} value={params.radiusKm} onChange={(e) => set({ radiusKm: parseFloat(e.target.value) })} className="w-full accent-accent" /></Field>}
      <Field label={`Target system size — ${params.targetKwp} kWp`}><input type="range" min={20} max={1000} step={10} value={params.targetKwp} onChange={(e) => set({ targetKwp: parseInt(e.target.value, 10) })} className="w-full accent-accent" /></Field>
      {mode !== 'single' && <Field label={`How many — ${params.count}`}><input type="range" min={5} max={100} step={5} value={params.count} onChange={(e) => set({ count: parseInt(e.target.value, 10) })} className="w-full accent-accent" /></Field>}
      <Field label="Decision-maker titles" full><input value={params.jobTitles.join(', ')} onChange={(e) => set({ jobTitles: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="Managing Director, Facilities Manager" className={inputCls} /></Field>
    </div>
  )
}
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={classNames('flex flex-col gap-1.5', full && 'col-span-2')}><span className="eyebrow text-[10px] text-muted-3">{label}</span>{children}</label>
}

/* ─────────── Scanned roofs tab ─────────── */
function RoofsTab({ prospects, running, progress, campaigns, campaignId, setCampaignId, onOpen }: {
  prospects: SolarProspect[]; running: boolean; progress: EngineProgress | null
  campaigns: import('../store/types').SolarCampaign[]; campaignId: string | null; setCampaignId: (id: string | null) => void; onOpen: (id: string) => void
}) {
  const totalKwp = prospects.reduce((s, p) => s + p.systemKwp, 0)
  const totalSaving = prospects.reduce((s, p) => s + p.year1Saving, 0)
  const measured = prospects.filter((p) => p.roofMeasured).length
  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-[15px] font-bold text-ink">{prospects.length} roofs</div>
          {running && <span className="text-[12.5px] text-accent flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" />{progress?.message}</span>}
        </div>
        <select value={campaignId ?? 'all'} onChange={(e) => setCampaignId(e.target.value === 'all' ? null : e.target.value)} className="h-9 px-3 rounded-control border border-input-border bg-white text-[13px] outline-none focus:border-accent">
          <option value="all">All scans</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {prospects.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <Kpi variant="deep" label="Roofs" value={String(prospects.length)} delta={`${measured} satellite-measured`} />
          <Kpi variant="blue" label="Total capacity" value={`${Math.round(totalKwp)} kWp`} delta="Combined" deltaTone="muted" />
          <Kpi label="Est. annual savings" value={money(totalSaving, { compact: true })} delta="Across all sites" />
          <Kpi label="Avg. score" value={String(Math.round(prospects.reduce((s, p) => s + p.score, 0) / (prospects.length || 1)))} delta="Fit" deltaTone="muted" />
        </div>
      )}
      {prospects.length === 0 && !running ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-3 gap-4 pb-4">
          {[...prospects].sort((a, b) => b.score - a.score).map((p) => <BigRoofCard key={p.id} p={p} onOpen={() => onOpen(p.id)} />)}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16 rounded-card border border-dashed border-border">
      <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Sun size={28} /></span>
      <div className="text-[16px] font-bold text-ink">No roofs scanned yet</div>
      <div className="text-[13px] text-muted-b max-w-[460px]">Head to the <b>Chat</b> tab and describe your ideal customer — Ovi scans the area, measures every roof from satellite, and the buildings appear here.</div>
    </div>
  )
}

/* ─────────── Big roof card ─────────── */
export function BigRoofCard({ p, onOpen }: { p: SolarProspect; onOpen: () => void }) {
  const act = useActions()
  return (
    <div className="rounded-card bg-surface border border-border overflow-hidden flex flex-col hover:shadow-modal transition-shadow cursor-pointer group" onClick={onOpen}>
      <div className="relative aspect-[16/9] bg-control overflow-hidden">
        {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />}
        <RoofOverlay center={p.center} segments={p.roofSegments} />
        <span className="absolute top-2.5 left-2.5 text-[12px] font-bold text-white px-2.5 py-1 rounded-full shadow" style={{ background: scoreTone(p.score) }}>{p.score}</span>
        <div className="absolute top-2.5 right-2.5 flex gap-1.5">
          {p.roofMeasured && <span className="text-[10px] font-bold text-white bg-black/55 px-2 py-1 rounded backdrop-blur-sm">◆ MEASURED</span>}
          {p.epcRating && <span className="text-[10px] font-bold text-white px-2 py-1 rounded" style={{ background: epcColor(p.epcRating) }}>EPC {p.epcRating}</span>}
        </div>
        {p.distanceM != null && <span className="absolute bottom-2.5 right-2.5 text-[10.5px] font-semibold text-white bg-black/55 px-2 py-0.5 rounded backdrop-blur-sm">{(p.distanceM / 1000).toFixed(1)} km</span>}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-2 left-3 right-16">
          <div className="text-white font-bold text-[15px] leading-tight truncate drop-shadow">{p.company}</div>
          <div className="text-white/80 text-[11.5px] truncate">{p.category || p.address}</div>
        </div>
      </div>
      <div className="p-3.5 flex flex-col gap-2.5">
        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat v={`${Math.round(p.systemKwp)}`} u="kWp" />
          <Stat v={String(p.panels)} u="panels" />
          <Stat v={money(p.year1Saving, { compact: true })} u="yr 1" />
          <Stat v={`${p.paybackYears}y`} u="payback" />
        </div>
        <div className="flex items-center justify-between">
          {p.contactsRevealed && p.contacts[0]
            ? <span className="text-[12px] text-ink-2 flex items-center gap-1.5 truncate"><Person size={13} className="text-muted-2" /><b className="font-semibold truncate">{p.contacts[0].name}</b><span className="text-muted-2 truncate">· {p.contacts[0].title}</span></span>
            : <span className="text-[12px] text-muted-2 flex items-center gap-1.5"><Person size={13} />Contacts hidden</span>}
          <select value={p.status} onClick={(e) => e.stopPropagation()} onChange={(e) => act.setSolarProspectStatus(p.id, e.target.value as SolarProspectStatus)} className="h-7 px-2 rounded-control border border-input-border bg-white text-[11.5px] outline-none focus:border-accent">
            {SOLAR_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
function Stat({ v, u }: { v: string; u: string }) {
  return <div className="rounded-lg bg-control py-1.5"><div className="text-[15px] font-bold text-ink leading-none">{v}</div><div className="text-[9.5px] text-muted-2 mt-1 uppercase tracking-wide">{u}</div></div>
}
function epcColor(r: string) { const c: Record<string, string> = { A: '#0E9F6E', B: '#57A639', C: '#8DB600', D: '#F2C200', E: '#F59E0B', F: '#EA6A2A', G: '#D0342C' }; return c[r?.[0]?.toUpperCase()] || '#64748B' }

/* ─────────── Detail modal (all the data + people) ─────────── */
export function ProspectDetail({ p, onClose, jobTitles }: { p: SolarProspect; onClose: () => void; jobTitles?: string[] }) {
  const act = useActions()
  const [revealing, setRevealing] = useState(false)
  async function reveal() {
    if (revealing) return; setRevealing(true)
    const contacts = await revealContactsFor(p, jobTitles)
    act.revealSolarContacts(p.id, contacts); setRevealing(false)
    if (!contacts.length) act.toast('No contacts found for this company', 'warning')
  }
  const metrics = [
    { l: 'System size', v: `${p.systemKwp} kWp`, s: `${p.panels} panels` },
    { l: 'Annual generation', v: `${(p.annualGenKwh / 1000).toFixed(0)} MWh`, s: 'per year' },
    { l: 'Year-1 saving', v: money(p.year1Saving), s: 'energy + export', pos: true },
    { l: '25-year saving', v: money(p.lifetimeSaving, { compact: true }), s: 'lifetime', pos: true },
    { l: 'Payback', v: `${p.paybackYears} yrs`, s: 'simple' },
    { l: 'Net present value', v: money(p.npv, { compact: true }), s: 'lifetime NPV' },
    { l: 'Carbon saved', v: `${p.co2PerYearTonnes} t`, s: 'CO₂ per year' },
    { l: 'Fit score', v: String(p.score), s: 'opportunity' },
  ]
  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-surface rounded-overlay shadow-modal w-full max-w-[920px] max-h-[88vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="relative h-[240px] bg-control shrink-0">
          {p.imageUrl && <img src={p.imageUrl.replace('560x360', '900x360')} alt="" className="w-full h-full object-cover" />}
          <RoofOverlay center={p.center} segments={p.roofSegments} w={900} h={360} />
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">✕</button>
          <span className="absolute top-3 left-3 text-[13px] font-bold text-white px-3 py-1 rounded-full shadow" style={{ background: scoreTone(p.score) }}>Score {p.score}</span>
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="absolute bottom-3 left-5 right-5">
            <div className="text-white font-bold text-[22px] leading-tight drop-shadow">{p.company}</div>
            <div className="text-white/85 text-[13px] flex items-center gap-2">{p.address}{p.distanceM != null && <span>· {(p.distanceM / 1000).toFixed(1)} km away</span>}</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          <div className="grid grid-cols-4 gap-3">
            {metrics.map((m) => (
              <div key={m.l} className="rounded-card bg-control p-3">
                <div className="text-[11px] text-muted-2 font-medium">{m.l}</div>
                <div className={classNames('text-[20px] font-bold mt-1 tracking-[-0.01em]', m.pos ? 'text-positive' : 'text-ink')}>{m.v}</div>
                <div className="text-[11px] text-muted-2 mt-0.5">{m.s}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[1.3fr_1fr] gap-5">
            <div>
              <div className="eyebrow text-[10px] text-muted-3 mb-2">Why this scores {p.score}</div>
              <div className="flex flex-col gap-1.5">
                {p.reasons.map((r, i) => <div key={i} className="flex items-start gap-2 text-[13px] text-ink-2"><Check size={14} className="text-positive mt-0.5 shrink-0" />{r}</div>)}
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {p.roofMeasured && <Chip tone="accent" dot>Satellite-measured roof</Chip>}
                {p.epcRating && <Chip tone="warning">EPC {p.epcRating}</Chip>}
                {p.domain && <a href={`https://${p.domain}`} target="_blank" rel="noreferrer" className="text-[12.5px] text-accent hover:underline flex items-center gap-1">{p.domain} ↗</a>}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="eyebrow text-[10px] text-muted-3">Decision-makers</div>
                {!p.contactsRevealed && <button onClick={reveal} disabled={revealing} className="text-[12px] font-semibold text-accent hover:underline disabled:opacity-50 flex items-center gap-1.5">{revealing ? <span className="w-3 h-3 rounded-full border-2 border-accent border-t-transparent animate-spin" /> : <Person size={12} />}{revealing ? 'Revealing…' : 'Reveal (1 credit)'}</button>}
              </div>
              {p.contactsRevealed && p.contacts.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {p.contacts.map((c) => (
                    <div key={c.id} className="rounded-xl border border-border p-2.5">
                      <div className="font-semibold text-[13px] text-ink-2">{c.name}</div>
                      <div className="text-[11.5px] text-muted-2">{c.title}</div>
                      <div className="flex items-center gap-3 mt-1.5">
                        {c.email && <a href={`mailto:${c.email}`} className="text-[11.5px] text-accent hover:underline flex items-center gap-1"><Envelope size={11} />{c.email}</a>}
                        {c.linkedin && <a href={c.linkedin} target="_blank" rel="noreferrer" className="text-[11.5px] text-accent hover:underline">LinkedIn ↗</a>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : p.contactsRevealed ? (
                <div className="text-[12.5px] text-muted-b rounded-xl border border-dashed border-border p-3">No contacts found for this company.</div>
              ) : (
                <div className="text-[12.5px] text-muted-b rounded-xl border border-dashed border-border p-3">Reveal to fetch the decision-makers at {p.company} — one PDL lookup, then cached.</div>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-divider p-3.5 flex items-center justify-between gap-3 shrink-0">
          <label className="flex items-center gap-2 text-[12.5px] text-muted-b">Status
            <select value={p.status} onChange={(e) => act.setSolarProspectStatus(p.id, e.target.value as SolarProspectStatus)} className="h-8 px-2 rounded-control border border-input-border bg-white text-[12.5px] outline-none focus:border-accent">
              {SOLAR_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </label>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

/* ─────────── Pipeline board (kanban + list) ─────────── */
export function PipelineBoard({ prospects, onOpen }: { prospects: SolarProspect[]; onOpen: (id: string) => void }) {
  const act = useActions()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  if (prospects.length === 0) return <EmptyState />
  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <Segmented value={view === 'kanban' ? 'Kanban' : 'List'} options={['Kanban', 'List']} onChange={(l) => setView(l === 'Kanban' ? 'kanban' : 'list')} />
      {view === 'kanban' ? (
        <div className="flex-1 overflow-x-auto"><div className="flex gap-3 min-w-max pb-4">
          {SOLAR_STATUSES.map((s) => {
            const col = prospects.filter((p) => p.status === s)
            return (
              <div key={s} className="w-[240px] shrink-0 flex flex-col">
                <div className="flex items-center gap-2 px-1 mb-2"><span className="w-2 h-2 rounded-full" style={{ background: STATUS_META[s].tone }} /><span className="text-[12.5px] font-bold text-ink-2">{STATUS_META[s].label}</span><span className="text-[11px] text-muted-2">{col.length}</span></div>
                <div className="flex flex-col gap-2">{col.map((p) => <PipelineCard key={p.id} p={p} onOpen={() => onOpen(p.id)} onMove={(st) => act.setSolarProspectStatus(p.id, st)} />)}</div>
              </div>
            )
          })}
        </div></div>
      ) : (
        <div className="rounded-card bg-surface border border-border overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.2fr] px-4 py-2.5 border-b border-divider eyebrow text-[10px] text-muted-3"><span>Company</span><span className="text-right">kWp</span><span className="text-right">Yr 1</span><span className="text-right">Payback</span><span>Status</span></div>
          {prospects.map((p) => (
            <div key={p.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1.2fr] px-4 py-2.5 border-b border-divider last:border-0 items-center text-[13px] hover:bg-control/40 cursor-pointer" onClick={() => onOpen(p.id)}>
              <div className="min-w-0"><div className="font-semibold text-ink-2 truncate">{p.company}</div><div className="text-[11.5px] text-muted-2 truncate">{p.address}</div></div>
              <div className="text-right font-semibold text-ink-2">{Math.round(p.systemKwp)}</div>
              <div className="text-right text-positive font-semibold">{money(p.year1Saving, { compact: true })}</div>
              <div className="text-right text-ink-2">{p.paybackYears}y</div>
              <select value={p.status} onClick={(e) => e.stopPropagation()} onChange={(e) => act.setSolarProspectStatus(p.id, e.target.value as SolarProspectStatus)} className="h-8 px-2 rounded-control border border-input-border bg-white text-[12px] outline-none focus:border-accent">{SOLAR_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}</select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
function PipelineCard({ p, onMove, onOpen }: { p: SolarProspect; onMove: (s: SolarProspectStatus) => void; onOpen: () => void }) {
  const idx = SOLAR_STATUSES.indexOf(p.status)
  return (
    <div className="rounded-xl bg-surface border border-border p-2.5 flex flex-col gap-2 cursor-pointer hover:border-accent" onClick={onOpen}>
      <div className="flex items-start gap-2">
        {p.imageUrl && <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0"><img src={p.imageUrl} alt="" className="w-full h-full object-cover" /><RoofOverlay center={p.center} segments={p.roofSegments} w={48} h={48} /></div>}
        <div className="min-w-0 flex-1"><div className="font-bold text-[12.5px] text-ink truncate">{p.company}</div><div className="text-[11px] text-muted-2 truncate">{Math.round(p.systemKwp)} kWp · {money(p.year1Saving, { compact: true })}/yr</div></div>
        <span className="text-[10.5px] font-bold text-white px-1.5 py-0.5 rounded-full shrink-0" style={{ background: scoreTone(p.score) }}>{p.score}</span>
      </div>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button disabled={idx <= 0} onClick={() => onMove(SOLAR_STATUSES[idx - 1])} className="flex-1 h-6 rounded-md border border-border text-[11px] text-muted-b hover:bg-control disabled:opacity-30">←</button>
        <button disabled={idx >= SOLAR_STATUSES.length - 1} onClick={() => onMove(SOLAR_STATUSES[idx + 1])} className="flex-1 h-6 rounded-md border border-border text-[11px] text-muted-b hover:bg-control disabled:opacity-30">→</button>
      </div>
    </div>
  )
}

/* ─────────── Deep prospects database (per-tool or global) ─────────── */
export function ProspectDatabase({ prospects, onOpen, showTool }: { prospects: SolarProspect[]; onOpen: (id: string) => void; showTool?: boolean }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | SolarProspectStatus>('all')
  const [minKwp, setMinKwp] = useState(0)
  const [minScore, setMinScore] = useState(0)
  const [measuredOnly, setMeasuredOnly] = useState(false)
  const [withContacts, setWithContacts] = useState(false)
  const [sort, setSort] = useState<'score' | 'kwp' | 'payback' | 'saving'>('score')

  const rows = useMemo(() => {
    let r = prospects.filter((p) =>
      (!q || `${p.company} ${p.address} ${p.category ?? ''} ${p.domain ?? ''}`.toLowerCase().includes(q.toLowerCase())) &&
      (status === 'all' || p.status === status) && p.systemKwp >= minKwp && p.score >= minScore &&
      (!measuredOnly || p.roofMeasured) && (!withContacts || p.contactsRevealed))
    r = r.sort((a, b) => sort === 'kwp' ? b.systemKwp - a.systemKwp : sort === 'payback' ? a.paybackYears - b.paybackYears : sort === 'saving' ? b.year1Saving - a.year1Saving : b.score - a.score)
    return r
  }, [prospects, q, status, minKwp, minScore, measuredOnly, withContacts, sort])

  const cols = showTool ? '2fr 1fr 0.9fr 0.8fr 0.8fr 1fr 1.1fr' : '2.2fr 1fr 0.9fr 0.8fr 0.8fr 1.1fr'
  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, address, domain…" className="h-9 w-full pl-9 pr-3 rounded-control border border-input-border bg-white text-[13px] outline-none focus:border-accent" /></div>
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="h-9 px-3 rounded-control border border-input-border bg-white text-[13px] outline-none focus:border-accent"><option value="all">Any status</option>{SOLAR_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}</select>
        <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="h-9 px-3 rounded-control border border-input-border bg-white text-[13px] outline-none focus:border-accent"><option value="score">Sort: Score</option><option value="kwp">Sort: kWp</option><option value="payback">Sort: Payback</option><option value="saving">Sort: Saving</option></select>
      </div>
      <div className="flex items-center gap-4 flex-wrap text-[12px] text-muted-b">
        <label className="flex items-center gap-2">Min kWp <input type="range" min={0} max={500} step={10} value={minKwp} onChange={(e) => setMinKwp(+e.target.value)} className="accent-accent" /><b className="text-ink-2 w-8">{minKwp}</b></label>
        <label className="flex items-center gap-2">Min score <input type="range" min={0} max={95} step={5} value={minScore} onChange={(e) => setMinScore(+e.target.value)} className="accent-accent" /><b className="text-ink-2 w-6">{minScore}</b></label>
        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={measuredOnly} onChange={(e) => setMeasuredOnly(e.target.checked)} className="accent-accent" />Measured only</label>
        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={withContacts} onChange={(e) => setWithContacts(e.target.checked)} className="accent-accent" />Has contacts</label>
        <span className="ml-auto font-semibold text-ink-2">{rows.length} of {prospects.length}</span>
      </div>
      <div className="rounded-card bg-surface border border-border overflow-hidden flex-1 min-h-0 overflow-y-auto">
        <div className="grid px-4 py-2.5 border-b border-divider eyebrow text-[10px] text-muted-3 sticky top-0 bg-surface" style={{ gridTemplateColumns: cols }}>
          <span>Company</span>{showTool && <span>Tool</span>}<span className="text-right">kWp</span><span className="text-right">Score</span><span className="text-right">Payback</span><span className="text-right">Yr-1</span><span>Status</span>
        </div>
        {rows.map((p) => (
          <div key={p.id} className="grid px-4 py-2.5 border-b border-divider last:border-0 items-center text-[13px] hover:bg-control/40 cursor-pointer" style={{ gridTemplateColumns: cols }} onClick={() => onOpen(p.id)}>
            <div className="flex items-center gap-2.5 min-w-0">
              {p.imageUrl && <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0"><img src={p.imageUrl} alt="" className="w-full h-full object-cover" /><RoofOverlay center={p.center} segments={p.roofSegments} w={36} h={36} /></div>}
              <div className="min-w-0"><div className="font-semibold text-ink-2 truncate">{p.company}</div><div className="text-[11px] text-muted-2 truncate">{p.category || p.address}</div></div>
            </div>
            {showTool && <span className="text-[12px] text-muted-b truncate">{toolLabel(p.tool)}</span>}
            <div className="text-right font-semibold text-ink-2">{Math.round(p.systemKwp)}</div>
            <div className="text-right"><span className="text-[11.5px] font-bold text-white px-1.5 py-0.5 rounded-full" style={{ background: scoreTone(p.score) }}>{p.score}</span></div>
            <div className="text-right text-ink-2">{p.paybackYears}y</div>
            <div className="text-right text-positive font-semibold">{money(p.year1Saving, { compact: true })}</div>
            <span className="text-[11.5px] font-semibold" style={{ color: STATUS_META[p.status].tone }}>{STATUS_META[p.status].label}</span>
          </div>
        ))}
        {rows.length === 0 && <div className="p-10 text-center text-[13px] text-muted-b">No prospects match these filters.</div>}
      </div>
    </div>
  )
}

export function toolLabel(id: string) { return id === 'commercial-solar' ? 'Commercial Solar' : id === 'domestic-solar' ? 'Domestic Solar' : id === 'ev-charging' ? 'EV Charging' : id }

/* tiny markdown-ish bold renderer for chat */
function renderText(t: string) {
  return t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>))
}
