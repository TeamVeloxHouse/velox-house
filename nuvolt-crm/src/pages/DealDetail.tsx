import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Chip } from '../components/ui'
import { Modal, Field, Input, Select } from '../components/overlays'
import { Note, Envelope, Phone, Meeting, Task, File, Check, Sparkle } from '../components/icons'
import { NextBestAction, RecordSummary, ScorePill, ConversationIntel } from '../components/ai-widgets'
import { CustomFieldRows } from '../components/CustomFields'
import { dealScore, nextBestAction, dealSummary, dealCoaching } from '../lib/intelligence'
import { stages, type StageName } from '../data/mock'
import { useSelectors, useActions, useState_ } from '../store/store'
import type { Activity } from '../store/types'
import { money, classNames, initials } from '../lib/format'
import { Avatar } from '../components/ui'

const composerTabs = ['Note', 'Email', 'Call', 'Meeting', 'Task', 'File'] as const
const typeIcon: Record<string, any> = { call: Phone, meeting: Meeting, task: Task, email: Envelope, note: Note, change: Task, file: File }

export function DealDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const sel = useSelectors()
  const act = useActions()
  const { activities: allActivities, people: allPeople, meetings: allMeetings } = useState_()
  const deal = sel.dealById(id)
  const [tab, setTab] = useState<(typeof composerTabs)[number]>('Note')
  const [draft, setDraft] = useState('')
  const [lostOpen, setLostOpen] = useState(false)
  const [lostReason, setLostReason] = useState('Price')

  if (!deal) {
    return (
      <>
        <TopBar title="Deals" />
        <PageBody><div className="text-muted-b">Deal not found. <button onClick={() => nav('/deals')} className="text-accent font-semibold">Back to pipeline</button>.</div></PageBody>
      </>
    )
  }

  const currentStageIdx = stages.indexOf(deal.stage)
  const timeline = sel.dealActivities(deal.id)
  const openTasks = sel.openTasks(deal.id)
  const contacts = sel.peopleForDeal(deal)
  const score = dealScore(deal, allActivities)
  const nba = nextBestAction(deal, allActivities)
  const dealMeetings = allMeetings.filter((m) => m.dealId === deal.id && m.status === 'recorded')

  function save() {
    if (!draft.trim() && tab !== 'File') return
    const map: Record<string, Activity['type']> = { Note: 'note', Email: 'email', Call: 'call', Meeting: 'meeting', Task: 'task', File: 'file' }
    act.logActivity(
      { type: map[tab], subject: draft.slice(0, 80) || `${tab} logged`, body: draft, dealId: deal!.id, personId: contacts[0]?.id, done: tab === 'Note' || tab === 'Call' || tab === 'Email' },
      `${tab} added to ${deal!.org}`,
    )
    setDraft('')
  }

  return (
    <>
      <TopBar
        title="Deals"
        crumbs={[deal.org, deal.name]}
        actions={
          <>
            <Button icon={<Note size={16} />} onClick={() => { setTab('Note'); document.getElementById('composer')?.focus() }}>Log activity</Button>
            <Button onClick={() => setLostOpen(true)}>Mark lost</Button>
            <Button variant="primary" color="#0E7C66" icon={<Check size={16} />} onClick={() => act.markWon(deal.id, deal.name)}>Mark won</Button>
          </>
        }
      />
      <PageBody>
        <div className="flex items-center gap-3">
          <button onClick={() => nav('/deals')} className="text-[13px] text-accent font-semibold">← Pipeline</button>
          <div className="text-[20px] font-bold text-ink">{deal.name}</div>
          <Chip tone="accent">{money(deal.value)}</Chip>
          {deal.won && <Chip tone="positive" dot>Won</Chip>}
          {deal.lost && <Chip tone="warning" dot>Lost · {deal.lostReason}</Chip>}
        </div>

        {/* stage bar — click to advance */}
        <div className="flex gap-0 rounded-lg overflow-hidden border border-border">
          {stages.map((s, i) => {
            const past = i < currentStageIdx
            const current = i === currentStageIdx
            const scale = ['#C7D3F2', '#8FB0FF', '#5B85F0', '#3A67E4', '#1D4ED8']
            return (
              <button
                key={s}
                onClick={() => act.moveStage(deal.id, s as StageName)}
                title={`Move to ${s}`}
                className={classNames('py-2.5 px-3.5 text-[12px] font-semibold flex flex-col gap-0.5 text-left transition-opacity hover:opacity-90', current ? 'flex-[1.2]' : 'flex-1')}
                style={{ background: current ? '#0B1220' : past ? scale[i] : '#EEF0F4', color: current ? '#fff' : past ? '#fff' : '#8A94A4' }}
              >
                <span>{s}</span>
                <span className="text-[11px] font-medium opacity-80">{past ? 'done' : current ? 'active' : 'upcoming'}</span>
              </button>
            )
          })}
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: '300px 1fr 320px' }}>
          {/* left */}
          <div className="flex flex-col gap-4">
            <Panel title="Details">
              <FieldRow label="Owner" value={deal.owner} />
              <FieldRow label="Value" value={money(deal.value)} />
              <FieldRow label="Expected close" value={deal.closeDate} />
              <FieldRow label="Probability" value={`${deal.probability}%`} />
              <FieldRow label="Stage" value={deal.stage} />
              <CustomFieldRows entity="deal" id={deal.id} values={deal.custom} />
            </Panel>
            <Panel title="Organisation">
              <button onClick={() => deal.orgId && nav('/organisations')} className="flex items-center gap-2.5 text-left w-full">
                <Avatar name={deal.org} size={34} square />
                <div>
                  <div className="text-[13px] font-semibold text-ink-2">{deal.org}</div>
                  <div className="text-[12px] text-muted-2">{deal.subtitle || 'Account'}</div>
                </div>
              </button>
            </Panel>
            <Panel title={`Contacts · ${contacts.length}`}>
              {contacts.length === 0 && <div className="text-[12px] text-muted-2">No contacts linked yet.</div>}
              {contacts.map((c, i) => (
                <button key={c.id} onClick={() => nav(`/people/${c.id}`)} className="flex items-center gap-2.5 text-left w-full">
                  <Avatar name={c.name} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-ink-2 truncate">{c.name}</div>
                    <div className="text-[12px] text-muted-2">{c.role}</div>
                  </div>
                  {i === 0 && <Chip tone="positive">Champion</Chip>}
                </button>
              ))}
            </Panel>
          </div>

          {/* center */}
          <div className="flex flex-col gap-4">
            <div className="bg-surface border border-border rounded-card p-4">
              <div className="flex gap-4 border-b border-divider -mx-4 px-4 pb-2.5 mb-3 overflow-x-auto">
                {composerTabs.map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={classNames('text-[13px] pb-1.5 -mb-[11px] border-b-2 transition-colors whitespace-nowrap', tab === t ? 'border-accent text-ink font-semibold' : 'border-transparent text-muted-b hover:text-ink-3')}>{t}</button>
                ))}
              </div>
              <textarea id="composer" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Add a ${tab.toLowerCase()}…`} className="w-full h-[68px] resize-none outline-none text-[13px] text-ink-2 placeholder:text-muted-3 bg-transparent" />
              <div className="flex justify-end"><Button variant="primary" onClick={save}>Save {tab.toLowerCase()}</Button></div>
            </div>

            <div className="bg-surface border border-border rounded-card p-5">
              <div className="text-[15px] font-semibold text-ink mb-4">Timeline</div>
              {timeline.length === 0 && <div className="text-[13px] text-muted-2">No activity yet — log a note or call above.</div>}
              <div className="relative flex flex-col gap-5">
                {timeline.length > 0 && <div className="absolute left-[14px] top-2 bottom-2 w-0.5 bg-divider" />}
                {timeline.map((t) => {
                  const Icon = typeIcon[t.type] ?? Note
                  return (
                    <div key={t.id} className="flex gap-3.5 relative">
                      <div className={classNames('w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-white', t.source === 'meeting' || t.source === 'ai' ? 'bg-accent-gradient text-white' : 'bg-accent-wash text-accent')}>
                        {t.source === 'ai' || t.source === 'meeting' ? <Sparkle size={13} /> : <Icon size={14} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-[13px] font-semibold text-ink-2">{t.subject}</div>
                          <div className="text-[11px] text-muted-3 ml-auto">{rel(t.createdAt)}</div>
                        </div>
                        {t.body && <div className="text-[13px] text-muted leading-relaxed mt-0.5">{t.body}</div>}
                        <div className="text-[12px] text-muted-3 mt-1">{t.who}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* right */}
          <div className="flex flex-col gap-4">
            <RecordSummary summary={dealSummary(deal, allActivities, allPeople)} ask={`Summarise the ${deal.org} deal and what's blocking it`} />
            <NextBestAction action={nba} dealId={deal.id} personId={contacts[0]?.id} />
            {dealMeetings.length > 0 && <ConversationIntel coaching={dealCoaching(deal, dealMeetings.length, score.score)} onOpenMeetings={() => nav('/meetings')} />}
            <Panel title={`Open activities · ${openTasks.length}`}>
              {openTasks.length === 0 && <div className="text-[12px] text-muted-2">Nothing open. Nice.</div>}
              {openTasks.map((t) => (
                <button key={t.id} onClick={() => act.toggleActivity(t.id)} className="flex items-start gap-2.5 text-left w-full">
                  <span className="mt-0.5 w-[18px] h-[18px] rounded-[5px] border border-input-border shrink-0" />
                  <div>
                    <div className="text-[13px] text-ink-2 font-medium">{t.subject}</div>
                    <div className="text-[12px] text-muted-2">{t.due ?? 'No due date'}</div>
                  </div>
                </button>
              ))}
            </Panel>
            <div className="rounded-card bg-deep-panel p-4">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-medium" style={{ color: '#93A0B4' }}>AI win score</div>
                <ScorePill score={score} />
              </div>
              <div className="text-[22px] font-bold text-white mt-1.5">{score.score}% · {score.band}</div>
              <div className="text-[12px] mt-1" style={{ color: '#8FB0FF' }}>{deal.health} · {deal.stage}</div>
            </div>
          </div>
        </div>
      </PageBody>

      <Modal
        open={lostOpen}
        onClose={() => setLostOpen(false)}
        title="Mark deal as lost"
        subtitle={deal.name}
        footer={<><Button onClick={() => setLostOpen(false)}>Cancel</Button><Button variant="primary" color="#B01B4F" onClick={() => { act.markLost(deal.id, deal.name, lostReason); setLostOpen(false) }}>Mark lost</Button></>}
      >
        <Field label="Reason">
          <Select value={lostReason} onChange={(e) => setLostReason(e.target.value)}>
            {['Price', 'Timing / budget frozen', 'Lost to competitor', 'No decision', 'Other'].map((r) => (<option key={r}>{r}</option>))}
          </Select>
        </Field>
      </Modal>
    </>
  )
}

function rel(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-card p-4">
      <div className="text-[13px] font-semibold text-ink mb-3">{title}</div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  )
}
function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-muted-2">{label}</span>
      <span className="text-[13px] font-medium text-ink-2">{value}</span>
    </div>
  )
}
void initials
