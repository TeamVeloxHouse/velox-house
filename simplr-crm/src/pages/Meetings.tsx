import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button, Avatar, Chip } from '../components/ui'
import { Plus, Video, Robot, Sparkle, Check, Waveform, Play, Note, Task, Envelope, Link as LinkIcon, Mic } from '../components/icons'
import { Modal, Field, Input, Select } from '../components/overlays'
import { useState_, useActions } from '../store/store'
import type { Meeting } from '../store/types'
import { classNames } from '../lib/format'

const platformColor: Record<string, string> = { Teams: '#5059C9', 'Google Meet': '#00897B', Zoom: '#2D8CFF' }

const transcript = [
  { who: 'Callum Reed', t: '00:42', text: 'Thanks for jumping on. The phased rollout works for us — the main thing is the liability caps.' },
  { who: 'Jordan Miles', t: '01:10', text: 'Understood. Our standard is a 12-month fees cap. I can bring legal in to walk through it.' },
  { who: 'Marta Lund', t: '02:28', text: 'From finance, if we can get that in writing this week, I can sign off the budget by month end.' },
  { who: 'Callum Reed', t: '03:05', text: 'Let’s also confirm the maintenance retainer covers the standby units.' },
  { who: 'Jordan Miles', t: '03:31', text: 'Yes — I’ll split that out on the quote so it’s explicit.' },
]
const aiNotes = [
  'Deal gated on liability-cap wording; finance (Marta Lund) signs off budget by month-end if resolved in writing this week.',
  'Champion Callum Reed confirmed phased rollout is acceptable.',
  'Client wants the maintenance retainer to explicitly cover standby units.',
]
const aiActions = [
  { label: 'Send liability-cap wording to Marta Lund', icon: Envelope },
  { label: 'Split maintenance retainer on the quote', icon: Task },
  { label: 'Book legal walkthrough call', icon: Video },
]

export function Meetings() {
  const nav = useNavigate()
  const { meetings, connections } = useState_()
  const act = useActions()
  const [sel, setSel] = useState('mtg1')
  const [schedOpen, setSchedOpen] = useState(false)
  const active = meetings.find((m) => m.id === sel) ?? meetings[0]
  const meetingConns = connections.filter((c) => c.kind === 'meeting')

  return (
    <>
      <TopBar
        title="Meetings"
        crumbs={['AI notetaker']}
        actions={<><Button icon={<LinkIcon size={16} />} onClick={() => act.toast('Manage connections in Settings', 'accent')}>Connections</Button><button onClick={() => nav('/meetings/live')} className="h-9 inline-flex items-center gap-2 px-3.5 rounded-control bg-[#B01B4F] text-white text-[13px] font-semibold shadow-primary hover:brightness-95 active:translate-y-px transition"><Mic size={16} /> Record live meeting</button><Button variant="primary" icon={<Plus size={16} />} onClick={() => setSchedOpen(true)}>Schedule</Button></>}
      />
      <ScheduleMeetingModal open={schedOpen} onClose={() => setSchedOpen(false)} onScheduled={(id) => setSel(id)} />
      <div className="flex-1 flex min-h-0">
        <div className="w-[360px] shrink-0 bg-surface border-r border-border overflow-y-auto">
          <div className="p-3.5 border-b border-border flex items-center gap-2">
            {meetingConns.map((c) => (
              <button key={c.id} onClick={() => act.toggleConnection(c.id, c.provider, c.connected)} className={classNames('flex-1 rounded-lg border px-2 py-1.5 text-center transition-colors', c.connected ? 'border-border-blue bg-accent-wash-4' : 'border-dashed border-input-border hover:bg-control')}>
                <div className="text-[11px] font-semibold" style={{ color: c.connected ? platformColor[c.provider] : '#8A94A4' }}>{c.provider}</div>
                <div className="text-[10px] text-muted-2 mt-0.5 flex items-center justify-center gap-1">{c.connected ? <><Check size={10} className="text-positive" /> Linked</> : 'Connect'}</div>
              </button>
            ))}
          </div>
          {meetings.map((m) => (
            <button key={m.id} onClick={() => setSel(m.id)} className={classNames('w-full text-left px-4 py-3.5 border-b border-divider flex flex-col gap-1.5', m.id === sel ? 'bg-accent-wash-4' : 'hover:bg-[#F7F9FC]')}>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md flex items-center justify-center text-white shrink-0" style={{ background: platformColor[m.platform] }}><Video size={13} /></span>
                <span className="text-[13px] font-semibold text-ink-2 truncate flex-1">{m.title}</span>
                {m.status === 'live' && <Chip tone="negative" dot>Live</Chip>}
                {m.status === 'recorded' && <Play size={14} className="text-muted-2" />}
              </div>
              <div className="flex items-center gap-2 text-[12px] text-muted-2"><span>{m.when}</span><span>·</span><span>{m.dealOrg}</span></div>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1.5">{m.attendees.slice(0, 3).map((a) => (<span key={a} className="ring-2 ring-white rounded-full"><Avatar name={a} size={20} /></span>))}</div>
                {m.bot && <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-accent"><Robot size={13} /> Notetaker on</span>}
              </div>
            </button>
          ))}
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="px-7 py-5 border-b border-border flex items-start gap-3.5">
            <span className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: platformColor[active.platform] }}><Video size={22} /></span>
            <div className="flex-1 min-w-0"><div className="text-[17px] font-bold text-ink">{active.title}</div><div className="text-[13px] text-muted-b mt-0.5">{active.platform} · {active.when} · {active.dealOrg}</div></div>
            {active.status === 'live' ? (
              <Button variant="primary" color="#B01B4F" icon={<Waveform size={16} />} onClick={() => act.toast('Joined the call — recording', 'accent')}>Join · rec {active.duration}</Button>
            ) : active.status === 'upcoming' ? (
              <Button variant="primary" icon={<Video size={16} />} onClick={() => act.toast('Opens the meeting link once a calendar account is connected', 'accent')}>Join</Button>
            ) : (
              <Button icon={<Play size={16} />} onClick={() => act.toast('Recording playback connects with the notetaker backend', 'accent')}>Play recording</Button>
            )}
          </div>

          <div className="px-7 py-4 border-b border-border bg-[#FBFCFF] flex items-center gap-3">
            <span className="w-9 h-9 rounded-[10px] bg-accent-gradient text-white flex items-center justify-center shadow-primary shrink-0"><Robot size={18} /></span>
            <div className="flex-1"><div className="text-[13.5px] font-semibold text-ink-2">TellOvi Notetaker</div><div className="text-[12px] text-muted-2">Joins the call, transcribes live, and writes notes + action items to {active.dealOrg}’s card.</div></div>
            <button onClick={() => act.toggleMeetingBot(active.id, active.bot)} className={classNames('w-11 h-6 rounded-full flex items-center px-0.5 transition-colors', active.bot ? 'bg-accent justify-end' : 'bg-input-border justify-start')}><span className="w-5 h-5 rounded-full bg-white shadow" /></button>
          </div>

          {active.status === 'upcoming' ? (
            <div className="p-7 flex flex-col gap-4">
              <div className="rounded-card bg-accent-wash-3 border border-[#D3E0FA] p-4">
                <div className="flex items-center gap-2 text-accent-700 font-semibold text-[13px]"><Sparkle size={15} /> AI pre-brief ready</div>
                <div className="text-[13px] text-ink-3 mt-2 leading-relaxed">You’re meeting <strong>{active.attendees[0]}</strong> about the {active.dealOrg} deal. Last touch was recent. I’ve prepped 3 talking points and a recap of their objections.</div>
                <div className="flex gap-2 mt-3"><Button variant="primary" onClick={() => act.toast('Pre-brief opened', 'accent')}>Open pre-brief</Button><Button onClick={() => active.personId && nav(`/people/${active.personId}`)}>View contact card</Button></div>
              </div>
              <div className="bg-surface border border-border rounded-card p-5">
                <div className="text-[14px] font-semibold text-ink mb-3">Attendees</div>
                <div className="flex flex-col gap-2.5">{active.attendees.map((a) => (<div key={a} className="flex items-center gap-2.5"><Avatar name={a} size={30} /><span className="text-[13px] font-medium text-ink-2">{a}</span></div>))}</div>
              </div>
            </div>
          ) : (
            <div className="p-7 grid gap-4" style={{ gridTemplateColumns: '1fr 340px' }}>
              <div className="bg-surface border border-border rounded-card p-5">
                <div className="flex items-center justify-between mb-4"><div className="text-[14px] font-semibold text-ink flex items-center gap-2"><Waveform size={16} className="text-accent" /> {active.status === 'live' ? 'Live transcript' : 'Transcript'}</div>{active.status === 'live' && <Chip tone="negative" dot>Recording {active.duration}</Chip>}</div>
                <div className="flex flex-col gap-4">
                  {transcript.map((line, i) => (
                    <div key={i} className="flex gap-3"><Avatar name={line.who} size={28} variant={line.who === 'Jordan Miles' ? 'accent' : 'neutral'} /><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-[13px] font-semibold text-ink-2">{line.who}</span><span className="text-[11px] text-muted-3">{line.t}</span></div><div className="text-[13px] text-ink-3 leading-relaxed mt-0.5">{line.text}</div></div></div>
                  ))}
                  {active.status === 'live' && <div className="flex items-center gap-2 text-[12px] text-muted-2"><Waveform size={14} className="text-accent animate-pulse" /> transcribing…</div>}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="rounded-card bg-deep-panel p-4">
                  <div className="flex items-center gap-2 text-white font-semibold text-[13px]"><Sparkle size={15} style={{ color: '#57C9B4' }} /> AI summary</div>
                  <div className="flex flex-col gap-2.5 mt-3">{aiNotes.map((n, i) => (<div key={i} className="text-[12.5px] leading-relaxed" style={{ color: '#A7E6DA' }}>• {n}</div>))}</div>
                </div>
                <div className="bg-surface border border-border rounded-card p-4">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-ink mb-3"><Note size={15} className="text-accent" /> Action items</div>
                  <div className="flex flex-col gap-2.5">
                    {aiActions.map((a, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="w-6 h-6 rounded-md bg-accent-wash text-accent flex items-center justify-center shrink-0"><a.icon size={13} /></span>
                        <div className="min-w-0"><div className="text-[13px] text-ink-2 font-medium leading-snug">{a.label}</div>{active.processed && <div className="text-[11px] text-positive flex items-center gap-1 mt-0.5"><Check size={11} /> Added to card</div>}</div>
                      </div>
                    ))}
                  </div>
                  {active.processed ? (
                    <button onClick={() => active.personId && nav(`/people/${active.personId}`)} className="w-full mt-3 text-[13px] text-accent font-semibold border border-border-blue rounded-lg py-2 hover:bg-accent-wash transition-colors">View {active.dealOrg}’s card</button>
                  ) : (
                    <button onClick={() => act.processMeeting(active.id, active.dealId, active.personId, active.dealOrg)} className="w-full mt-3 text-[13px] text-white font-semibold bg-accent-gradient shadow-primary rounded-lg py-2 flex items-center justify-center gap-1.5"><Sparkle size={14} /> Push notes & tasks to card</button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}

function ScheduleMeetingModal({ open, onClose, onScheduled }: { open: boolean; onClose: () => void; onScheduled: (id: string) => void }) {
  const act = useActions()
  const [title, setTitle] = useState('')
  const [platform, setPlatform] = useState<Meeting['platform']>('Teams')
  const [when, setWhen] = useState('')
  const [org, setOrg] = useState('')
  const [bot, setBot] = useState(true)
  const reset = () => { setTitle(''); setWhen(''); setOrg('') }
  return (
    <Modal open={open} onClose={onClose} title="Schedule meeting" subtitle="The AI notetaker can join automatically"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { if (title.trim()) { const m = act.addMeeting({ title: title.trim(), platform, when: when || 'Soon', dealOrg: org, bot, status: 'upcoming' }); reset(); onClose(); onScheduled(m.id) } }}>Schedule</Button></>}>
      <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Discovery call — Acme Ltd" autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Platform"><Select value={platform} onChange={(e) => setPlatform(e.target.value as Meeting['platform'])}><option>Teams</option><option>Google Meet</option><option>Zoom</option></Select></Field>
        <Field label="When"><Input value={when} onChange={(e) => setWhen(e.target.value)} placeholder="Tomorrow 2pm" /></Field>
      </div>
      <Field label="Organisation / deal"><Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Acme Ltd" /></Field>
      <label className="flex items-center gap-2.5 mt-1 cursor-pointer">
        <button type="button" onClick={() => setBot(!bot)} className={classNames('w-10 h-6 rounded-full flex items-center px-0.5 transition-colors', bot ? 'bg-accent justify-end' : 'bg-input-border justify-start')}><span className="w-5 h-5 rounded-full bg-white shadow" /></button>
        <span className="text-[13px] text-ink-2">TellOvi Notetaker joins &amp; summarises</span>
      </label>
    </Modal>
  )
}
