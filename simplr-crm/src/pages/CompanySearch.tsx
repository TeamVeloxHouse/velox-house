import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Segmented } from '../components/ui'
import { Radar, Send, Sparkle, Person, Search, Building, Flow, Layers, Sun, Target, Check, Envelope, MapPin, ChevronRight } from '../components/icons'
import { MapExplorer } from '../components/MapExplorer'
import { MultiSelect, Stepper, AddressAutocomplete } from '../components/inputs'
import { useActions, useState_ } from '../store/store'
import { money, classNames } from '../lib/format'
import { runCompanySearch, type CompanyResult, type CommercialCriteria, type EngineProgress } from '../lib/commercialSolar'
import { interpretBrief, geocodeLocation, companyToProspect, revealContactsFor, SECTOR_SUGGESTIONS, type FinderPlan } from '../lib/commercialFinder'
import type { SolarProspect, SolarProspectStatus } from '../store/types'
import { SOLAR_STATUSES } from '../store/types'
import { RoofOverlay } from '../components/RoofOverlay'
import { CompanyLogo, STATUS_META, scoreTone, ProspectDetail, ProspectDatabase, PipelineBoard, measureRoofInto } from './CommercialSolar'

const TOOL = 'company-search'

type Mode = 'radius' | 'bulk' | 'single'
type Params = { industries: string[]; locations: string[]; radiusKm: number; count: number; jobTitles: string[]; singleAddress: string; singlePin?: { lat: number; lng: number } }
type ChatMsg = { role: 'ovi' | 'you'; text: string }

const DEFAULT_PARAMS: Params = { industries: [], locations: [], radiusKm: 5, count: 24, jobTitles: ['Managing Director', 'Operations Director'], singleAddress: '' }
const MODE_LABELS: Record<Mode, string> = { radius: 'Radius (pin)', bulk: 'Bulk (area)', single: 'Single company' }
const TITLE_SUGGESTIONS = ['Managing Director', 'Operations Director', 'CEO', 'Owner', 'Finance Director', 'Facilities Manager', 'Energy Manager', 'Sustainability Manager', 'Procurement Manager', 'General Manager', 'Head of Operations', 'Estates Manager']
const placeSuggest = async (q: string) => { try { const r = await fetch('/api/autocomplete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: q }) }); const j = await r.json(); return (j.suggestions || []).map((s: { text: string }) => s.text) } catch { return [] } }
const STARTERS = [
  'Find manufacturers in Birmingham and show me their Operations Directors',
  'Warehouse operators within 10km of Leeds — I want the Facilities Managers',
  'Look up Valeo Foods and find the decision-makers',
]

/* ══════════════════════ Company & People Search (company-first) ══════════════════════ */
export function CompanySearchTool() {
  const act = useActions()
  const nav = useNavigate()
  const { solarProspects, solarCampaigns } = useState_()
  const [tab, setTab] = useState('chat')
  const [detailId, setDetailId] = useState<string | null>(null)

  const [mode, setMode] = useState<Mode>('bulk')
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS)
  const [chat, setChat] = useState<ChatMsg[]>([{ role: 'ovi', text: "I'm Ovi. Tell me the kind of company you want to reach — an industry and a place, or one company by name — and I'll find them and pull out the decision-makers. Measuring a roof is one click, whenever you want it." }])
  const [draft, setDraft] = useState('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<EngineProgress | null>(null)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const toolProspects = useMemo(() => solarProspects.filter((p) => (p.tool ?? '') === TOOL), [solarProspects])
  const toolCampaigns = useMemo(() => solarCampaigns.filter((c) => (c.tool ?? '') === TOOL), [solarCampaigns])
  const currentProspects = useMemo(() => (campaignId ? toolProspects.filter((p) => p.campaignId === campaignId) : toolProspects), [toolProspects, campaignId])
  const detail = detailId ? solarProspects.find((p) => p.id === detailId) ?? null : null

  const set = (patch: Partial<Params>) => setParams((p) => ({ ...p, ...patch }))
  function applyPlan(plan: FinderPlan): { P: Params; M: Mode } {
    const M: Mode = plan.mode ?? mode
    const P: Params = { ...params }
    if (plan.industries?.length) P.industries = plan.industries
    if (plan.locations?.length) P.locations = plan.locations
    if (plan.radiusKm) P.radiusKm = plan.radiusKm
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
      ovi = `Got it — ${P.count} ${P.industries.join(' / ') || 'companies'}${where ? (M === 'single' ? ` · ${P.singleAddress}` : M === 'radius' ? ` within ${P.radiusKm} km of ${where}` : ` in ${where}`) : ''}.` + (where ? ' Hit **Find companies** and I’ll get to work.' : ' Where should I look — a town, postcode or area?')
    }
    setChat((c) => [...c.slice(0, -1), { role: 'ovi', text: ovi || 'On it.' }])
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    if (plan.action === 'run') launch(P, M)
  }

  const runSearch = () => launch(params, mode)
  async function launch(P: Params, M: Mode) {
    if (running) return
    const industry = P.industries.join(', ') || undefined
    const targets: { area?: string; pin?: { lat: number; lng: number }; label: string }[] = []
    if (M === 'single') {
      if (!P.singleAddress) { act.toast('Name a company or address', 'warning'); return }
      setRunning(true); setProgress({ stage: 'discover', message: `Locating ${P.singleAddress}…` })
      const pin = P.singlePin || (await geocodeLocation(P.singleAddress).then((g) => g && { lat: g.lat, lng: g.lng }))
      targets.push(pin ? { pin, label: P.singleAddress } : { area: P.singleAddress, label: P.singleAddress })
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
      radiusM: M === 'radius' ? P.radiusKm * 1000 : M === 'single' ? 400 : undefined,
      targetKwp: 250, jobTitles: P.jobTitles, count: M === 'single' ? 1 : P.count, status: 'scanning',
    })
    setCampaignId(campaign.id)

    let first = true; let n = 0; let scannedTotal = 0
    const per = M === 'single' ? 1 : Math.max(1, Math.ceil(P.count / targets.length))
    for (const tgt of targets) {
      const criteria: CommercialCriteria = {
        industry, area: tgt.area, pin: tgt.pin,
        radiusM: M === 'radius' ? P.radiusKm * 1000 : M === 'single' ? 400 : undefined,
        targetKwp: 250, jobTitles: P.jobTitles, count: per, skipPeople: true,
      }
      const { scanned } = await runCompanySearch(criteria, (pr) => setProgress({ ...pr, message: targets.length > 1 ? `${tgt.label}: ${pr.message}` : pr.message }), (co: CompanyResult) => {
        act.addSolarProspects([companyToProspect(co, campaign.id, TOOL)]); n++
        if (first) { first = false; setTab('companies') }
      })
      scannedTotal += scanned
    }
    act.updateSolarCampaign(campaign.id, { status: 'complete', scanned: scannedTotal })
    setRunning(false)
    setChat((c) => [...c, { role: 'ovi', text: `Found **${n}** ${n === 1 ? 'company' : 'companies'}. Open **Companies** to reveal the people and measure any roof — no spend until you ask for it.` }])
    act.toast(`${n} companies found`)
  }

  const tabs = [
    { id: 'chat', label: 'Chat', icon: Sparkle },
    { id: 'map', label: 'Map view', icon: MapPin },
    { id: 'companies', label: 'Companies', count: currentProspects.length, icon: Building },
    { id: 'pipeline', label: 'Pipeline', icon: Flow },
    { id: 'database', label: 'Database', icon: Layers },
  ]

  return (
    <>
      <TopBar title="Company & People Search" crumbs={['Tools']}
        tabs={{ items: tabs, value: tab, onChange: setTab }}
        identity={{ icon: Building, accent: '#13927B' }} />
      <PageBody>
        {tab === 'chat' && <ChatTab {...{ mode, setMode, params, set, chat, draft, setDraft, sendChat, running, progress, runSearch, chatEndRef }} />}
        {tab === 'map' && <MapExplorer onOpenProspect={setDetailId} />}
        {tab === 'companies' && (
          <CompaniesTab prospects={currentProspects} running={running} progress={progress}
            campaigns={toolCampaigns} campaignId={campaignId} setCampaignId={setCampaignId} onOpen={setDetailId} jobTitles={params.jobTitles} />
        )}
        {tab === 'pipeline' && <PipelineBoard prospects={toolProspects} onOpen={setDetailId} />}
        {tab === 'database' && <ProspectDatabase prospects={toolProspects} onOpen={setDetailId} />}
      </PageBody>
      {detail && <ProspectDetail p={detail} jobTitles={params.jobTitles} onClose={() => setDetailId(null)} />}
    </>
  )
}

function campaignName(mode: Mode, p: Params): string {
  const ind = cap(p.industries[0] || 'companies') + (p.industries.length > 1 ? ` +${p.industries.length - 1}` : '')
  const where = p.locations.join(', ')
  if (mode === 'single') return `Company · ${p.singleAddress.split(',')[0]}`
  if (mode === 'bulk') return `${ind} in ${where || 'area'}`
  return `${ind} · ${p.radiusKm}km of ${where}`
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/* ─────────── Chat tab (setup) ─────────── */
function ChatTab({ mode, setMode, params, set, chat, draft, setDraft, sendChat, running, progress, runSearch, chatEndRef }: any) {
  return (
    <div className="grid grid-cols-[minmax(360px,420px)_1fr] gap-5 flex-1 min-h-0">
      <div className="flex flex-col rounded-card bg-surface border border-border overflow-hidden min-h-0">
        <div className="px-4 py-3 border-b border-divider flex items-center gap-2.5" style={{ background: 'linear-gradient(135deg,#1FAE94 0%,#159C86 100%)' }}>
          <span className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white"><Sparkle size={17} /></span>
          <div><div className="text-white font-bold text-[14px] leading-tight">Ovi finds companies + people</div><div className="text-white/70 text-[11.5px]">Describe who you want to reach</div></div>
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
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChat(draft)} placeholder="e.g. cold storage firms near Manchester…" className="flex-1 h-10 px-3 rounded-control border border-input-border bg-white text-[13.5px] outline-none focus:border-accent" />
          <button onClick={() => sendChat(draft)} className="w-10 h-10 rounded-control text-white flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#1FAE94,#159C86)' }}><Send size={16} /></button>
        </div>
      </div>

      <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <Segmented value={MODE_LABELS[mode as Mode]} options={Object.values(MODE_LABELS)} onChange={(l) => setMode((Object.keys(MODE_LABELS) as Mode[]).find((k) => MODE_LABELS[k] === l) ?? 'bulk')} />
          <Button variant="primary" icon={<Search size={16} />} onClick={runSearch} className={running ? 'opacity-60 pointer-events-none' : ''}>{running ? 'Searching…' : mode === 'single' ? 'Find company' : 'Find companies'}</Button>
        </div>
        <ParamsPanel mode={mode} params={params} set={set} />
        {running && progress && (
          <div className="rounded-card bg-surface border border-border px-4 py-3 flex items-center gap-3">
            <span className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin shrink-0" />
            <div className="flex-1 text-[13px] text-ink-2">{progress.message}</div>
            {progress.scanned != null && <div className="text-[12px] text-muted-2">{progress.found ?? 0} found · {progress.scanned}/{progress.total ?? '…'}</div>}
          </div>
        )}
        <HowItWorks />
      </div>
    </div>
  )
}

function HowItWorks() {
  const steps = [
    { icon: Radar, t: 'Find', d: 'Companies by industry + place, or one by name — fast, no spend' },
    { icon: Person, t: 'Reveal', d: 'Unlock the decision-makers at any company on demand' },
    { icon: Sun, t: 'Measure', d: 'One click sizes the roof from satellite when you want solar' },
    { icon: Flow, t: 'Work', d: 'Everything flows into one shared prospects pipeline' },
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
        <Field label="Company name or address" full>
          <AddressAutocomplete value={params.singleAddress} placeholder="e.g. Valeo Foods, or a full address…"
            onPick={async (p) => { set({ singleAddress: p.text, singlePin: undefined }); const g = await geocodeLocation(p.text); if (g) set({ singleAddress: p.text, singlePin: { lat: g.lat, lng: g.lng } }) }} />
        </Field>
      ) : (
        <Field label={mode === 'bulk' ? 'Areas (add several)' : 'Centres — drop a pin per location'} full>
          <MultiSelect values={params.locations} onChange={(v) => set({ locations: v })} asyncSuggest={placeSuggest} icon={Target}
            placeholder={mode === 'bulk' ? 'e.g. West Midlands, Birmingham…' : 'e.g. Manchester, Leeds…'} />
        </Field>
      )}
      <Field label="Sectors" full>
        <MultiSelect values={params.industries} onChange={(v) => set({ industries: v })} suggestions={SECTOR_SUGGESTIONS} icon={Building} placeholder="manufacturing, food production, logistics…" />
      </Field>
      {mode === 'radius' ? (
        <Field label="Search radius"><Stepper value={params.radiusKm} onChange={(v) => set({ radiusKm: v })} min={0.5} max={25} step={0.5} suffix="km" format={(n) => n.toString()} /></Field>
      ) : mode === 'bulk' ? (
        <Field label="How many companies"><Stepper value={params.count} onChange={(v) => set({ count: v })} min={5} max={200} step={5} /></Field>
      ) : <div />}
      {mode === 'radius' && <Field label="How many companies"><Stepper value={params.count} onChange={(v) => set({ count: v })} min={5} max={200} step={5} /></Field>}
      <Field label="Decision-maker titles" full>
        <MultiSelect values={params.jobTitles} onChange={(v) => set({ jobTitles: v })} suggestions={TITLE_SUGGESTIONS} icon={Person} placeholder="Add job titles to target…" />
      </Field>
    </div>
  )
}
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={classNames('flex flex-col gap-1.5', full && 'col-span-2')}><span className="eyebrow text-[10px] text-muted-3">{label}</span>{children}</label>
}

/* ─────────── Companies tab ─────────── */
function CompaniesTab({ prospects, running, progress, campaigns, campaignId, setCampaignId, onOpen, jobTitles }: {
  prospects: SolarProspect[]; running: boolean; progress: EngineProgress | null
  campaigns: import('../store/types').SolarCampaign[]; campaignId: string | null; setCampaignId: (id: string | null) => void; onOpen: (id: string) => void; jobTitles?: string[]
}) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | SolarProspectStatus>('all')
  const [sort, setSort] = useState<'score' | 'saving' | 'name'>('score')

  const withPeople = prospects.filter((p) => p.contactsRevealed).length
  const measured = prospects.filter((p) => !p.roofPending).length
  const contacts = prospects.reduce((s, p) => s + (p.contactsRevealed ? p.contacts.length : 0), 0)
  const avgScore = Math.round(prospects.reduce((s, p) => s + p.score, 0) / (prospects.length || 1))
  const pipelineSaving = prospects.reduce((s, p) => s + (p.roofPending ? 0 : p.year1Saving || 0), 0)
  const statusCounts = SOLAR_STATUSES.map((s) => [s, prospects.filter((p) => p.status === s).length] as const).filter(([, n]) => n > 0)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return prospects
      .filter((p) => status === 'all' || p.status === status)
      .filter((p) => !needle || [p.company, p.category, p.address, p.domain].some((v) => v?.toLowerCase().includes(needle)))
      .sort((a, b) => sort === 'name' ? a.company.localeCompare(b.company) : sort === 'saving' ? (b.year1Saving || 0) - (a.year1Saving || 0) : b.score - a.score)
  }, [prospects, q, status, sort])

  if (prospects.length === 0 && !running) return <EmptyState />

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* summary strip */}
      <div className="rounded-card bg-surface border border-border shadow-card grid grid-cols-5 divide-x divide-divider">
        <Stat label="Companies" value={String(prospects.length)} hint={running ? progress?.message : `${campaigns.length} ${campaigns.length === 1 ? 'search' : 'searches'}`} live={running} />
        <Stat label="People revealed" value={`${withPeople}/${prospects.length}`} bar={withPeople / (prospects.length || 1)} hint={`${contacts} decision-makers`} />
        <Stat label="Roofs measured" value={`${measured}/${prospects.length}`} bar={measured / (prospects.length || 1)} hint="Measured on demand" />
        <Stat label="Avg. fit score" value={String(avgScore)} bar={avgScore / 100} barColor={scoreTone(avgScore)} hint="Across this search" />
        <Stat label="Solar saving found" value={money(pipelineSaving, { compact: true })} hint="Per year, measured roofs" />
      </div>

      {/* toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-surface border border-border rounded-control p-0.5">
          <FilterPill on={status === 'all'} onClick={() => setStatus('all')} label="All" n={prospects.length} />
          {statusCounts.map(([s, n]) => <FilterPill key={s} on={status === s} onClick={() => setStatus(s)} label={STATUS_META[s].label} n={n} dot={STATUS_META[s].tone} />)}
        </div>
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter companies…" className="h-9 w-[220px] pl-8 pr-3 rounded-control border border-border bg-surface text-[13px] outline-none focus:border-accent" />
        </div>
        <select value={campaignId ?? 'all'} onChange={(e) => setCampaignId(e.target.value === 'all' ? null : e.target.value)} className="h-9 px-3 rounded-control border border-border bg-surface text-[13px] outline-none focus:border-accent max-w-[220px]">
          <option value="all">All searches</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-9 px-3 rounded-control border border-border bg-surface text-[13px] outline-none focus:border-accent">
          <option value="score">Sort: Best fit</option>
          <option value="saving">Sort: Biggest saving</option>
          <option value="name">Sort: A–Z</option>
        </select>
      </div>

      {/* results */}
      <div className="rounded-card bg-surface border border-border shadow-card overflow-hidden flex flex-col min-h-0">
        <div className="grid grid-cols-[minmax(240px,1.5fr)_minmax(230px,1.3fr)_minmax(220px,1.3fr)_70px_130px_28px] gap-4 px-4 h-10 items-center border-b border-divider bg-[#FAFBFC] text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-3">
          <span>Company</span><span>Roof & solar</span><span>Decision-makers</span><span>Fit</span><span>Stage</span><span />
        </div>
        <div className="overflow-y-auto">
          {rows.map((p) => <CompanyRow key={p.id} p={p} jobTitles={jobTitles} onOpen={() => onOpen(p.id)} />)}
          {running && <div className="px-4 py-3.5 text-[12.5px] text-accent flex items-center gap-2 border-t border-divider-row"><span className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" />{progress?.message ?? 'Finding more companies…'}</div>}
          {!rows.length && !running && <div className="px-4 py-10 text-center text-[13px] text-muted-b">No companies match these filters.</div>}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, hint, bar, barColor = '#1FAE94', live }: { label: string; value: string; hint?: string; bar?: number; barColor?: string; live?: boolean }) {
  return (
    <div className="px-4 py-3.5 min-w-0">
      <div className="text-[11.5px] font-medium text-muted-b flex items-center gap-1.5">{live && <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse" />}{label}</div>
      <div className="text-[22px] font-bold text-ink tracking-[-0.02em] leading-tight mt-1">{value}</div>
      {bar != null && <div className="h-1 rounded-full bg-control mt-2 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${Math.round(Math.min(1, bar) * 100)}%`, background: barColor }} /></div>}
      {hint && <div className="text-[11.5px] text-muted-2 mt-1.5 truncate">{hint}</div>}
    </div>
  )
}

function FilterPill({ on, onClick, label, n, dot }: { on: boolean; onClick: () => void; label: string; n: number; dot?: string }) {
  return (
    <button onClick={onClick} className={classNames('h-8 px-2.5 rounded-[7px] text-[12.5px] flex items-center gap-1.5 transition-colors', on ? 'bg-ink text-white font-semibold' : 'text-muted-b font-medium hover:text-ink-3 hover:bg-control')}>
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />}{label}<span className={on ? 'text-white/60' : 'text-muted-3'}>{n}</span>
    </button>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16 rounded-card border border-dashed border-border">
      <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#1FAE94,#159C86)' }}><Building size={28} /></span>
      <div className="text-[16px] font-bold text-ink">No companies yet</div>
      <div className="text-[13px] text-muted-b max-w-[460px]">Head to the <b>Chat</b> tab and describe who you want to reach — Ovi finds the companies fast, and you reveal the people or measure a roof whenever you like.</div>
    </div>
  )
}

/* ─────────── Company-first results row ─────────── */
function CompanyRow({ p, onOpen, jobTitles }: { p: SolarProspect; onOpen: () => void; jobTitles?: string[] }) {
  const act = useActions()
  const [revealing, setRevealing] = useState(false)
  const [measuring, setMeasuring] = useState(false)
  const top = p.contacts[0]

  async function reveal(e: React.MouseEvent) {
    e.stopPropagation(); if (revealing || p.contactsRevealed) return
    setRevealing(true)
    const contacts = await revealContactsFor(p, jobTitles)
    act.revealSolarContacts(p.id, contacts); setRevealing(false)
    if (!contacts.length) act.toast('No contacts found for this company', 'warning')
  }
  async function measure(e: React.MouseEvent) {
    e.stopPropagation(); if (measuring || !p.roofPending) return
    setMeasuring(true)
    try { await measureRoofInto(p, act.updateSolarProspect); act.toast('Roof measured') }
    catch { act.toast('Could not measure that roof', 'warning') }
    finally { setMeasuring(false) }
  }

  const [imgOk, setImgOk] = useState(true)
  const meta = STATUS_META[p.status]
  const place = p.address?.split(',').slice(-2).join(',').trim()
  const named = p.company && p.company !== 'Selected building'

  return (
    <div onClick={onOpen} className="grid grid-cols-[minmax(240px,1.5fr)_minmax(230px,1.3fr)_minmax(220px,1.3fr)_70px_130px_28px] gap-4 px-4 py-3 items-center border-b border-divider-row last:border-b-0 hover:bg-[#FAFCFB] cursor-pointer group transition-colors">
      {/* company */}
      <div className="flex items-center gap-3 min-w-0">
        <CompanyLogo domain={p.domain} name={p.company} size={38} />
        <div className="min-w-0">
          <div className="font-semibold text-[14px] text-ink truncate group-hover:text-accent transition-colors">{named ? p.company : place || 'Unnamed building'}</div>
          <div className="text-[12px] text-muted-2 truncate">{[p.category, named ? place : null].filter(Boolean).join(' · ') || (p.center ? `${p.center.lat.toFixed(4)}, ${p.center.lng.toFixed(4)}` : '—')}</div>
          <div className="text-[11.5px] text-muted-3 truncate flex items-center gap-1 mt-0.5">
            {p.domain ? <><Envelope size={11} />{p.domain}</> : <span className="italic">No website found</span>}
          </div>
        </div>
      </div>

      {/* roof */}
      {!p.roofPending ? (
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-[84px] h-[54px] rounded-lg overflow-hidden shrink-0 border border-border" style={{ background: 'repeating-linear-gradient(45deg,#EEF2F6 0 6px,#F6F8FA 6px 12px)' }}>
            {p.imageUrl && imgOk && <img src={p.imageUrl} alt="" onError={() => setImgOk(false)} className="absolute inset-0 w-full h-full object-cover" />}
            <RoofOverlay center={p.center} segments={p.roofSegments} footprint={p.roofFootprint} zoom={p.roofZoom} />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-bold text-ink leading-tight">{Math.round(p.systemKwp)} <span className="text-[11.5px] font-semibold text-muted-2">kWp</span></div>
            <div className="text-[12px] text-positive font-semibold mt-0.5">{money(p.year1Saving, { compact: true })}/yr saving</div>
            <div className="text-[11.5px] text-muted-2">{p.paybackYears}-year payback</div>
          </div>
        </div>
      ) : (
        <button onClick={measure} disabled={measuring} className="h-9 w-fit px-3 rounded-lg border border-dashed border-input-border text-[12.5px] font-semibold text-ink-3 hover:border-accent hover:text-accent hover:bg-accent-wash flex items-center gap-2 disabled:opacity-60 transition-colors">
          {measuring ? <span className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" /> : <Sun size={14} className="text-accent" />}{measuring ? 'Measuring roof…' : 'Measure roof'}
        </button>
      )}

      {/* people */}
      {p.contactsRevealed ? (
        top ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex -space-x-2 shrink-0">
              {p.contacts.slice(0, 3).map((c, i) => (
                <span key={i} className="w-7 h-7 rounded-full ring-2 ring-white flex items-center justify-center text-[10px] font-bold" style={{ background: ['#EAF6F2', '#EEF2FF', '#FDF1E7'][i], color: ['#0E7A66', '#4F46E5', '#C2410C'][i] }}>{initials(c.name)}</span>
              ))}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-ink-2 truncate">{top.name}</div>
              <div className="text-[11.5px] text-muted-2 truncate">{top.title}{p.contacts.length > 1 ? ` · +${p.contacts.length - 1} more` : ''}</div>
            </div>
          </div>
        ) : <div className="text-[12.5px] text-muted-2 flex items-center gap-1.5"><Person size={13} />No contacts found</div>
      ) : (
        <button onClick={reveal} disabled={revealing} className="h-9 w-fit px-3 rounded-lg text-white text-[12.5px] font-semibold flex items-center gap-2 disabled:opacity-60 bg-accent-gradient shadow-primary">
          {revealing ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Person size={14} />}{revealing ? 'Finding people…' : 'Reveal people'}
          {!revealing && <span className="text-[10.5px] font-semibold bg-white/20 rounded px-1.5 py-px">1 credit</span>}
        </button>
      )}

      {/* fit */}
      <ScoreRing score={p.score} />

      {/* stage */}
      <div onClick={(e) => e.stopPropagation()} className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pointer-events-none" style={{ background: meta.tone }} />
        <select value={p.status} onChange={(e) => act.setSolarProspectStatus(p.id, e.target.value as SolarProspectStatus)} className="h-8 w-full pl-6 pr-2 rounded-full border border-border bg-surface text-[12px] font-semibold text-ink-3 outline-none focus:border-accent hover:border-input-border cursor-pointer">
          {SOLAR_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
      </div>

      <ChevronRight size={16} className="text-muted-3 group-hover:text-accent transition-colors" />
    </div>
  )
}

function ScoreRing({ score }: { score: number }) {
  const r = 16, c = 2 * Math.PI * r
  const tone = scoreTone(score)
  return (
    <div className="relative w-10 h-10" title={`Fit score ${score}/100`}>
      <svg viewBox="0 0 40 40" className="w-10 h-10 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#EEF1F4" strokeWidth="4" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={tone} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[12px] font-bold text-ink">{score}</span>
    </div>
  )
}
const initials = (n: string) => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

/* tiny markdown-ish bold renderer for chat */
function renderText(t: string) {
  return t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>))
}
