import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Kpi, Chip, Avatar } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Search, Radar, Plus, Check, Robot, Envelope, Link as LinkIcon, Sparkle } from '../components/icons'
import { useState_, useActions } from '../store/store'
import { sourceLeads, scoreTone, type SourcingCriteria, type SourcedLead } from '../lib/sourcing'
import { classNames } from '../lib/format'
import { Dropdown } from '../components/Dropdown'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const SIZES = ['', '1-10', '11-50', '51-200', '201-500', '501-1000']

export function PeopleFinder() {
  const act = useActions()
  const { playbooks } = useState_()
  const guide = playbooks.find((p) => p.scope === 'sourcing' && p.active) || playbooks.find((p) => p.scope === 'general' && p.active)

  const [c, setC] = useState<SourcingCriteria>({ title: 'Installer', industry: 'Renewables', location: '', companySize: '', keywords: [] })
  const [stage, setStage] = useState<string | null>(null)
  const [leads, setLeads] = useState<SourcedLead[] | null>(null)
  const [live, setLive] = useState(false)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const set = (patch: Partial<SourcingCriteria>) => setC((p) => ({ ...p, ...patch }))

  async function run() {
    setLeads(null); setAdded(new Set())
    setStage(guide ? `Reading your “${guide.title}” playbook…` : 'Querying People Data Labs…')
    await sleep(guide ? 600 : 450)
    setStage('Querying People Data Labs…')
    const res = await sourceLeads(c)
    setStage('Scoring fit against your ICP…'); await sleep(550)
    setStage('Researching buying signals…'); await sleep(600)
    setLeads(res.leads); setLive(res.live); setStage(null)
    act.toast(`${res.leads.length} leads sourced${res.live ? ' · live from People Data Labs' : ' · sample data'}`)
  }

  function add(l: SourcedLead) {
    if (added.has(l.id)) return
    act.addLead({ name: l.name, company: l.company, role: l.title, source: 'People finder', score: l.score })
    setAdded((s) => new Set(s).add(l.id))
  }
  function addAllQualified() {
    if (!leads) return
    const q = leads.filter((l) => l.score >= 65 && !added.has(l.id))
    if (q.length === 0) return
    act.bulkAddLeads(q.map((l) => ({ name: l.name, company: l.company, role: l.title, score: l.score })))
    setAdded((s) => { const n = new Set(s); q.forEach((l) => n.add(l.id)); return n })
    act.toast(`${q.length} qualified leads added to the CRM`)
  }

  const qualified = leads?.filter((l) => l.score >= 65).length ?? 0
  const withEmail = leads?.filter((l) => l.email).length ?? 0
  const avg = leads && leads.length ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length) : 0
  const template = '2fr 1.6fr 1.1fr 2.2fr 0.7fr'

  return (
    <>
      <TopBar
        title="People finder"
        crumbs={['Reach', 'Finders']}
        actions={<Chip tone={live ? 'positive' : 'warning'} dot>{live ? 'Live · People Data Labs' : 'People Data Labs'}</Chip>}
      />
      <PageBody>
        {/* search panel */}
        <div className="rounded-card p-5" style={{ background: 'linear-gradient(150deg,#EAF6F2,#FFFFFF 70%)', border: '1px solid #D8E2F6' }}>
          <div className="flex items-center gap-3 mb-3.5">
            <span className="w-11 h-11 rounded-[12px] flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(180deg,#1FAE94,#13927B)' }}><Search size={22} /></span>
            <div className="flex-1">
              <div className="text-[16px] font-bold text-ink">Source people from 400M+ contacts</div>
              <div className="text-[13px] text-muted-b mt-0.5">Describe your ideal customer. Solar House searches People Data Labs, then scores and researches each match before anything reaches your CRM.</div>
            </div>
            {guide && (
              <div className="flex items-center gap-2 rounded-lg bg-white/80 border border-[#D8E2F6] px-3 py-2 shrink-0" title={guide.body}>
                <Robot size={15} className="text-accent" />
                <div className="text-[12px] leading-tight"><span className="text-muted-2">Guided by</span><div className="font-semibold text-ink-2">{guide.title}</div></div>
              </div>
            )}
          </div>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr auto' }}>
            <LabeledInput label="Job title" value={c.title ?? ''} onChange={(v) => set({ title: v })} placeholder="Installer, Director…" />
            <LabeledInput label="Industry" value={c.industry ?? ''} onChange={(v) => set({ industry: v })} placeholder="Renewables" />
            <LabeledInput label="Location" value={c.location ?? ''} onChange={(v) => set({ location: v })} placeholder="Any (UK)" />
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide">Company size</span>
              <Dropdown value={c.companySize ?? ''} onChange={(e) => set({ companySize: e.target.value })} className="h-10 px-2.5 rounded-control border border-input-border bg-white text-[13px] text-ink-2 outline-none focus:border-accent">
                {SIZES.map((s) => <option key={s} value={s}>{s || 'Any'}</option>)}
              </Dropdown>
            </label>
            <div className="flex flex-col gap-1 justify-end">
              <span className="text-[11px] font-semibold text-transparent uppercase">Go</span>
              <Button variant="primary" icon={<Radar size={16} />} onClick={run}>Source leads</Button>
            </div>
          </div>
        </div>

        {/* working / empty / results */}
        {stage ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16">
            <span className="w-9 h-9 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <div className="text-[15px] font-semibold text-ink-2">{stage}</div>
            <div className="text-[13px] text-muted-b">Finding, scoring and researching your leads…</div>
          </div>
        ) : !leads ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-16">
            <Search size={38} className="text-accent" />
            <div className="text-[16px] font-semibold text-ink-2">Describe your ideal customer, then source</div>
            <div className="text-[13px] text-muted-b max-w-[440px]">Every result is scored for fit and comes with the research behind it — you never import a cold, unqualified list.</div>
          </div>
        ) : leads.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-16">
            <Search size={34} className="text-muted-3" />
            <div className="text-[15px] font-semibold text-ink-2">No matches for that search</div>
            <div className="text-[13px] text-muted-b max-w-[420px]">{live ? 'People Data Labs returned no one for those exact filters. Try a broader job title, or clear the location or company size.' : 'Try a broader search.'}</div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="grid grid-cols-4 gap-4 flex-1">
                <Kpi variant="blue" label="Leads found" value={String(leads.length)} delta={live ? 'People Data Labs' : 'Sample data'} deltaTone="muted" />
                <Kpi variant="deep" label="Qualified" value={String(qualified)} delta="Score ≥ 65" />
                <Kpi label="Avg. fit score" value={String(avg)} delta="Out of 100" deltaTone="muted" />
                <Kpi label="With email" value={String(withEmail)} delta="Reachable now" />
              </div>
            </div>

            {!live && (
              <div className="rounded-card bg-warning-wash border border-[#F3D9A6] px-4 py-2.5 text-[12.5px] text-[#8A5A12] flex items-center gap-2">
                <Sparkle size={14} /> Showing sample data. Add <span className="font-mono font-semibold">PEOPLE_DATA_LABS_API_KEY</span> to the backend to source real contacts.
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-[13px] text-muted-b">Ranked by fit. Add individually, or push every qualified lead to the CRM at once.</div>
              <Button variant="primary" icon={<Plus size={16} />} onClick={addAllQualified}>Add {qualified} qualified</Button>
            </div>

            <Table
              template={template}
              columns={[{ key: 'p', header: 'Person' }, { key: 'co', header: 'Company' }, { key: 'sc', header: 'Fit' }, { key: 'sig', header: 'Why / signals' }, { key: 'x', header: '', align: 'right' }]}
              footer={<><span>{leads.length} leads</span><span>{qualified} qualified · {withEmail} with email</span></>}
            >
              {leads.map((l) => (
                <Row key={l.id} template={template}>
                  <Cell>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={l.name} size={30} />
                      <div className="min-w-0">
                        <div className="font-semibold text-ink-2 truncate flex items-center gap-1.5">{l.name}{l.linkedin && <LinkIcon size={12} className="text-muted-3" />}</div>
                        <div className="text-[12px] text-muted-2 truncate">{l.title}</div>
                      </div>
                    </div>
                  </Cell>
                  <Cell>
                    <div className="text-ink-2 font-medium truncate">{l.company}</div>
                    <div className="text-[12px] text-muted-2 truncate">{l.location}{l.email && <span className="inline-flex items-center gap-1 ml-1 text-positive"><Envelope size={11} /> email</span>}</div>
                  </Cell>
                  <Cell><Chip tone={scoreTone(l.score)} dot>{l.score}</Chip></Cell>
                  <Cell><div className="text-[12.5px] text-ink-3 leading-snug line-clamp-2">{l.why}</div></Cell>
                  <Cell align="right">
                    {added.has(l.id)
                      ? <span className="text-[12px] text-positive font-semibold inline-flex items-center gap-1"><Check size={12} /> Added</span>
                      : <button onClick={() => add(l)} className="text-[12px] text-accent font-semibold hover:underline">+ Add</button>}
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

function LabeledInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 px-3 rounded-control border border-input-border bg-white text-[13px] text-ink-2 outline-none focus:border-accent" />
    </label>
  )
}
