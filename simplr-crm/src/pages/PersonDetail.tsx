import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Avatar, Chip } from '../components/ui'
import { Modal, Field, Select } from '../components/overlays'
import { Note, Phone, Envelope, Plus, ChevronDown, Meeting, Task, Sparkle } from '../components/icons'
import { useSelectors, useActions, useState_ } from '../store/store'
import { RecordSummary, CompletenessMeter } from '../components/ai-widgets'
import { CustomFieldRows } from '../components/CustomFields'
import { personSummary, personCompleteness } from '../lib/intelligence'
import type { Activity } from '../store/types'
import { money, classNames } from '../lib/format'

const composerTabs = ['Note', 'Email', 'Call', 'Meeting', 'Task'] as const
const typeIcon: Record<string, any> = { call: Phone, meeting: Meeting, task: Task, email: Envelope, note: Note, change: Task }

export function PersonDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const sel = useSelectors()
  const act = useActions()
  const { deals, people, customFields } = useState_()
  const p = sel.personById(id)
  const [tab, setTab] = useState<(typeof composerTabs)[number]>('Note')
  const [draft, setDraft] = useState('')
  const [hist, setHist] = useState('All')
  const [delOpen, setDelOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeTarget, setMergeTarget] = useState('')

  if (!p) {
    return (<><TopBar title="People" /><PageBody><div className="text-muted-b">Contact not found. <button onClick={() => nav('/people')} className="text-accent font-semibold">Back to people</button>.</div></PageBody></>)
  }

  const activities = sel.personActivities(p.id)
  const personDeals = deals.filter((d) => d.personIds.includes(p.id))
  const filtered = activities.filter((a) => {
    if (hist === 'All') return true
    if (hist === 'Notes') return a.type === 'note'
    if (hist === 'Emails') return a.type === 'email'
    if (hist === 'Activities') return a.type === 'call' || a.type === 'meeting' || a.type === 'task'
    return true
  })

  function save() {
    if (!draft.trim()) return
    const map: Record<string, Activity['type']> = { Note: 'note', Email: 'email', Call: 'call', Meeting: 'meeting', Task: 'task' }
    act.logActivity({ type: map[tab], subject: draft.slice(0, 80), body: draft, personId: p!.id, dealId: personDeals[0]?.id, done: tab !== 'Task' && tab !== 'Meeting' }, `${tab} logged for ${p!.name}`)
    setDraft('')
  }

  return (
    <>
      <TopBar
        title="People"
        crumbs={[p.org, p.name]}
        actions={
          <>
            <div className="flex items-center gap-2 pr-1 mr-1 border-r border-border">
              <Avatar name={p.owner} size={26} variant="neutral" />
              <div className="text-[12px] leading-tight"><div className="font-semibold text-ink-2">{p.owner}</div><div className="text-muted-2">Owner</div></div>
            </div>
            <Button icon={<Phone size={16} />} onClick={() => act.logActivity({ type: 'call', subject: `Call with ${p.name}`, personId: p.id, dealId: personDeals[0]?.id, done: true }, 'Call logged')}>Call</Button>
            <Button onClick={() => { setMergeTarget(''); setMergeOpen(true) }}>Merge</Button>
            <Button onClick={() => setDelOpen(true)}>Delete</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => nav('/deals')}>Deal</Button>
          </>
        }
      />
      <PageBody>
        <button onClick={() => nav('/people')} className="text-[13px] text-accent font-semibold self-start">← All people</button>
        <div className="grid gap-4" style={{ gridTemplateColumns: '320px 1fr 300px' }}>
          {/* left */}
          <div className="flex flex-col gap-4">
            <div className="bg-surface border border-border rounded-card p-5 flex flex-col items-center text-center">
              <Avatar name={p.name} size={56} />
              <div className="text-[16px] font-bold text-ink mt-3">{p.name}</div>
              <div className="text-[13px] text-muted-b">{p.role || 'Contact'}</div>
              <div className="text-[13px] text-accent font-semibold mt-0.5">{p.org}</div>
              <div className="mt-3 pt-3 border-t border-divider w-full flex items-center justify-center gap-2 text-[11px] text-muted-2">Profile <CompletenessMeter {...personCompleteness(p, customFields)} /></div>
            </div>
            <Panel title="Contact">
              <FieldRow label="Email" value={p.email || '—'} />
              <FieldRow label="Phone" value={p.phone || '—'} />
              <FieldRow label="Owner" value={p.owner} />
              <CustomFieldRows entity="person" id={p.id} values={p.custom} />
            </Panel>
            <Panel title={`Open deals · ${personDeals.length}`}>
              {personDeals.length === 0 && <div className="text-[12px] text-muted-2">No linked deals.</div>}
              {personDeals.map((d) => (
                <button key={d.id} onClick={() => nav(`/deals/${d.id}`)} className="flex items-center justify-between w-full text-left">
                  <span className="text-[13px] text-ink-2 truncate pr-2">{d.name}</span>
                  <span className="text-[13px] font-semibold text-ink-2">{money(d.value, { compact: true })}</span>
                </button>
              ))}
            </Panel>
            <Panel title="Labels">
              <div className="flex flex-wrap gap-1.5">
                {p.labels.length === 0 && <span className="text-[12px] text-muted-2">No labels</span>}
                {p.labels.map((l) => (<Chip key={l} tone="accent">{l}</Chip>))}
              </div>
            </Panel>
          </div>

          {/* center */}
          <div className="flex flex-col gap-4">
            <RecordSummary summary={personSummary(p, sel.personActivities(p.id), personDeals.length)} ask={`What's the latest with ${p.name} at ${p.org}?`} />
            <div className="bg-surface border border-border rounded-card p-4">
              <div className="flex gap-4 border-b border-divider -mx-4 px-4 pb-2.5 mb-3 overflow-x-auto">
                {composerTabs.map((t) => (<button key={t} onClick={() => setTab(t)} className={classNames('text-[13px] pb-1.5 -mb-[11px] border-b-2', tab === t ? 'border-accent text-ink font-semibold' : 'border-transparent text-muted-b')}>{t}</button>))}
              </div>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Write a ${tab.toLowerCase()}…`} className="w-full h-14 resize-none outline-none text-[13px] text-ink-2 placeholder:text-muted-3 bg-transparent" />
              <div className="flex justify-end"><Button variant="primary" onClick={save}>Save {tab.toLowerCase()}</Button></div>
            </div>

            <div className="bg-surface border border-border rounded-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[15px] font-semibold text-ink">History</div>
                <div className="flex items-center gap-1 text-[12px] text-muted-2"><ChevronDown size={14} /> Newest first</div>
              </div>
              <div className="flex items-center gap-1 flex-wrap border-b border-divider -mx-5 px-5 pb-2.5 mb-4">
                {['All', 'Activities', 'Notes', 'Emails'].map((t) => (<button key={t} onClick={() => setHist(t)} className={classNames('h-7 px-2.5 rounded-lg text-[12px] font-medium', hist === t ? 'bg-accent-wash text-accent' : 'text-muted-b hover:bg-control')}>{t}</button>))}
              </div>
              {filtered.length === 0 && <div className="text-[13px] text-muted-2">Nothing logged yet.</div>}
              <div className="relative flex flex-col gap-5">
                {filtered.length > 0 && <div className="absolute left-[14px] top-2 bottom-2 w-0.5 bg-divider" />}
                {filtered.map((a) => {
                  const Icon = typeIcon[a.type] ?? Note
                  const ai = a.source === 'meeting' || a.source === 'ai'
                  return (
                    <div key={a.id} className="flex gap-3.5 relative">
                      <div className={classNames('w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-white', ai ? 'bg-accent-gradient text-white' : 'bg-accent-wash text-accent')}>{ai ? <Sparkle size={13} /> : <Icon size={14} />}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><div className="text-[13px] font-semibold text-ink-2">{a.subject}</div><div className="text-[11px] text-muted-3 ml-auto">{rel(a.createdAt)}</div></div>
                        {a.body && <div className="text-[13px] text-muted leading-relaxed mt-0.5">{a.body}</div>}
                        <div className="text-[12px] text-muted-3 mt-1">{a.who}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* right */}
          <div className="flex flex-col gap-4">
            <Panel title="Also at this account">
              {people.filter((x) => x.org === p.org && x.id !== p.id).slice(0, 4).map((x) => (
                <button key={x.id} onClick={() => nav(`/people/${x.id}`)} className="flex items-center gap-2.5 text-left w-full"><Avatar name={x.name} size={30} /><div><div className="text-[13px] font-semibold text-ink-2">{x.name}</div><div className="text-[12px] text-muted-2">{x.role}</div></div></button>
              ))}
              {people.filter((x) => x.org === p.org && x.id !== p.id).length === 0 && <div className="text-[12px] text-muted-2">No other contacts.</div>}
            </Panel>
          </div>
        </div>
      </PageBody>

      <Modal
        open={delOpen}
        onClose={() => setDelOpen(false)}
        title="Delete this contact?"
        subtitle={p.name}
        footer={<><Button onClick={() => setDelOpen(false)}>Cancel</Button><Button variant="primary" color="#B01B4F" onClick={() => { act.removePerson(p.id, p.name); nav('/people') }}>Delete contact</Button></>}
      >
        <div className="text-[13px] text-muted-b leading-relaxed">This removes <span className="font-semibold text-ink-2">{p.name}</span> and unlinks them from {personDeals.length} {personDeals.length === 1 ? 'deal' : 'deals'}. Those deals stay. If this is a duplicate, use <span className="font-medium">Merge</span> instead to keep the history.</div>
      </Modal>

      <Modal
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        title="Merge a duplicate into this contact"
        subtitle={`Keep ${p.name} — fold another record's deals & history in`}
        footer={<><Button onClick={() => setMergeOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => { const t = people.find((x) => x.id === mergeTarget); if (!t) return; act.mergePeople(p.id, t.id, t.name); setMergeOpen(false) }}>Merge in</Button></>}
      >
        <Field label="Duplicate to merge in (it will be removed)">
          <Select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}>
            <option value="">Select a contact…</option>
            {people.filter((x) => x.id !== p.id).map((x) => (<option key={x.id} value={x.id}>{x.name}{x.org ? ` · ${x.org}` : ''}</option>))}
          </Select>
        </Field>
        <div className="text-[12px] text-muted-2 leading-relaxed">The selected contact's deals, notes and emails move onto <span className="font-medium text-ink-2">{p.name}</span>, then the duplicate is deleted. {p.name}'s own details win where both have a value.</div>
      </Modal>
    </>
  )
}

function rel(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div className="bg-surface border border-border rounded-card p-4"><div className="text-[13px] font-semibold text-ink mb-3">{title}</div><div className="flex flex-col gap-2.5">{children}</div></div>)
}
function FieldRow({ label, value }: { label: string; value: string }) {
  return (<div className="flex items-center justify-between gap-3"><span className="text-[12px] text-muted-2 shrink-0">{label}</span><span className="text-[13px] font-medium text-ink-2 truncate">{value}</span></div>)
}
