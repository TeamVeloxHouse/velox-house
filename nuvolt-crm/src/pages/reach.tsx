import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Kpi, Chip, Avatar, Progress } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Sun, Radar, Search, Send, Sparkle, Plus, Check, Envelope, Person, Bolt, Building } from '../components/icons'
import { useActions } from '../store/store'
import { money, classNames } from '../lib/format'

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

/* ============================ Outreach ============================ */
const outreachSeqs = [
  { id: 'o1', name: 'Solar site owners — multichannel', channels: ['Email', 'LinkedIn'], enrolled: 240, sent: 612, replies: 44, meetings: 12, active: true, steps: [
    { d: 0, ch: 'Email', label: 'Intro: “we measured your roof”' },
    { d: 1, ch: 'LinkedIn', label: 'Connect + personalised note' },
    { d: 3, ch: 'Email', label: 'Savings estimate + case study' },
    { d: 6, ch: 'LinkedIn', label: 'Message: offer a free survey' },
    { d: 9, ch: 'Email', label: 'Break-up' },
  ] },
  { id: 'o2', name: 'Facilities directors — energy', channels: ['Email', 'LinkedIn'], enrolled: 180, sent: 430, replies: 31, meetings: 8, active: true, steps: [
    { d: 0, ch: 'Email', label: 'Problem/insight opener' },
    { d: 2, ch: 'LinkedIn', label: 'Connect' },
    { d: 4, ch: 'Email', label: 'ROI follow-up' },
    { d: 7, ch: 'Email', label: 'Break-up' },
  ] },
]
const chColor: Record<string, string> = { Email: '#1D4ED8', LinkedIn: '#0A66C2' }

export function Outreach() {
  const act = useActions()
  return (
    <>
      <TopBar title="Outreach" crumbs={['Reach', 'Multichannel']} actions={<><Button icon={<Sparkle size={16} />} onClick={() => act.toast('AI wrote a 5-step sequence from your ICP', 'accent')}>AI sequence</Button><Button variant="primary" icon={<Plus size={16} />} onClick={() => act.toast('Sequence builder (demo)', 'accent')}>New sequence</Button></>} />
      <PageBody>
        <div className="grid grid-cols-4 gap-4">
          <Kpi variant="blue" label="Enrolled" value="420" delta="Across 2 sequences" deltaTone="muted" />
          <Kpi label="Messages sent" value="1,042" delta="Email + LinkedIn" deltaTone="muted" />
          <Kpi label="Reply rate" value="19%" delta="+3 pts" />
          <Kpi variant="deep" label="Meetings" value="20" delta="From outreach" />
        </div>
        {outreachSeqs.map((s) => (
          <div key={s.id} className="bg-surface border border-border rounded-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div>
                <div className="text-[15px] font-semibold text-ink flex items-center gap-2">{s.name}{s.channels.map((c) => (<span key={c} className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded" style={{ background: chColor[c] }}>{c}</span>))}</div>
                <div className="text-[12px] text-muted-2 mt-0.5">{s.enrolled} enrolled · {s.sent} sent · {s.replies} replies · {s.meetings} meetings</div>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <div className="text-right"><div className="text-[16px] font-bold text-positive">{Math.round((s.replies / s.sent) * 100)}%</div><div className="text-[11px] text-muted-2">reply</div></div>
                <button className={classNames('w-11 h-6 rounded-full flex items-center px-0.5', s.active ? 'bg-accent justify-end' : 'bg-input-border justify-start')}><span className="w-5 h-5 rounded-full bg-white shadow" /></button>
              </div>
            </div>
            <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
              {s.steps.map((st, i) => (
                <div key={i} className="flex items-center gap-2 shrink-0">
                  <div className="rounded-lg border border-border bg-surface-tint px-3 py-2 min-w-[170px]">
                    <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-md flex items-center justify-center text-white" style={{ background: chColor[st.ch] }}>{st.ch === 'Email' ? <Envelope size={12} /> : <Person size={12} />}</span><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">Day {st.d}</span></div>
                    <div className="text-[12.5px] text-ink-2 font-medium mt-1 leading-snug">{st.label}</div>
                  </div>
                  {i < s.steps.length - 1 && <div className="w-4 h-px bg-border" />}
                </div>
              ))}
            </div>
          </div>
        ))}
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
