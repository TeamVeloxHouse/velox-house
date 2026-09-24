import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Chip, Segmented, Kpi } from '../components/ui'
import { Sun, Radar, Send, Sparkle, Person, Bolt, Flow, Search, Building, Layers, Check, Target, Envelope } from '../components/icons'
import { MultiSelect, Stepper, AddressAutocomplete } from '../components/inputs'
import { useActions, useState_ } from '../store/store'
import { money, classNames } from '../lib/format'
import { runCommercialSolarEngine, measureRoof, type CommercialProspect, type EngineProgress, type CommercialCriteria } from '../lib/commercialSolar'
import { interpretBrief, geocodeLocation, prospectToSolar, revealContactsFor, SECTOR_SUGGESTIONS, type FinderPlan } from '../lib/commercialFinder'
import type { SolarProspect, SolarProspectStatus } from '../store/types'
import { SOLAR_STATUSES } from '../store/types'
import { RoofOverlay } from '../components/RoofOverlay'

const TOOL = 'commercial-solar'

type Mode = 'radius' | 'bulk' | 'single'
type Params = { industries: string[]; targetKwp: number; locations: string[]; radiusKm: number; count: number; jobTitles: string[]; singleAddress: string; singlePin?: { lat: number; lng: number } }
type ChatMsg = { role: 'ovi' | 'you'; text: string }

const DEFAULT_PARAMS: Params = { industries: ['warehouses'], targetKwp: 250, locations: [], radiusKm: 5, count: 20, jobTitles: ['Managing Director', 'Facilities Manager'], singleAddress: '' }
const MODE_LABELS: Record<Mode, string> = { radius: 'Radius (pin)', bulk: 'Bulk (area)', single: 'Single site' }
const TITLE_SUGGESTIONS = ['Managing Director', 'Facilities Manager', 'Operations Director', 'CEO', 'Owner', 'Finance Director', 'Energy Manager', 'Sustainability Manager', 'Estates Manager', 'Property Director', 'Head of Operations', 'Procurement Manager', 'General Manager']
const placeSuggest = async (q: string) => { try { const r = await fetch('/api/autocomplete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: q }) }); const j = await r.json(); return (j.suggestions || []).map((s: { text: string }) => s.text) } catch { return [] } }
const STARTERS = [
  'Find 30 warehouses within 5km of Wolverhampton, target 250 kWp',
  'Scan manufacturing sites in the West Midlands for Facilities Managers',
  'Cold storage businesses near B70, 500 kWp+, contact Operations Directors',
]

export const STATUS_META: Record<SolarProspectStatus, { label: string; tone: string }> = {
  prospected: { label: 'Prospected', tone: '#64748B' }, researched: { label: 'Researched', tone: '#159C86' },
  contacted: { label: 'Contacted', tone: '#1FAE94' }, replied: { label: 'Replied', tone: '#0EA5E9' },
  meeting: { label: 'Meeting', tone: '#F59E0B' }, proposal: { label: 'Proposal', tone: '#57C9B4' },
  won: { label: 'Won', tone: '#0E9F6E' }, lost: { label: 'Lost', tone: '#B01B4F' },
}
export const scoreTone = (s: number) => (s >= 80 ? '#0E9F6E' : s >= 65 ? '#1FAE94' : '#F59E0B')

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
  function applyPlan(plan: FinderPlan): { P: Params; M: Mode } {
    const M: Mode = plan.mode ?? mode
    const P: Params = { ...params }
    if (plan.industries?.length) P.industries = plan.industries
    if (plan.locations?.length) P.locations = plan.locations
    if (plan.radiusKm) P.radiusKm = plan.radiusKm
    if (plan.targetKwp) P.targetKwp = plan.targetKwp
    if (plan.count) P.count = plan.count
    if (plan.jobTitles?.length) P.jobTitles = plan.jobTitles
    if (plan.specificCompany) { P.singleAddress = plan.specificCompany; P.singlePin = undefined }
    setParams(P); setMode(M)
    return { P, M }
  }
  async function sendChat(text: string) {
    const t = text.trim(); if (!t || running) return
    setDraft(''); setChat((c) => [...c, { role: 'you', text: t }, { role: 'ovi', text: '…' }])
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 30)
    const { reply, plan, llm } = await interpretBrief(t, { ...params, mode })
    const { P, M } = applyPlan(plan)
    let ovi = reply
    if (!llm) {
      const where = P.locations.join(', ') || P.singleAddress
      ovi = `Got it — ${P.count} ${P.industries.join(' / ')}${where ? (M === 'single' ? ` · ${P.singleAddress}` : M === 'radius' ? ` within ${P.radiusKm} km of ${where}` : ` in ${where}`) : ''}.` + (where ? ' Hit **Run scan** and I’ll get to work.' : ' Where should I look — a town, postcode or area?')
    }
    setChat((c) => [...c.slice(0, -1), { role: 'ovi', text: ovi || 'On it.' }])
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    if (plan.action === 'run') launch(P, M)
  }

  const runScan = () => launch(params, mode)
  async function launch(P: Params, M: Mode) {
    if (running) return
    const industry = P.industries.join(', ') || undefined
    const targets: { area?: string; pin?: { lat: number; lng: number }; label: string }[] = []
    if (M === 'single') {
      if (!P.singleAddress) { act.toast('Pick an address', 'warning'); return }
      setRunning(true); setProgress({ stage: 'discover', message: `Locating ${P.singleAddress}…` })
      const pin = P.singlePin || (await geocodeLocation(P.singleAddress).then((g) => g && { lat: g.lat, lng: g.lng }))
      if (!pin) { act.toast('Could not find that address', 'warning'); setRunning(false); return }
      targets.push({ pin, label: P.singleAddress })
    } else if (M === 'bulk') {
      if (!P.locations.length) { act.toast('Add at least one area', 'warning'); return }
      setRunning(true)
      P.locations.forEach((a) => targets.push({ area: a, label: a }))
    } else {
      if (!P.locations.length) { act.toast('Add at least one location', 'warning'); return }
      setRunning(true)
      for (const loc of P.locations) {
        setProgress({ stage: 'discover', message: `Locating ${loc}…` })
        const g = await geocodeLocation(loc)
        if (g) targets.push({ pin: { lat: g.lat, lng: g.lng }, label: loc })
      }
      if (!targets.length) { act.toast('Could not find those locations', 'warning'); setRunning(false); return }
    }

    const campaign = act.createSolarCampaign({
      name: campaignName(M, P), tool: TOOL, industry,
      area: M === 'bulk' ? P.locations.join(', ') : undefined, pin: targets[0]?.pin,
      radiusM: M === 'radius' ? P.radiusKm * 1000 : M === 'single' ? 250 : undefined,
      targetKwp: P.targetKwp, jobTitles: P.jobTitles, count: M === 'single' ? 1 : P.count, status: 'scanning',
    })
    setCampaignId(campaign.id)

    let first = true; let n = 0; let scannedTotal = 0
    const per = M === 'single' ? 1 : Math.max(1, Math.ceil(P.count / targets.length))
    for (const tgt of targets) {
      const criteria: CommercialCriteria = {
        industry, area: tgt.area, pin: tgt.pin,
        radiusM: M === 'radius' ? P.radiusKm * 1000 : M === 'single' ? 250 : undefined,
        targetKwp: P.targetKwp, jobTitles: P.jobTitles, count: per, skipPeople: true,
      }
      const { scanned } = await runCommercialSolarEngine(criteria, (p) => setProgress({ ...p, message: targets.length > 1 ? `${tgt.label}: ${p.message}` : p.message }), (prospect: CommercialProspect) => {
        act.addSolarProspects([prospectToSolar(prospect, campaign.id, TOOL)]); n++
        if (first) { first = false; setTab('roofs') }
      })
      scannedTotal += scanned
    }
    act.updateSolarCampaign(campaign.id, { status: 'complete', scanned: scannedTotal })
    setRunning(false)
    setChat((c) => [...c, { role: 'ovi', text: `Done — I scanned ${scannedTotal} buildings and qualified **${n}** with roofs worth pursuing. Open **Scanned roofs** to see them, or the **Pipeline** to work them.` }])
    act.toast(`${n} prospects saved`)
  }

  const tabs = [
    { id: 'chat', label: 'Chat', icon: Sparkle },
    { id: 'roofs', label: 'Scanned roofs', count: currentProspects.length, icon: Sun },
    { id: 'pipeline', label: 'Pipeline', icon: Flow },
    { id: 'database', label: 'Database', icon: Layers },
  ]

  return (
    <>
      <TopBar title="Commercial Solar Finder" crumbs={['Tools']}
        tabs={{ items: tabs, value: tab, onChange: setTab }}
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
  const ind = cap(p.industries[0] || 'commercial') + (p.industries.length > 1 ? ` +${p.industries.length - 1}` : '')
  const where = p.locations.join(', ')
  if (mode === 'single') return `Single site · ${p.singleAddress.split(',')[0]}`
  if (mode === 'bulk') return `${ind} in ${where || 'area'}`
  return `${ind} · ${p.radiusKm}km of ${where}`
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/* ─────────── Chat tab (setup) ─────────── */
function ChatTab({ mode, setMode, params, set, chat, draft, setDraft, sendChat, running, progress, runScan, chatEndRef }: any) {
  return (
    <div className="grid grid-cols-[minmax(360px,420px)_1fr] gap-5 flex-1 min-h-0">
      <div className="flex flex-col rounded-card bg-surface border border-border overflow-hidden min-h-0">
        <div className="px-4 py-3 border-b border-divider flex items-center gap-2.5" style={{ background: 'linear-gradient(135deg,#1FAE94 0%,#159C86 100%)' }}>
          <span className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white"><Sparkle size={17} /></span>
          <div><div className="text-white font-bold text-[14px] leading-tight">Ovi finds your leads</div><div className="text-white/70 text-[11.5px]">Describe your ideal customer</div></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
          {chat.map((m: ChatMsg, i: number) => (
            <div key={i} className={classNames('max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug', m.role === 'ovi' ? 'bg-control text-ink-2 self-start rounded-tl-sm' : 'text-white self-end rounded-tr-sm')} style={m.role === 'you' ? { background: 'linear-gradient(135deg,#1FAE94,#159C86)' } : undefined}>{renderText(m.text)}</div>
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
          <button onClick={() => sendChat(draft)} className="w-10 h-10 rounded-control text-white flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#1FAE94,#159C86)' }}><Send size={16} /></button>
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
          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#1FAE94,#159C86)' }}><s.icon size={17} /></span>
          <div className="text-[13px] font-bold text-ink mt-1">{i + 1}. {s.t}</div>
          <div className="text-[11.5px] text-muted-b leading-snug">{s.d}</div>
        </div>
      ))}
    </div>
  )
}

function ParamsPanel({ mode, params, set }: { mode: Mode; params: Params; set: (p: Partial<Params>) => void }) {
  return (
    <div className="rounded-card bg-surface border border-border p-4 grid grid-cols-2 gap-x-5 gap-y-4">
      {mode === 'single' ? (
        <Field label="Site address" full>
          <AddressAutocomplete value={params.singleAddress} placeholder="Start typing an address…"
            onPick={async (p) => { set({ singleAddress: p.text, singlePin: undefined }); const g = await geocodeLocation(p.text); if (g) set({ singleAddress: p.text, singlePin: { lat: g.lat, lng: g.lng } }) }} />
        </Field>
      ) : (
        <Field label={mode === 'bulk' ? 'Areas (add several)' : 'Centres — drop a pin per location'} full>
          <MultiSelect values={params.locations} onChange={(v) => set({ locations: v })} asyncSuggest={placeSuggest} icon={Target}
            placeholder={mode === 'bulk' ? 'e.g. West Midlands, Birmingham…' : 'e.g. Wolverhampton, Walsall…'} />
        </Field>
      )}
      <Field label="Sectors" full>
        <MultiSelect values={params.industries} onChange={(v) => set({ industries: v })} suggestions={SECTOR_SUGGESTIONS} icon={Building} placeholder="manufacturing, food production, logistics…" />
      </Field>
      <Field label="Target roof size"><Stepper value={params.targetKwp} onChange={(v) => set({ targetKwp: v })} min={20} max={2000} step={25} suffix="kWp" /></Field>
      {mode === 'radius' ? (
        <Field label="Scan radius"><Stepper value={params.radiusKm} onChange={(v) => set({ radiusKm: v })} min={0.5} max={25} step={0.5} suffix="km" format={(n) => n.toString()} /></Field>
      ) : mode === 'bulk' ? (
        <Field label="How many prospects"><Stepper value={params.count} onChange={(v) => set({ count: v })} min={5} max={200} step={5} /></Field>
      ) : <div />}
      {mode !== 'single' && mode !== 'bulk' && <Field label="How many prospects"><Stepper value={params.count} onChange={(v) => set({ count: v })} min={5} max={200} step={5} /></Field>}
      <Field label="Decision-maker titles" full>
        <MultiSelect values={params.jobTitles} onChange={(v) => set({ jobTitles: v })} suggestions={TITLE_SUGGESTIONS} icon={Person} placeholder="Add job titles to target…" />
      </Field>
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
      <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#1FAE94,#159C86)' }}><Sun size={28} /></span>
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
      <div className="relative aspect-[14/9] bg-control overflow-hidden">
        {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />}
        <RoofOverlay center={p.center} segments={p.roofSegments} footprint={p.roofFootprint} zoom={p.roofZoom} />
        <span className="absolute top-2.5 left-2.5 text-[12px] font-bold text-white px-2.5 py-1 rounded-full shadow" style={{ background: scoreTone(p.score) }}>{p.score}</span>
        <div className="absolute top-2.5 right-2.5 flex gap-1.5">
          {p.roofMeasured && <span className="text-[10px] font-bold text-white bg-black/55 px-2 py-1 rounded backdrop-blur-sm">◆ MEASURED</span>}
          {p.epcRating && <span className="text-[10px] font-bold text-white px-2 py-1 rounded" style={{ background: epcColor(p.epcRating) }}>EPC {p.epcRating}</span>}
        </div>
        {p.distanceM != null && <span className="absolute bottom-2.5 right-2.5 text-[10.5px] font-semibold text-white bg-black/55 px-2 py-0.5 rounded backdrop-blur-sm">{(p.distanceM / 1000).toFixed(1)} km</span>}
        {p.roofAreaM2 != null && <span className="absolute bottom-2.5 left-2.5 text-[10.5px] font-semibold text-white px-2 py-0.5 rounded backdrop-blur-sm flex items-center gap-1" style={{ background: 'rgba(34,211,238,0.85)' }}>◆ {p.roofAreaM2.toLocaleString()} m²</span>}
      </div>
      <div className="p-3.5 flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <CompanyLogo domain={p.domain} name={p.company} />
          <div className="min-w-0">
            <div className="font-bold text-[15px] leading-tight truncate text-ink">{p.company}</div>
            <div className="text-[11.5px] text-muted-2 truncate">{p.category || p.address} · roof fits {p.roofMaxKwp ?? Math.round(p.systemKwp)} kWp</div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat v={`${Math.round(p.systemKwp)}`} u="kWp system" />
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
/** Company logo via Clearbit (free, by domain) with a lettermark fallback. */
export function CompanyLogo({ domain, name, size = 40 }: { domain?: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (domain && !failed) return <img src={`https://logo.clearbit.com/${domain}`} onError={() => setFailed(true)} alt="" className="rounded-lg object-contain bg-white border border-border shrink-0" style={{ width: size, height: size }} />
  return <span className="rounded-lg flex items-center justify-center text-white font-bold shrink-0" style={{ width: size, height: size, fontSize: size * 0.4, background: 'linear-gradient(135deg,#1FAE94,#159C86)' }}>{name.charAt(0).toUpperCase()}</span>
}
function Stat({ v, u }: { v: string; u: string }) {
  return <div className="rounded-lg bg-control py-1.5"><div className="text-[15px] font-bold text-ink leading-none">{v}</div><div className="text-[9.5px] text-muted-2 mt-1 uppercase tracking-wide">{u}</div></div>
}
function epcColor(r: string) { const c: Record<string, string> = { A: '#0E9F6E', B: '#57A639', C: '#8DB600', D: '#F2C200', E: '#F59E0B', F: '#EA6A2A', G: '#D0342C' }; return c[r?.[0]?.toUpperCase()] || '#64748B' }

/* ─────────── Apollo-style people panel ─────────── */
function seniorityOf(t: string) { t = (t || '').toLowerCase(); if (/found|owner|ceo|chief|managing|partner|president|proprietor|c[te]o/.test(t)) return 'Owner / Exec'; if (/director|\bvp\b|vice pres|head of/.test(t)) return 'Director'; if (/manager|lead|supervisor|controller/.test(t)) return 'Manager'; return 'Other' }
function deptOf(t: string) { t = (t || '').toLowerCase(); if (/facilit|estate|property|premises/.test(t)) return 'Facilities'; if (/operation|\bops\b|production|plant/.test(t)) return 'Operations'; if (/financ|account|\bcfo\b|commercial/.test(t)) return 'Finance'; if (/energy|sustain|environment|carbon|esg/.test(t)) return 'Energy'; if (/procure|purchas|buyer|supply/.test(t)) return 'Procurement'; if (/\bit\b|technolog|digital/.test(t)) return 'IT'; if (/\bhr\b|people|talent/.test(t)) return 'HR'; return 'General' }
const initials = (n: string) => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

function PeoplePanel({ p, jobTitles }: { p: SolarProspect; jobTitles?: string[] }) {
  const act = useActions()
  const [revealing, setRevealing] = useState(false)
  const [q, setQ] = useState('')
  const [sen, setSen] = useState('all')
  const [dept, setDept] = useState('all')
  const [sel, setSel] = useState<Set<string>>(new Set())

  async function reveal() {
    if (revealing) return; setRevealing(true)
    const contacts = await revealContactsFor(p, jobTitles)
    act.revealSolarContacts(p.id, contacts); setRevealing(false)
    if (!contacts.length) act.toast('No contacts found for this company', 'warning')
  }
  const people = p.contacts.map((c) => ({ ...c, sen: seniorityOf(c.title), dept: deptOf(c.title) }))
  const seniorities = ['all', ...Array.from(new Set(people.map((e) => e.sen)))]
  const depts = ['all', ...Array.from(new Set(people.map((e) => e.dept)))]
  const filtered = people.filter((e) => (!q || `${e.name} ${e.title}`.toLowerCase().includes(q.toLowerCase())) && (sen === 'all' || e.sen === sen) && (dept === 'all' || e.dept === dept))
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  function addToList() {
    const chosen = people.filter((e) => sel.has(e.id))
    chosen.forEach((c) => act.addLead({ name: c.name, company: p.company, role: c.title, source: 'Commercial Solar Finder', score: p.score }))
    act.toast(`${chosen.length} ${chosen.length === 1 ? 'person' : 'people'} added to Leads`); setSel(new Set())
  }

  if (!p.contactsRevealed) {
    return (
      <div className="rounded-card border border-dashed border-border p-6 flex flex-col items-center text-center gap-2">
        <Person size={26} className="text-muted-2" />
        <div className="text-[14px] font-bold text-ink">Find the decision-makers at {p.company}</div>
        <div className="text-[12.5px] text-muted-b max-w-[440px]">One People Data Labs lookup pulls everyone we can find — names, titles, seniority and emails — then it's cached free. Browse, filter and add the right people to your list.</div>
        <button onClick={reveal} disabled={revealing} className="mt-1 h-9 px-4 rounded-control text-white text-[13px] font-semibold flex items-center gap-2 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#1FAE94,#159C86)' }}>
          {revealing ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Person size={15} />}{revealing ? 'Searching…' : 'Reveal people (1 credit)'}
        </button>
      </div>
    )
  }
  if (people.length === 0) return <div className="text-[12.5px] text-muted-b rounded-card border border-dashed border-border p-4">No contacts found for this company.</div>

  return (
    <div className="rounded-card border border-border overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-divider flex items-center gap-2 flex-wrap bg-control/40">
        <div className="text-[13px] font-bold text-ink">People <span className="text-muted-2 font-normal">({people.length})</span></div>
        <div className="relative flex-1 min-w-[160px]"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-2" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or title…" className="h-8 w-full pl-8 pr-2 rounded-control border border-input-border bg-white text-[12.5px] outline-none focus:border-accent" /></div>
        <select value={sen} onChange={(e) => setSen(e.target.value)} className="h-8 px-2 rounded-control border border-input-border bg-white text-[12px] outline-none focus:border-accent">{seniorities.map((s) => <option key={s} value={s}>{s === 'all' ? 'All seniority' : s}</option>)}</select>
        <select value={dept} onChange={(e) => setDept(e.target.value)} className="h-8 px-2 rounded-control border border-input-border bg-white text-[12px] outline-none focus:border-accent">{depts.map((d) => <option key={d} value={d}>{d === 'all' ? 'All departments' : d}</option>)}</select>
        <button onClick={addToList} disabled={!sel.size} className="h-8 px-3 rounded-control text-white text-[12.5px] font-semibold disabled:opacity-40 flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg,#1FAE94,#159C86)' }}><Check size={13} />Add {sel.size || ''} to list</button>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {filtered.map((c) => (
          <label key={c.id} className="flex items-center gap-3 px-3.5 py-2.5 border-b border-divider last:border-0 hover:bg-control/40 cursor-pointer">
            <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="accent-accent w-4 h-4 shrink-0" />
            <span className="w-8 h-8 rounded-full bg-accent-wash text-accent flex items-center justify-center text-[11px] font-bold shrink-0">{initials(c.name)}</span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[13px] text-ink-2 truncate">{c.name}</div>
              <div className="text-[11.5px] text-muted-2 truncate">{c.title}</div>
            </div>
            <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-control text-muted-b shrink-0 hidden sm:inline">{c.dept}</span>
            <div className="flex items-center gap-2.5 shrink-0">
              {c.email ? <a onClick={(e) => e.stopPropagation()} href={`mailto:${c.email}`} className="text-accent hover:text-accent-2" title={c.email}><Envelope size={15} /></a>
                : c.hasEmail ? <span className="text-[#F59E0B]" title="Email on file — upgrade PDL plan to reveal the address"><Envelope size={15} /></span>
                : <span className="text-muted-3" title="No email found"><Envelope size={15} /></span>}
              {c.linkedin && <a onClick={(e) => e.stopPropagation()} href={c.linkedin} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-accent">in</a>}
            </div>
          </label>
        ))}
        {filtered.length === 0 && <div className="p-6 text-center text-[12.5px] text-muted-b">No people match these filters.</div>}
      </div>
    </div>
  )
}

/** Measure one company's roof on demand and fold the economics into its prospect record. */
export async function measureRoofInto(p: SolarProspect, update: (id: string, patch: Partial<SolarProspect>) => void) {
  const patch = await measureRoof(p.address, p.center, p.category)
  update(p.id, patch)
  return patch
}

/** In-detail CTA that promotes a company (roofPending) to full solar economics. */
function MeasureRoofPanel({ p }: { p: SolarProspect }) {
  const act = useActions()
  const [measuring, setMeasuring] = useState(false)
  async function run() {
    if (measuring) return; setMeasuring(true)
    try { await measureRoofInto(p, act.updateSolarProspect); act.toast('Roof measured') }
    catch { act.toast('Could not measure that roof', 'warning') }
    finally { setMeasuring(false) }
  }
  return (
    <div className="rounded-card border border-dashed border-border p-6 flex flex-col items-center text-center gap-2">
      <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#1FAE94,#159C86)' }}><Sun size={24} /></span>
      <div className="text-[15px] font-bold text-ink">Roof not measured yet</div>
      <div className="text-[12.5px] text-muted-b max-w-[460px]">This company came through people-first — no roof spend yet. Measure it from satellite to size the system, cost it, and score the solar opportunity.</div>
      <button onClick={run} disabled={measuring} className="mt-1 h-9 px-4 rounded-control text-white text-[13px] font-semibold flex items-center gap-2 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#1FAE94,#159C86)' }}>
        {measuring ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Sun size={15} />}{measuring ? 'Measuring…' : 'Measure roof'}
      </button>
    </div>
  )
}

/* ─────────── Detail modal (all the data + people) ─────────── */
export function ProspectDetail({ p, onClose, jobTitles }: { p: SolarProspect; onClose: () => void; jobTitles?: string[] }) {
  const act = useActions()
  const nav = useNavigate()
  const metrics = [
    { l: 'Recommended system', v: `${p.systemKwp} kWp`, s: `${p.panels} panels` },
    { l: 'Roof capacity', v: `${p.roofMaxKwp ?? '—'} kWp`, s: p.roofAreaM2 ? `${p.roofAreaM2.toLocaleString()} m² measured` : 'full roof' },
    { l: 'Annual generation', v: `${(p.annualGenKwh / 1000).toFixed(0)} MWh`, s: 'per year' },
    { l: 'Self-consumption', v: p.selfConsumptionPct != null ? `${p.selfConsumptionPct}%` : '—', s: p.demandOffsetPct != null ? `covers ${p.demandOffsetPct}% of demand` : 'on-site use' },
    { l: 'Year-1 saving', v: money(p.year1Saving), s: 'energy + export', pos: true },
    { l: '25-year saving', v: money(p.lifetimeSaving, { compact: true }), s: 'lifetime', pos: true },
    { l: 'Payback', v: `${p.paybackYears} yrs`, s: 'best-payback size' },
    { l: 'Net present value', v: money(p.npv, { compact: true }), s: 'lifetime NPV' },
  ]
  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-surface rounded-overlay shadow-modal w-full max-w-[920px] max-h-[88vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="relative aspect-[5/2] bg-control shrink-0">
          {p.imageUrl && <img src={p.imageUrl.replace('560x360', '900x360')} alt="" className="w-full h-full object-cover" />}
          <RoofOverlay center={p.center} segments={p.roofSegments} footprint={p.roofFootprint} zoom={p.roofZoom} w={900} h={360} />
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">✕</button>
          <span className="absolute top-3 left-3 text-[13px] font-bold text-white px-3 py-1 rounded-full shadow" style={{ background: scoreTone(p.score) }}>Score {p.score}</span>
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="absolute bottom-3 left-5 right-5 flex items-center gap-3">
            <CompanyLogo domain={p.domain} name={p.company} size={48} />
            <div className="min-w-0">
              <div className="text-white font-bold text-[22px] leading-tight drop-shadow truncate">{p.company}</div>
              <div className="text-white/85 text-[13px] flex items-center gap-2 truncate">{p.address}{p.distanceM != null && <span>· {(p.distanceM / 1000).toFixed(1)} km away</span>}</div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {p.roofPending ? <MeasureRoofPanel p={p} /> : (
            <div className="grid grid-cols-4 gap-3">
              {metrics.map((m) => (
                <div key={m.l} className="rounded-card bg-control p-3">
                  <div className="text-[11px] text-muted-2 font-medium">{m.l}</div>
                  <div className={classNames('text-[20px] font-bold mt-1 tracking-[-0.01em]', m.pos ? 'text-positive' : 'text-ink')}>{m.v}</div>
                  <div className="text-[11px] text-muted-2 mt-0.5">{m.s}</div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-card bg-control/40 p-3.5">
            <div className="eyebrow text-[10px] text-muted-3 mb-2">Why this scores {p.score}</div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {p.reasons.map((r, i) => <div key={i} className="flex items-start gap-1.5 text-[12.5px] text-ink-2"><Check size={13} className="text-positive mt-0.5 shrink-0" />{r}</div>)}
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {p.roofMeasured && <Chip tone="accent" dot>Satellite-measured roof</Chip>}
              {p.epcRating && <Chip tone="warning">EPC {p.epcRating}</Chip>}
              {p.domain && <a href={`https://${p.domain}`} target="_blank" rel="noreferrer" className="text-[12.5px] text-accent hover:underline flex items-center gap-1">{p.domain} ↗</a>}
            </div>
          </div>

          <PeoplePanel p={p} jobTitles={jobTitles} />
        </div>
        <div className="border-t border-divider p-3.5 flex items-center justify-between gap-3 shrink-0">
          <label className="flex items-center gap-2 text-[12.5px] text-muted-b">Status
            <select value={p.status} onChange={(e) => act.setSolarProspectStatus(p.id, e.target.value as SolarProspectStatus)} className="h-8 px-2 rounded-control border border-input-border bg-white text-[12.5px] outline-none focus:border-accent">
              {SOLAR_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            {!p.roofPending && <Button variant="primary" icon={<Bolt size={15} />} onClick={() => { onClose(); nav(`/tools/commercial-solar/site/${p.id}`) }}>Full analysis</Button>}
          </div>
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
        {p.imageUrl && <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0"><img src={p.imageUrl} alt="" className="w-full h-full object-cover" /></div>}
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
              {p.imageUrl && <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0"><img src={p.imageUrl} alt="" className="w-full h-full object-cover" /></div>}
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
