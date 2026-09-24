import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Segmented, Kpi, Chip, type ChipTone } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Plus, Users, Megaphone, Sparkle, Send, Envelope, Clock, Phone, Task, Person } from '../components/icons'
import { Modal, Field, Input, Textarea, Select } from '../components/overlays'
import { useActions, useState_ } from '../store/store'
import type { SeqStepType } from '../store/types'
import { classNames } from '../lib/format'

const seqStepIcon: Record<SeqStepType, any> = { email: Envelope, wait: Clock, call: Phone, task: Task, linkedin: Person }
const seqStepColor: Record<SeqStepType, string> = { email: '#13927B', wait: '#7A8494', call: '#0E7C66', task: '#C2410C', linkedin: '#0A66C2' }

type Status = 'Sending' | 'Live' | 'Complete' | 'Draft'
const statusTone: Record<Status, ChipTone> = { Sending: 'accent', Live: 'positive', Complete: 'neutral', Draft: 'warning' }

const DEFAULT_STEPS = [
  { type: 'email' as const, label: 'Intro — personalised', day: 0 },
  { type: 'wait' as const, label: 'Wait 2 days', day: 2 },
  { type: 'linkedin' as const, label: 'Connect on LinkedIn', day: 3 },
  { type: 'email' as const, label: 'Follow-up + case study', day: 5 },
]

export function Campaigns() {
  const act = useActions()
  const { connections, socialPosts, sequences, emailCampaigns: campaigns } = useState_()
  const [view, setView] = useState('All')
  const [post, setPost] = useState(false)
  const [newCamp, setNewCamp] = useState(false)
  const [newSeq, setNewSeq] = useState(false)
  const [audience, setAudience] = useState(false)
  const [stepFor, setStepFor] = useState<string | null>(null)
  const socialChannels = connections.filter((c) => c.kind === 'social' && c.connected)
  const template = '2fr 1fr 1fr 0.9fr 0.9fr 1fr 1fr'
  return (
    <>
      <TopBar
        title="Campaigns"
        center={<Segmented options={['All', 'Email', 'Sequences', 'Social']} value={view} onChange={setView} />}
        actions={
          <>
            <Button icon={<Users size={16} />} onClick={() => setAudience(true)}>Audience</Button>
            <Button icon={<Megaphone size={16} />} onClick={() => setPost(true)}>Schedule post</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setNewCamp(true)}>New campaign</Button>
          </>
        }
      />
      <PageBody>
        {view === 'Sequences' ? (
          <>
            <div className="flex items-center justify-between">
              <div className="text-[13px] text-muted-b">Multi-step, multichannel outreach — email, LinkedIn, calls and tasks with automatic waits.</div>
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => setNewSeq(true)}>New sequence</Button>
            </div>
            {sequences.map((s) => (
              <div key={s.id} className="bg-surface border border-border rounded-card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-ink">{s.name}</div>
                    <div className="text-[12px] text-muted-2">{s.steps.length} steps · {s.enrolled} enrolled · {s.replyRate}% reply rate</div>
                  </div>
                  <button onClick={() => act.toggleSequence(s.id, s.active)} className={classNames('ml-auto w-11 h-6 rounded-full flex items-center px-0.5 transition-colors', s.active ? 'bg-accent justify-end' : 'bg-input-border justify-start')}><span className="w-5 h-5 rounded-full bg-white shadow" /></button>
                  <Chip tone={s.active ? 'positive' : 'neutral'} dot>{s.active ? 'Active' : 'Paused'}</Chip>
                </div>
                <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
                  {s.steps.map((st, i) => {
                    const Icon = seqStepIcon[st.type]
                    return (
                      <div key={st.id} className="flex items-center gap-2 shrink-0">
                        <div className="rounded-lg border border-border bg-surface-tint px-3 py-2 min-w-[150px]">
                          <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-md flex items-center justify-center text-white" style={{ background: seqStepColor[st.type] }}><Icon size={12} /></span><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">Day {st.day}</span></div>
                          <div className="text-[12.5px] text-ink-2 font-medium mt-1 leading-snug">{st.label}</div>
                        </div>
                        {i < s.steps.length - 1 && <div className="w-4 h-px bg-border" />}
                      </div>
                    )
                  })}
                  <button onClick={() => setStepFor(s.id)} className="shrink-0 rounded-lg border border-dashed border-input-border px-3 min-w-[52px] text-muted-2 hover:border-accent hover:text-accent flex items-center justify-center"><Plus size={16} /></button>
                </div>
              </div>
            ))}
          </>
        ) : view === 'Social' ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] text-muted-b mr-1">Connected channels:</span>
              {socialChannels.map((c) => (<span key={c.id} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full text-white" style={{ background: c.color }}>{c.provider}</span>))}
              <button onClick={() => setPost(true)} className="ml-auto"><Button variant="primary" icon={<Plus size={16} />}>Schedule post</Button></button>
            </div>
            <div className="text-[15px] font-semibold text-ink mt-2">Scheduled &amp; posted</div>
            <div className="flex flex-col gap-3">
              {socialPosts.map((p) => (
                <div key={p.id} className="bg-surface border border-border rounded-card p-4 flex items-start gap-3.5">
                  <span className="w-9 h-9 rounded-[10px] bg-accent-wash text-accent flex items-center justify-center shrink-0"><Megaphone size={17} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.channels.map((ch) => (<span key={ch} className="text-[11px] font-semibold text-ink-3 bg-control rounded px-1.5 py-0.5">{ch}</span>))}
                      <Chip tone={p.status === 'posted' ? 'positive' : p.status === 'scheduled' ? 'accent' : 'neutral'} dot>{p.status}</Chip>
                      <span className="ml-auto text-[12px] text-muted-2">{p.when}</span>
                    </div>
                    <div className="text-[13px] text-ink-2 leading-relaxed mt-2">{p.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
        <>
        <div className="grid grid-cols-4 gap-4">
          <Kpi label="Emails sent" value="2,820" delta="Last 30 days" deltaTone="muted" />
          <Kpi variant="blue" label="Avg. open rate" value="54%" delta="+4 pts" />
          <Kpi label="Leads created" value="126" delta="+18 this month" />
          <Kpi variant="deep" label="Pipeline influenced" value="£680K" delta="Across 33 deals" />
        </div>
        <Table
          template={template}
          columns={[
            { key: 'name', header: 'Campaign' },
            { key: 'type', header: 'Type' },
            { key: 'sent', header: 'Sent', align: 'right' },
            { key: 'opens', header: 'Opens', align: 'right' },
            { key: 'clicks', header: 'Clicks', align: 'right' },
            { key: 'deals', header: 'Deals created', align: 'right' },
            { key: 'status', header: 'Status' },
          ]}
          footer={<><span>{campaigns.length} campaigns</span><span>Updated live</span></>}
        >
          {campaigns.map((c) => (
            <Row key={c.name} template={template}>
              <Cell className="font-semibold text-ink-2">{c.name}</Cell>
              <Cell muted>{c.type}</Cell>
              <Cell align="right" className="text-ink-2">{c.sent.toLocaleString()}</Cell>
              <Cell align="right" muted>{c.opens ? `${c.opens}%` : '—'}</Cell>
              <Cell align="right" muted>{c.clicks ? `${c.clicks}%` : '—'}</Cell>
              <Cell align="right" className="font-semibold text-ink-2">{c.deals}</Cell>
              <Cell><Chip tone={statusTone[c.status]} dot>{c.status}</Chip></Cell>
            </Row>
          ))}
        </Table>
        </>
        )}
      </PageBody>
      <SocialComposer open={post} onClose={() => setPost(false)} channels={socialChannels.map((c) => c.provider)} onSchedule={(ch, body, when) => { act.schedulePost(ch, body, when); setView('Social'); setPost(false) }} />
      <NewCampaignModal open={newCamp} onClose={() => setNewCamp(false)} onCreate={(name, type) => { act.addEmailCampaign(name, type); setView('All'); setNewCamp(false) }} />
      <NewSequenceModal open={newSeq} onClose={() => setNewSeq(false)} onCreate={(name) => { act.addSequence(name, DEFAULT_STEPS.map((s, i) => ({ id: `st${Date.now()}${i}`, ...s }))); setView('Sequences'); setNewSeq(false) }} />
      <AddStepModal open={!!stepFor} onClose={() => setStepFor(null)} onAdd={(type, label, day) => { if (stepFor) act.addSequenceStep(stepFor, type, label, day); setStepFor(null) }} />
      <AudienceModal open={audience} onClose={() => setAudience(false)} />
    </>
  )
}

function NewCampaignModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string, type: string) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('Email')
  return (
    <Modal open={open} onClose={onClose} title="New campaign" subtitle="Create a campaign as a draft"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { if (name.trim()) { onCreate(name.trim(), type); setName('') } }}>Create campaign</Button></>}>
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q4 Solar outreach" autoFocus /></Field>
      <Field label="Type">
        <div className="flex gap-2">{['Email', 'Sequence', 'Form', 'Social'].map((t) => <button key={t} onClick={() => setType(t)} className={classNames('h-9 px-3.5 rounded-lg text-[13px] font-semibold border', type === t ? 'bg-accent text-white border-accent' : 'border-border text-muted-b')}>{t}</button>)}</div>
      </Field>
    </Modal>
  )
}
function NewSequenceModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="New sequence" subtitle="Starts with a proven 4-step email + LinkedIn cadence you can edit"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { if (name.trim()) { onCreate(name.trim()); setName('') } }}>Create sequence</Button></>}>
      <Field label="Sequence name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Renewables — cold outreach" autoFocus /></Field>
      <div className="text-[12.5px] text-muted-2">Seeded with: intro email → wait → LinkedIn connect → follow-up. Add or reorder steps after creating.</div>
    </Modal>
  )
}
function AddStepModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (type: SeqStepType, label: string, day: number) => void }) {
  const [type, setType] = useState<SeqStepType>('email')
  const [label, setLabel] = useState('')
  const [day, setDay] = useState('7')
  return (
    <Modal open={open} onClose={onClose} title="Add step" subtitle="Append a step to this sequence"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { if (label.trim()) { onAdd(type, label.trim(), Number(day) || 0); setLabel('') } }}>Add step</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value as SeqStepType)}><option value="email">Email</option><option value="linkedin">LinkedIn</option><option value="call">Call</option><option value="task">Task</option><option value="wait">Wait</option></Select></Field>
        <Field label="Day"><Input type="number" value={day} onChange={(e) => setDay(e.target.value)} /></Field>
      </div>
      <Field label="Label"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Follow-up + case study" autoFocus /></Field>
    </Modal>
  )
}
function AudienceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { people, leads } = useState_()
  return (
    <Modal open={open} onClose={onClose} title="Build an audience" subtitle="Segment your contacts for a campaign"
      footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className="text-[13px] text-ink-2">You have <b>{people.length}</b> contacts and <b>{leads.length}</b> leads to segment.</div>
      <div className="text-[12.5px] text-muted-2 mt-2">Full filter-based audience segments (save &amp; reuse) build on the same saved-views work as Lists — coming with the data-model phase.</div>
    </Modal>
  )
}

function SocialComposer({ open, onClose, channels, onSchedule }: { open: boolean; onClose: () => void; channels: string[]; onSchedule: (channels: string[], body: string, when: string) => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set(channels))
  const [body, setBody] = useState('')
  const [when, setWhen] = useState('Tomorrow · 09:00')
  return (
    <Modal open={open} onClose={onClose} title="Schedule social post" subtitle="Publishes to every selected network through one unified API" width={560}
      footer={<><Button icon={<Sparkle size={15} />} onClick={() => setBody('Excited to share how we’re helping energy teams close faster with AI-native CRM. Read the story 👇')}>Draft with AI</Button><Button variant="primary" icon={<Send size={15} />} onClick={() => body.trim() && sel.size > 0 && onSchedule([...sel], body, when)}>Schedule</Button></>}>
      <Field label="Channels">
        <div className="flex flex-wrap gap-2">
          {channels.map((ch) => {
            const on = sel.has(ch)
            return <button key={ch} onClick={() => setSel((s) => { const n = new Set(s); n.has(ch) ? n.delete(ch) : n.add(ch); return n })} className={classNames('h-8 px-3 rounded-lg text-[12.5px] font-semibold border', on ? 'bg-accent text-white border-accent' : 'border-border text-muted-b')}>{ch}</button>
          })}
        </div>
      </Field>
      <Field label="Post"><Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What’s happening?" autoFocus /></Field>
      <Field label="When"><Input value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
    </Modal>
  )
}
