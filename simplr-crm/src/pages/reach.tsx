import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Kpi, Chip, Avatar, Progress } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Sun, Radar, Search, Send, Sparkle, Plus, Check, Envelope, Person, Bolt, Building, Clock, Megaphone } from '../components/icons'
import { useActions, useState_ } from '../store/store'
import type { ChannelStatus, Enrolment } from '../store/types'
import { money, classNames } from '../lib/format'
import { useChat, AiMessage, AiComposer } from '../components/AiChat'
import { useEffect, useRef } from 'react'

/* ============================ AI Operator ============================ */
const operatorPrompts = [
  'Find 50 solar companies and their directors, then email them',
  'Source 30 facilities directors in utilities and start a campaign',
  'Find 20 data-centre operators and add them to Leads',
  'Every Monday, find 20 new solar sites and email them',
]

export function OutreachOperator() {
  const { turns, ask } = useChat(undefined, { listen: false })
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }) }, [turns])
  const running = turns.length > 0

  return (
    <div className="rounded-card border border-[#D8D0FF] bg-gradient-to-br from-[#F6F3FF] to-white overflow-hidden">
      <div className="px-5 py-3.5 flex items-center gap-2.5 border-b border-[#EAE4FF]">
        <span className="w-8 h-8 rounded-[9px] text-white flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(180deg,#7C5CFF 0%,#5B29CC 100%)' }}><Sparkle size={17} /></span>
        <div className="flex-1">
          <div className="text-[14px] font-bold text-ink flex items-center gap-2">Simplr AI · Outreach operator <Chip tone="positive" dot>Live</Chip></div>
          <div className="text-[12px] text-muted-b">Tell it what to do in plain English — it prospects, writes, and runs the campaign for you.</div>
        </div>
      </div>

      {running && (
        <div ref={scroller} className="max-h-[420px] overflow-y-auto px-5 py-4 flex flex-col gap-5 bg-white/60">
          {turns.map((t, i) => (<AiMessage key={i} turn={t} />))}
        </div>
      )}

      <div className="p-4">
        {!running && (
          <div className="flex flex-wrap gap-2 mb-3">
            {operatorPrompts.map((p) => (
              <button key={p} onClick={() => ask(p)} className="text-left text-[12.5px] text-[#5B29CC] bg-white border border-[#E0D8FF] rounded-lg px-3 py-2 hover:border-[#7C5CFF] transition-colors flex items-center gap-2"><Sparkle size={13} />{p}</button>
            ))}
          </div>
        )}
        <AiComposer onSend={ask} />
      </div>
    </div>
  )
}

/* ============================ Overview ============================ */
const funnel = [
  { stage: 'Found', n: 4820, color: '#8FB0FF' },
  { stage: 'Contacted', n: 1640, color: '#5B85F0' },
  { stage: 'Opened / viewed', n: 980, color: '#3A67E4' },
  { stage: 'Replied', n: 312, color: '#1D4ED8' },
  { stage: 'Meeting booked', n: 96, color: '#5B29CC' },
  { stage: 'Handed to CRM', n: 58, color: '#0E7C66' },
]

export function ReachOverview() {
  const nav = useNavigate()
  const max = funnel[0].n
  return (
    <>
      <TopBar title="Reach" crumbs={['Overview']} actions={<><Button icon={<Radar size={16} />} onClick={() => nav('/reach/finders')}>Finders</Button><Button variant="primary" icon={<Send size={16} />} onClick={() => nav('/reach/outreach')}>New campaign</Button></>} />
      <PageBody>
        <div>
          <div className="text-[24px] font-bold text-ink tracking-[-0.02em]">Fill the top of your funnel</div>
          <div className="text-[14px] text-muted-b mt-1">Find prospects with vertical finders, reach them across email &amp; LinkedIn, and hand warm leads to the CRM.</div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <Kpi variant="deep" label="Prospects found" value="4,820" delta="+640 this week" />
          <Kpi variant="blue" label="Reply rate" value="19%" delta="+3 pts" />
          <Kpi label="Meetings booked" value="96" delta="This quarter" />
          <Kpi label="→ Pipeline created" value={money(1240000, { compact: true })} delta="58 leads to CRM" />
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
          <div className="bg-surface border border-border rounded-card p-5">
            <div className="text-[15px] font-semibold text-ink mb-4">Prospecting funnel</div>
            <div className="flex flex-col gap-2.5">
              {funnel.map((f) => (
                <div key={f.stage} className="flex items-center gap-3">
                  <div className="w-32 text-[13px] text-ink-3 shrink-0">{f.stage}</div>
                  <div className="flex-1 h-7 rounded-lg bg-control overflow-hidden"><div className="h-full rounded-lg flex items-center px-2.5 text-[12px] font-semibold text-white" style={{ width: `${(f.n / max) * 100}%`, background: f.color, minWidth: 44 }}>{f.n.toLocaleString()}</div></div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-card p-5">
            <div className="text-[15px] font-semibold text-ink mb-4">By channel</div>
            {[['Email', 62, '#1D4ED8'], ['LinkedIn', 31, '#0A66C2'], ['Calls', 7, '#0E7C66']].map(([l, v, c]) => (
              <div key={l as string} className="mb-3">
                <div className="flex justify-between text-[12px] mb-1"><span className="text-ink-3">{l}</span><span className="font-semibold text-ink-2">{v}%</span></div>
                <Progress value={v as number} color={c as string} />
              </div>
            ))}
            <button onClick={() => nav('/reach/analytics')} className="text-[13px] text-accent font-semibold mt-2">Full analytics →</button>
          </div>
        </div>
      </PageBody>
    </>
  )
}

/* ============================ Finders hub ============================ */
const finders = [
  { id: 'solar', name: 'Solar roof finder', desc: 'Scan an area, measure every roof’s solar potential, and prospect the best sites.', to: '/reach/solar', icon: Sun, color: '#F59E0B', live: true, found: '1,240 roofs' },
  { id: 'b2b', name: 'B2B database', desc: '400M+ contacts. Filter by role, industry and company size, reveal verified emails.', to: '/reach/prospects', icon: Search, color: '#1D4ED8', live: true, found: '4.8k matches' },
  { id: 'local', name: 'Local business finder', desc: 'Map-based discovery of businesses by type and area (Places + enrichment).', to: '/reach/finders', icon: Building, color: '#0E7C66', live: false, found: 'Coming soon' },
  { id: 'intent', name: 'Buyer-intent signals', desc: 'Surface companies showing hiring, funding or tech-change signals.', to: '/reach/finders', icon: Bolt, color: '#5B29CC', live: false, found: 'Coming soon' },
]

export function Finders() {
  const nav = useNavigate()
  const act = useActions()
  return (
    <>
      <TopBar title="Finders" crumbs={['Prospecting sources']} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => act.toast('Custom finder builder (demo)', 'accent')}>New finder</Button>} />
      <PageBody>
        <div className="text-[14px] text-muted-b max-w-[640px]">Each finder is a vertical prospecting engine. Solar measures roofs; B2B queries a contact database; more verticals plug in the same way.</div>
        <div className="grid grid-cols-2 gap-4">
          {finders.map((f) => (
            <button key={f.id} onClick={() => (f.live ? nav(f.to) : act.toast(`${f.name} — coming soon`, 'accent'))} className={classNames('text-left bg-surface border rounded-card p-5 transition-shadow', f.live ? 'border-border hover:shadow-card' : 'border-dashed border-input-border opacity-80')}>
              <div className="flex items-start justify-between">
                <span className="w-11 h-11 rounded-[12px] flex items-center justify-center text-white shrink-0" style={{ background: f.color }}><f.icon size={22} /></span>
                <Chip tone={f.live ? 'positive' : 'neutral'} dot>{f.live ? 'Live' : 'Soon'}</Chip>
              </div>
              <div className="text-[15px] font-bold text-ink mt-3">{f.name}</div>
              <div className="text-[13px] text-muted-b mt-1 leading-relaxed">{f.desc}</div>
              <div className="text-[12px] text-accent font-semibold mt-3">{f.found}</div>
            </button>
          ))}
        </div>
      </PageBody>
    </>
  )
}

/* ============================ Solar finder ============================ */
type Roof = { id: string; address: string; roofArea: number; usable: number; panels: number; kwp: number; annualKwh: number; savings: number; suitability: 'Excellent' | 'Good' | 'Fair' }
function buildRoofs(area: string): Roof[] {
  const seed = area.split('').reduce((a, c) => a + c.charCodeAt(0), 7)
  const streets = ['Mill Lane', 'Victoria Rd', 'Oak Drive', 'High St', 'Station Rd', 'Church Way', 'Elm Close', 'Queens Ave', 'Park Rd', 'The Sidings', 'Bridge St', 'Meadow View']
  return Array.from({ length: 12 }, (_, i) => {
    const roofArea = 60 + ((seed + i * 37) % 240)
    const usable = Math.round(roofArea * (0.45 + ((seed + i) % 30) / 100))
    const panels = Math.floor(usable / 1.8)
    const kwp = +(panels * 0.42).toFixed(1)
    const annualKwh = Math.round(kwp * 950)
    const savings = Math.round(annualKwh * 0.28)
    const suit: Roof['suitability'] = kwp >= 20 ? 'Excellent' : kwp >= 10 ? 'Good' : 'Fair'
    return { id: `rf${i}`, address: `${10 + ((seed * (i + 1)) % 180)} ${streets[(seed + i) % streets.length]}, ${area || 'Manchester'}`, roofArea, usable, panels, kwp, annualKwh, savings, suitability: suit }
  }).sort((a, b) => b.kwp - a.kwp)
}
const suitTone = { Excellent: 'positive', Good: 'accent', Fair: 'warning' } as const

export function SolarFinder() {
  const act = useActions()
  const [area, setArea] = useState('')
  const [scanned, setScanned] = useState<Roof[] | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const template = '2.2fr 0.9fr 1fr 1fr 1fr 1fr'

  function scan() {
    setScanned(buildRoofs(area.trim()))
    act.toast(`Scanned roofs in ${area || 'Manchester'} — 12 sites measured`)
  }
  function addProspect(r: Roof) {
    if (added.has(r.id)) return
    act.addLead({ name: r.address.split(',')[0], company: r.address, role: 'Property owner', source: 'Solar finder', score: r.suitability === 'Excellent' ? 88 : r.suitability === 'Good' ? 72 : 58 })
    setAdded((s) => new Set(s).add(r.id))
  }

  const totalKwp = scanned?.reduce((s, r) => s + r.kwp, 0) ?? 0
  const excellent = scanned?.filter((r) => r.suitability === 'Excellent').length ?? 0

  return (
    <>
      <TopBar title="Solar finder" crumbs={['Reach', 'Finders']} actions={<Chip tone="warning" dot>Powered by Solar API</Chip>} />
      <PageBody>
        <div className="rounded-card p-5 flex items-center gap-4" style={{ background: 'linear-gradient(150deg,#FFF7ED,#FFFFFF 70%)', border: '1px solid #FBE3C2' }}>
          <span className="w-12 h-12 rounded-[14px] flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(180deg,#FBBF24,#F59E0B)' }}><Sun size={26} /></span>
          <div className="flex-1">
            <div className="text-[16px] font-bold text-ink">Measure every roof in an area</div>
            <div className="text-[13px] text-muted-b mt-0.5">Enter a postcode or town. We estimate usable roof area, system size and annual savings for each building — then prospect the best sites.</div>
          </div>
          <div className="flex items-center gap-2">
            <input value={area} onChange={(e) => setArea(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && scan()} placeholder="Postcode or town" className="h-10 w-[200px] px-3 rounded-control border border-input-border bg-white text-[14px] outline-none focus:border-accent" />
            <Button variant="primary" icon={<Radar size={16} />} onClick={scan}>Scan roofs</Button>
          </div>
        </div>

        {!scanned ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-12">
            <Sun size={40} className="text-[#F59E0B]" />
            <div className="text-[16px] font-semibold text-ink-2">Scan an area to begin</div>
            <div className="text-[13px] text-muted-b max-w-[420px]">Try “Manchester”, “SW1A”, or any town. Each building is measured for solar potential using roof geometry &amp; irradiance data.</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-4">
              <Kpi variant="deep" label="Roofs measured" value={String(scanned.length)} delta={area || 'Manchester'} />
              <Kpi variant="blue" label="Total capacity" value={`${Math.round(totalKwp)} kWp`} delta="Combined potential" deltaTone="muted" />
              <Kpi label="Excellent sites" value={String(excellent)} delta="≥ 20 kWp" />
              <Kpi label="Est. annual savings" value={money(scanned.reduce((s, r) => s + r.savings, 0), { compact: true })} delta="Across all sites" />
            </div>
            <Table
              template={template}
              columns={[{ key: 'a', header: 'Building' }, { key: 'roof', header: 'Usable roof', align: 'right' }, { key: 'sys', header: 'System', align: 'right' }, { key: 'gen', header: 'Annual gen.', align: 'right' }, { key: 'save', header: 'Est. savings/yr', align: 'right' }, { key: 'fit', header: 'Suitability' }]}
              footer={<><span>{scanned.length} roofs measured</span><span>Estimates — confirm on site survey</span></>}
            >
              {scanned.map((r) => (
                <Row key={r.id} template={template}>
                  <Cell><div className="font-semibold text-ink-2 truncate">{r.address}</div><div className="text-[12px] text-muted-2">{r.roofArea} m² roof</div></Cell>
                  <Cell align="right" className="text-ink-2">{r.usable} m²</Cell>
                  <Cell align="right" className="font-semibold text-ink-2">{r.kwp} kWp<div className="text-[12px] text-muted-2 font-normal">{r.panels} panels</div></Cell>
                  <Cell align="right" muted>{r.annualKwh.toLocaleString()} kWh</Cell>
                  <Cell align="right" className="font-semibold text-positive">{money(r.savings)}</Cell>
                  <Cell>
                    <div className="flex items-center gap-2">
                      <Chip tone={suitTone[r.suitability]} dot>{r.suitability}</Chip>
                      {added.has(r.id) ? <span className="text-[12px] text-positive font-semibold flex items-center gap-1"><Check size={12} /> Added</span> : <button onClick={() => addProspect(r)} className="text-[12px] text-accent font-semibold hover:underline">+ Prospect</button>}
                    </div>
                  </Cell>
                </Row>
              ))}
            </Table>
          </>
        )}
      </PageBody>
    </>
  )
}

/* ============================ Outreach (multichannel cockpit) ============================ */
const chColor: Record<string, string> = { Email: '#1D4ED8', LinkedIn: '#0A66C2' }
const statusTone: Record<ChannelStatus, { fg: string; bg: string; label: string }> = {
  pending: { fg: '#7A8494', bg: '#F1F3F7', label: 'Pending' },
  due: { fg: '#C2410C', bg: '#FDF1E7', label: 'Due now' },
  sent: { fg: '#1D4ED8', bg: '#EEF2FB', label: 'Sent' },
  opened: { fg: '#3A67E4', bg: '#EEF2FB', label: 'Opened' },
  replied: { fg: '#0E7C66', bg: '#E9F5F1', label: 'Replied' },
  connected: { fg: '#0A66C2', bg: '#E7EFFA', label: 'Connected' },
  bounced: { fg: '#B01B4F', bg: '#FDECEF', label: 'Bounced' },
  skipped: { fg: '#7A8494', bg: '#F1F3F7', label: 'Skipped' },
}

export function Outreach() {
  const act = useActions()
  const { sequences, enrolments } = useState_()
  const [selSeq, setSelSeq] = useState<string>('sq1')
  const seq = sequences.find((s) => s.id === selSeq) ?? sequences[0]
  const dueNow = enrolments.filter((e) => e.status === 'due')
  const rows = enrolments.filter((e) => e.sequenceId === (seq?.id ?? ''))
  const template = '1.8fr 1fr 1.4fr 1fr 1fr 0.8fr'

  return (
    <>
      <TopBar title="Outreach" crumbs={['Reach', 'Multichannel']} actions={<><Button icon={<Sparkle size={16} />} onClick={() => act.toast('AI wrote a 5-step email + LinkedIn sequence from your ICP', 'accent')}>AI sequence</Button><Button variant="primary" icon={<Plus size={16} />} onClick={() => act.toast('Sequence builder (demo)', 'accent')}>New sequence</Button></>} />
      <PageBody>
        <OutreachOperator />
        <div className="grid grid-cols-4 gap-4">
          <Kpi variant="blue" label="Enrolled" value={String(enrolments.length)} delta={`${sequences.length} sequences`} deltaTone="muted" />
          <Kpi variant="deep" label="Due now" value={String(dueNow.length)} delta="Across channels" />
          <Kpi label="Replied" value={String(enrolments.filter((e) => e.status === 'replied').length)} delta="Awaiting your reply" />
          <Kpi label="Reply rate" value="19%" delta="+3 pts" />
        </div>

        {/* Due-now work queue — the daily multichannel to-do */}
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2"><div className="text-[15px] font-semibold text-ink">Today’s outreach queue</div><Chip tone="warning" dot>{dueNow.length} due</Chip><span className="ml-auto text-[12px] text-muted-2">Each action is logged to the contact automatically</span></div>
          {dueNow.length === 0 && <div className="px-5 py-6 text-center text-[13px] text-muted-2">Queue clear — nothing due right now.</div>}
          {dueNow.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-5 py-3 border-b border-divider-row last:border-0">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: chColor[e.channel] }}>{e.channel === 'Email' ? <Envelope size={14} /> : <Person size={14} />}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-ink-2">{e.name} · <span className="text-muted-2 font-normal">{e.company}</span></div>
                <div className="text-[12px] text-muted-2">{e.channel} · step {e.stepIndex + 1}/{e.totalSteps}: {e.stepLabel}</div>
              </div>
              <Button onClick={() => act.advanceEnrolment(e)} variant="primary" icon={e.channel === 'Email' ? <Send size={15} /> : <Person size={15} />}>{e.channel === 'Email' ? 'Send email' : 'Do LinkedIn step'}</Button>
              <button onClick={() => act.toast(`${e.name} skipped`, 'warning')} className="text-[12px] text-muted-b hover:text-ink-3 font-medium">Skip</button>
            </div>
          ))}
        </div>

        {/* Sequence staging */}
        <div className="flex items-center gap-2 flex-wrap">
          {sequences.map((s) => (
            <button key={s.id} onClick={() => setSelSeq(s.id)} className={classNames('h-9 px-3.5 rounded-lg text-[13px] font-medium border transition-colors', selSeq === s.id ? 'bg-accent text-white border-accent' : 'bg-surface border-border text-muted-b hover:bg-control')}>{s.name}</button>
          ))}
        </div>
        {seq && (
          <div className="bg-surface border border-border rounded-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div>
                <div className="text-[15px] font-semibold text-ink">{seq.name}</div>
                <div className="text-[12px] text-muted-2 mt-0.5">{seq.enrolled} enrolled · {seq.replyRate}% reply · {seq.steps.length} steps across email &amp; LinkedIn</div>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                {[...new Set(seq.steps.map((st) => st.type === 'linkedin' ? 'LinkedIn' : st.type === 'email' ? 'Email' : null).filter(Boolean))].map((c) => (<span key={c as string} className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded" style={{ background: chColor[c as string] }}>{c}</span>))}
                <button onClick={() => act.toggleSequence(seq.id, seq.active)} className={classNames('ml-1 w-11 h-6 rounded-full flex items-center px-0.5', seq.active ? 'bg-accent justify-end' : 'bg-input-border justify-start')}><span className="w-5 h-5 rounded-full bg-white shadow" /></button>
              </div>
            </div>
            {/* step rail */}
            <div className="flex items-stretch gap-2 overflow-x-auto pb-3 mb-3 border-b border-divider">
              {seq.steps.map((st, i) => {
                const ch = st.type === 'linkedin' ? 'LinkedIn' : st.type === 'email' ? 'Email' : null
                return (
                  <div key={st.id} className="flex items-center gap-2 shrink-0">
                    <div className="rounded-lg border border-border bg-surface-tint px-3 py-2 min-w-[160px]">
                      <div className="flex items-center gap-1.5">{ch ? <span className="w-5 h-5 rounded-md flex items-center justify-center text-white" style={{ background: chColor[ch] }}>{ch === 'Email' ? <Envelope size={12} /> : <Person size={12} />}</span> : <span className="w-5 h-5 rounded-md bg-control flex items-center justify-center text-muted-2 text-[10px]">⏱</span>}<span className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">Day {st.day}</span></div>
                      <div className="text-[12.5px] text-ink-2 font-medium mt-1 leading-snug">{st.label}</div>
                    </div>
                    {i < seq.steps.length - 1 && <div className="w-4 h-px bg-border" />}
                  </div>
                )
              })}
            </div>
            {/* enrolment staging table */}
            <div className="text-[13px] font-semibold text-ink mb-2">Enrolled prospects · staged</div>
            <Table
              template={template}
              columns={[{ key: 'p', header: 'Prospect' }, { key: 'ch', header: 'Channel' }, { key: 'prog', header: 'Progress' }, { key: 'step', header: 'Current step' }, { key: 'st', header: 'Status' }, { key: 'due', header: 'Next' }]}
              footer={<span>{rows.length} enrolled in this sequence</span>}
            >
              {rows.map((e: Enrolment) => {
                const s = statusTone[e.status]
                return (
                  <Row key={e.id} template={template}>
                    <Cell><div className="flex items-center gap-2.5"><Avatar name={e.name} size={28} /><div className="min-w-0"><div className="font-semibold text-ink-2 truncate">{e.name}</div><div className="text-[12px] text-muted-2 truncate">{e.company}</div></div></div></Cell>
                    <Cell><span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: chColor[e.channel] }}>{e.channel === 'Email' ? <Envelope size={13} /> : <Person size={13} />}{e.channel}</span></Cell>
                    <Cell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-[90px] h-1.5 rounded-full bg-control overflow-hidden"><div className="h-full rounded-full bg-accent" style={{ width: `${(e.stepIndex / e.totalSteps) * 100}%` }} /></div>
                        <span className="text-[12px] text-muted-2 tabular-nums">{e.stepIndex}/{e.totalSteps}</span>
                      </div>
                    </Cell>
                    <Cell muted>{e.stepLabel}</Cell>
                    <Cell><span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-chip text-[12px] font-semibold" style={{ background: s.bg, color: s.fg }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: s.fg }} />{s.label}</span></Cell>
                    <Cell muted>{e.status === 'due' ? <button onClick={() => act.advanceEnrolment(e)} className="text-accent font-semibold">Send now</button> : e.nextDue}</Cell>
                  </Row>
                )
              })}
            </Table>
          </div>
        )}
      </PageBody>
    </>
  )
}

/* ============================ Analytics ============================ */
export function ReachAnalytics() {
  const weeks = [40, 62, 55, 78, 90, 72, 96]
  const max = Math.max(...weeks)
  return (
    <>
      <TopBar title="Analytics" crumbs={['Reach', 'Performance']} actions={<Button>Last 8 weeks</Button>} />
      <PageBody>
        <div className="grid grid-cols-4 gap-4">
          <Kpi variant="blue" label="Prospects added" value="4,820" delta="+640 this week" />
          <Kpi label="Contacted" value="1,640" delta="34% of found" deltaTone="muted" />
          <Kpi label="Reply rate" value="19%" delta="+3 pts" />
          <Kpi variant="deep" label="Meetings booked" value="96" delta="2.0% of contacted" />
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
          <div className="bg-surface border border-border rounded-card p-5">
            <div className="text-[15px] font-semibold text-ink mb-4">Meetings booked / week</div>
            <div className="flex items-end gap-3 h-[200px]">
              {weeks.map((w, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 justify-end">
                  <div className="text-[11px] font-semibold text-ink-2">{w}</div>
                  <div className="w-full rounded-t bg-accent-gradient" style={{ height: `${(w / max) * 150}px` }} />
                  <div className="text-[11px] text-muted-2">W{i + 1}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-card p-5">
            <div className="text-[15px] font-semibold text-ink mb-4">Channel performance</div>
            {[['Email', 'Reply 16%', 62], ['LinkedIn', 'Reply 24%', 31], ['Calls', 'Connect 12%', 7]].map(([l, s, v]) => (
              <div key={l as string} className="mb-3.5">
                <div className="flex justify-between text-[12px] mb-1"><span className="text-ink-3 font-medium">{l}</span><span className="text-muted-2">{s}</span></div>
                <Progress value={v as number} color={l === 'LinkedIn' ? '#0A66C2' : l === 'Calls' ? '#0E7C66' : '#1D4ED8'} />
              </div>
            ))}
            <div className="mt-4 rounded-[10px] bg-accent-wash-3 border border-[#D3E0FA] p-3 text-[12px] text-accent-700 leading-relaxed"><Sparkle size={12} className="inline mr-1" />LinkedIn replies convert 1.6× better — the AI is shifting budget toward it.</div>
          </div>
        </div>
      </PageBody>
    </>
  )
}

/* ============================ Campaigns ============================ */
const campStatusTone: Record<string, 'positive' | 'accent' | 'neutral' | 'warning'> = { running: 'positive', draft: 'neutral', complete: 'neutral', scheduled: 'accent' }

export function ReachCampaigns() {
  const nav = useNavigate()
  const { reachCampaigns } = useState_()
  const totalSent = reachCampaigns.reduce((s, c) => s + c.sent, 0)
  const totalReplies = reachCampaigns.reduce((s, c) => s + c.replies, 0)
  const totalMeetings = reachCampaigns.reduce((s, c) => s + c.meetings, 0)
  return (
    <>
      <TopBar title="Campaigns" crumbs={['Reach', 'Multichannel']} actions={<><Button icon={<Sparkle size={16} />} onClick={() => nav('/reach/outreach')}>Ask AI to run one</Button><Button variant="primary" icon={<Plus size={16} />} onClick={() => nav('/reach/outreach')}>New campaign</Button></>} />
      <PageBody>
        <div className="grid grid-cols-4 gap-4">
          <Kpi variant="blue" label="Active campaigns" value={String(reachCampaigns.filter((c) => c.status === 'running').length)} delta={`${reachCampaigns.length} total`} deltaTone="muted" />
          <Kpi variant="deep" label="Touches sent" value={totalSent.toLocaleString()} delta="Email + LinkedIn" />
          <Kpi label="Replies" value={String(totalReplies)} delta={`${Math.round((totalReplies / Math.max(1, totalSent)) * 100)}% reply rate`} />
          <Kpi label="Meetings booked" value={String(totalMeetings)} delta="From outreach" />
        </div>
        <div className="flex flex-col gap-3">
          {reachCampaigns.map((c) => (
            <div key={c.id} className="bg-surface border border-border rounded-card p-5">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-[10px] bg-[#F1ECFF] text-[#5B29CC] flex items-center justify-center shrink-0"><Megaphone size={18} /></span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="text-[15px] font-semibold text-ink">{c.name}</span>{c.createdBy === 'AI' && <Chip tone="accent" dot>AI-built</Chip>}</div>
                  <div className="text-[12px] text-muted-2">{c.vertical} · {c.audience} prospects · {c.sequence} · {c.channels.join(' + ')}</div>
                </div>
                <div className="ml-auto"><Chip tone={campStatusTone[c.status]} dot>{c.status}</Chip></div>
              </div>
              <div className="grid grid-cols-4 gap-3 mt-4">
                {[['Audience', String(c.audience)], ['Sent', String(c.sent)], ['Replies', String(c.replies)], ['Meetings', String(c.meetings)]].map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-surface-tint border border-border px-3 py-2"><div className="text-[11px] text-muted-2">{l}</div><div className="text-[16px] font-bold text-ink-2">{v}</div></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PageBody>
    </>
  )
}

/* ============================ Scheduled tasks ============================ */
export function ReachSchedules() {
  const { scheduledTasks } = useState_()
  const act = useActions()
  return (
    <>
      <TopBar title="Scheduled tasks" crumbs={['Reach', 'Automate']} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => act.addScheduledTask('Find 20 new prospects matching my ICP and email them', 'Weekly · Mon 08:00')}>New scheduled task</Button>} />
      <PageBody>
        <div className="rounded-card bg-gradient-to-br from-[#F6F3FF] to-white border border-[#E0D8FF] p-4 flex items-start gap-3">
          <span className="w-9 h-9 rounded-[10px] text-white flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(180deg,#7C5CFF 0%,#5B29CC 100%)' }}><Clock size={18} /></span>
          <div><div className="text-[13px] font-semibold text-ink-2">Set-and-forget outreach</div><div className="text-[12.5px] text-muted-b mt-0.5">Schedule any AI operator command to run on a cadence — Simplr prospects, writes and sends, then reports the result back to you each time.</div></div>
        </div>
        <div className="bg-surface border border-border rounded-card divide-y divide-divider">
          {scheduledTasks.map((t) => (
            <div key={t.id} className="flex items-start gap-3 px-5 py-4">
              <span className={classNames('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', t.active ? 'bg-[#F1ECFF] text-[#5B29CC]' : 'bg-control text-muted-2')}><Clock size={15} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-ink-2">{t.prompt}</div>
                <div className="text-[12px] text-muted-2 mt-0.5">{t.cadence} · next run {t.nextRun}{t.lastResult ? ` · last: ${t.lastResult}` : ''}</div>
              </div>
              <Chip tone={t.active ? 'positive' : 'neutral'} dot>{t.active ? 'Active' : 'Paused'}</Chip>
              <button onClick={() => act.toggleScheduled(t.id, t.active)} className={classNames('w-11 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0', t.active ? 'bg-[#7C5CFF] justify-end' : 'bg-input-border justify-start')}><span className="w-5 h-5 rounded-full bg-white shadow" /></button>
              <button onClick={() => act.removeScheduled(t.id)} className="text-[12px] text-negative font-medium hover:underline shrink-0">Remove</button>
            </div>
          ))}
        </div>
      </PageBody>
    </>
  )
}

/* ============================ Reach AI (full-page operator) ============================ */
export function ReachAI() {
  const nav = useNavigate()
  const { turns, ask } = useChat(undefined, { listen: false })
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }) }, [turns])
  const empty = turns.length === 0

  const caps = [
    { icon: Search, title: 'Prospect anything', sub: 'Find companies + decision-makers by vertical, role, area' },
    { icon: Send, title: 'Run outreach', sub: 'Draft, personalise and launch email + LinkedIn sequences' },
    { icon: Sun, title: 'Work solar sites', sub: 'Scan roofs, qualify sites, and reach the owners' },
    { icon: Sparkle, title: 'Do it on a schedule', sub: '“Every Monday, find 20 and email them”' },
  ]

  return (
    <>
      <TopBar title="Reach AI" crumbs={['Autonomous operator']} actions={<Button icon={<Sparkle size={16} />} onClick={() => nav('/reach/schedules')}>Scheduled tasks</Button>} />
      <div className="flex-1 flex flex-col min-h-0">
        <div ref={scroller} className="flex-1 overflow-y-auto">
          {empty ? (
            <div className="max-w-[760px] mx-auto px-7 py-12 flex flex-col gap-8">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl text-white flex items-center justify-center shadow-primary" style={{ background: 'linear-gradient(180deg,#7C5CFF 0%,#5B29CC 100%)' }}><Sparkle size={28} /></div>
                <div>
                  <div className="text-[24px] font-bold text-ink tracking-[-0.02em]">Your outreach, on autopilot</div>
                  <div className="text-[14px] text-muted-b mt-1">Tell me who to reach and I’ll find them, write to them, and run it — you watch it happen. Attach a list or ICP to work from your own data.</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {caps.map((c) => (
                  <div key={c.title} className="bg-surface border border-border rounded-card p-4 flex items-start gap-3">
                    <span className="w-9 h-9 rounded-[10px] bg-[#F1ECFF] text-[#5B29CC] flex items-center justify-center shrink-0"><c.icon size={18} /></span>
                    <div><div className="text-[13.5px] font-semibold text-ink-2">{c.title}</div><div className="text-[12.5px] text-muted-2 mt-0.5">{c.sub}</div></div>
                  </div>
                ))}
              </div>
              <div>
                <div className="eyebrow text-muted-3 mb-2.5">Try asking</div>
                <div className="flex flex-col gap-2">
                  {operatorPrompts.map((p) => (
                    <button key={p} onClick={() => ask(p)} className="text-left bg-surface border border-border rounded-xl px-4 py-3 text-[13.5px] text-ink-3 hover:border-[#C9BCFF] hover:bg-[#FAF8FF] transition-colors flex items-center gap-2.5"><Sparkle size={15} className="text-[#5B29CC] shrink-0" />{p}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-[760px] mx-auto px-7 py-7 flex flex-col gap-6">
              {turns.map((t, i) => (<AiMessage key={i} turn={t} />))}
            </div>
          )}
        </div>
        <div className="border-t border-border bg-canvas px-7 py-4">
          <div className="max-w-[760px] mx-auto">
            <AiComposer onSend={ask} placeholder="Tell Reach AI what to do — or attach a list of companies…" />
            <div className="text-[11px] text-muted-3 text-center mt-2">Reach AI prospects, writes and sends on your behalf. It shows every step live and never sends without your rules.</div>
          </div>
        </div>
      </div>
    </>
  )
}
