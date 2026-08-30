import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Segmented, Kpi } from '../components/ui'
import { PillTabs } from '../components/chrome'
import { Radar, Send, Sparkle, Person, Search, Building, Flow, Layers, Sun, Target, Check, Envelope } from '../components/icons'
import { MultiSelect, Stepper, AddressAutocomplete } from '../components/inputs'
import { useActions, useState_ } from '../store/store'
import { money, classNames } from '../lib/format'
import { runCompanySearch, type CompanyResult, type CommercialCriteria, type EngineProgress } from '../lib/commercialSolar'
import { interpretBrief, geocodeLocation, companyToProspect, revealContactsFor, type FinderPlan } from '../lib/commercialFinder'
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
const INDUSTRY_SUGGESTIONS = ['manufacturing', 'warehouses', 'distribution', 'cold storage', 'logistics', 'food production', 'engineering', 'wholesale', 'construction', 'automotive', 'plastics', 'packaging', 'recycling', 'print']
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
    { id: 'companies', label: `Companies${currentProspects.length ? ` (${currentProspects.length})` : ''}`, icon: Building },
    { id: 'pipeline', label: 'Pipeline', icon: Flow },
    { id: 'database', label: 'Database', icon: Layers },
  ]

  return (
    <>
      <TopBar title="Company & People Search" crumbs={['Tools']}
        center={<PillTabs tabs={tabs} value={tab} onChange={setTab} />}
        actions={<Button variant="secondary" icon={<Radar size={15} />} onClick={() => nav('/tools')}>All tools</Button>} />
      <PageBody>
        {tab === 'chat' && <ChatTab {...{ mode, setMode, params, set, chat, draft, setDraft, sendChat, running, progress, runSearch, chatEndRef }} />}
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
        <div className="px-4 py-3 border-b border-divider flex items-center gap-2.5" style={{ background: 'linear-gradient(135deg,#3B6BF5 0%,#7C3AED 100%)' }}>
          <span className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white"><Sparkle size={17} /></span>
          <div><div className="text-white font-bold text-[14px] leading-tight">Ovi finds companies + people</div><div className="text-white/70 text-[11.5px]">Describe who you want to reach</div></div>
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
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChat(draft)} placeholder="e.g. cold storage firms near Manchester…" className="flex-1 h-10 px-3 rounded-control border border-input-border bg-white text-[13.5px] outline-none focus:border-accent" />
          <button onClick={() => sendChat(draft)} className="w-10 h-10 rounded-control text-white flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Send size={16} /></button>
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
          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><s.icon size={17} /></span>
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
      <Field label="Industries" full>
        <MultiSelect values={params.industries} onChange={(v) => set({ industries: v })} suggestions={INDUSTRY_SUGGESTIONS} icon={Building} placeholder="manufacturing, warehouses…" />
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
  const withPeople = prospects.filter((p) => p.contactsRevealed).length
  const measured = prospects.filter((p) => !p.roofPending).length
  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-[15px] font-bold text-ink">{prospects.length} companies</div>
          {running && <span className="text-[12.5px] text-accent flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" />{progress?.message}</span>}
        </div>
        <select value={campaignId ?? 'all'} onChange={(e) => setCampaignId(e.target.value === 'all' ? null : e.target.value)} className="h-9 px-3 rounded-control border border-input-border bg-white text-[13px] outline-none focus:border-accent">
          <option value="all">All searches</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {prospects.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <Kpi variant="deep" label="Companies" value={String(prospects.length)} delta={`${withPeople} with people`} />
          <Kpi variant="blue" label="Roofs measured" value={String(measured)} delta="On demand" deltaTone="muted" />
          <Kpi label="Contacts revealed" value={String(prospects.reduce((s, p) => s + (p.contactsRevealed ? p.contacts.length : 0), 0))} delta="Decision-makers" deltaTone="muted" />
          <Kpi label="Avg. score" value={String(Math.round(prospects.reduce((s, p) => s + p.score, 0) / (prospects.length || 1)))} delta="Fit" deltaTone="muted" />
        </div>
      )}
      {prospects.length === 0 && !running ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-3 gap-4 pb-4">
          {[...prospects].sort((a, b) => b.score - a.score).map((p) => <CompanyCard key={p.id} p={p} jobTitles={jobTitles} onOpen={() => onOpen(p.id)} />)}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16 rounded-card border border-dashed border-border">
      <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Building size={28} /></span>
      <div className="text-[16px] font-bold text-ink">No companies yet</div>
      <div className="text-[13px] text-muted-b max-w-[460px]">Head to the <b>Chat</b> tab and describe who you want to reach — Ovi finds the companies fast, and you reveal the people or measure a roof whenever you like.</div>
    </div>
  )
}

/* ─────────── Company-first card ─────────── */
function CompanyCard({ p, onOpen, jobTitles }: { p: SolarProspect; onOpen: () => void; jobTitles?: string[] }) {
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

  return (
    <div className="rounded-card bg-surface border border-border overflow-hidden flex flex-col hover:shadow-modal transition-shadow cursor-pointer group" onClick={onOpen}>
      <div className="p-3.5 flex flex-col gap-3">
        <div className="flex items-start gap-2.5">
          <CompanyLogo domain={p.domain} name={p.company} />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-[15px] leading-tight truncate text-ink">{p.company}</div>
            <div className="text-[11.5px] text-muted-2 truncate">{p.category || p.address}</div>
          </div>
          <span className="text-[12px] font-bold text-white px-2 py-0.5 rounded-full shrink-0" style={{ background: scoreTone(p.score) }}>{p.score}</span>
        </div>

        {/* Roof: measured strip, or a measure-on-demand CTA */}
        {!p.roofPending ? (
          <div className="relative rounded-lg overflow-hidden aspect-[16/7] bg-control">
            {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />}
            <RoofOverlay center={p.center} segments={p.roofSegments} footprint={p.roofFootprint} zoom={p.roofZoom} />
            <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between text-[10.5px] font-semibold text-white">
              <span className="px-2 py-0.5 rounded backdrop-blur-sm" style={{ background: 'rgba(34,211,238,0.85)' }}>{Math.round(p.systemKwp)} kWp</span>
              <span className="px-2 py-0.5 rounded bg-black/55 backdrop-blur-sm">{money(p.year1Saving, { compact: true })}/yr · {p.paybackYears}y</span>
            </div>
          </div>
        ) : (
          <button onClick={measure} disabled={measuring} className="h-9 rounded-lg border border-dashed border-border text-[12.5px] font-semibold text-ink-3 hover:border-accent hover:bg-accent-wash flex items-center justify-center gap-2 disabled:opacity-60">
            {measuring ? <span className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" /> : <Sun size={14} className="text-accent" />}{measuring ? 'Measuring roof…' : 'Measure roof'}
          </button>
        )}

        {/* People */}
        {p.contactsRevealed ? (
          top ? (
            <div className="flex items-center gap-2 text-[12px]">
              <span className="w-7 h-7 rounded-full bg-accent-wash text-accent flex items-center justify-center text-[10.5px] font-bold shrink-0">{initials(top.name)}</span>
              <span className="min-w-0 flex-1 truncate"><b className="font-semibold text-ink-2">{top.name}</b> <span className="text-muted-2">· {top.title}</span></span>
              {p.contacts.length > 1 && <span className="text-[11px] text-muted-b shrink-0">+{p.contacts.length - 1} more</span>}
            </div>
          ) : <div className="text-[12px] text-muted-2 flex items-center gap-1.5"><Person size={13} />No contacts found</div>
        ) : (
          <button onClick={reveal} disabled={revealing} className="h-9 rounded-lg text-white text-[12.5px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}>
            {revealing ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Person size={14} />}{revealing ? 'Finding people…' : 'Reveal people (1 credit)'}
          </button>
        )}

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[11px] text-muted-2 truncate flex items-center gap-1"><Envelope size={12} />{p.domain || 'No website'}</span>
          <select value={p.status} onClick={(e) => e.stopPropagation()} onChange={(e) => act.setSolarProspectStatus(p.id, e.target.value as SolarProspectStatus)} className="h-7 px-2 rounded-control border border-input-border bg-white text-[11.5px] outline-none focus:border-accent">
            {SOLAR_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
const initials = (n: string) => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

/* tiny markdown-ish bold renderer for chat */
function renderText(t: string) {
  return t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>))
}
