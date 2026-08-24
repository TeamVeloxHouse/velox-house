import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button, Segmented, Avatar, Chip } from '../components/ui'
import { Person, Send, Check, Sparkle, Plus } from '../components/icons'
import { Modal, Field, Input, Textarea } from '../components/overlays'
import { useState_, useActions } from '../store/store'
import { classNames } from '../lib/format'

const LI = '#0A66C2'

export function LinkedInInbox() {
  const nav = useNavigate()
  const { linkedinThreads } = useState_()
  const act = useActions()
  const [view, setView] = useState('All')
  const [sel, setSel] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [compose, setCompose] = useState(false)

  const list = linkedinThreads
    .filter((t) => (view === 'Unread' ? t.status === 'unread' : view === 'Requests' ? t.kind === 'connection' : view === 'Accepted' ? t.status === 'accepted' : true))
    .sort((a, b) => b.createdAt - a.createdAt)
  const active = list.find((t) => t.id === sel) ?? list[0]
  const unread = linkedinThreads.filter((t) => t.status === 'unread').length

  return (
    <>
      <TopBar
        title="LinkedIn"
        crumbs={['Social selling']}
        center={<Segmented options={['All', 'Unread', 'Requests', 'Accepted']} value={view} onChange={setView} />}
        actions={<><Button icon={<Person size={16} />} onClick={() => nav('/reach/people-finder')}>Find people</Button><Button variant="primary" icon={<Plus size={16} />} onClick={() => setCompose(true)}>Message</Button></>}
      />
      <ComposeLiModal open={compose} onClose={() => setCompose(false)} onSend={(name, company, msg) => { const t = act.addLinkedInThread(name, company, msg); setSel(t.id); setCompose(false) }} />
      <div className="flex-1 flex min-h-0">
        {/* list */}
        <div className="w-[380px] shrink-0 bg-surface border-r border-border overflow-y-auto">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: LI }}><Person size={16} /></span>
            <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold text-ink-2">Simplr · via Unipile</div><div className="text-[12px] text-muted-2">Connected · {unread} unread</div></div>
            <Check size={15} className="text-positive" />
          </div>
          {list.map((t) => (
            <button key={t.id} onClick={() => setSel(t.id)} className={classNames('w-full text-left px-4 py-3.5 border-b border-divider flex flex-col gap-1', t.id === active?.id ? 'bg-accent-wash-4' : t.status === 'unread' ? 'bg-[#F1F6FF]' : 'hover:bg-[#F7F9FC]')}>
              <div className="flex items-center gap-2">
                <Avatar name={t.name} size={26} />
                <span className={classNames('text-[13px] truncate flex-1', t.status === 'unread' ? 'font-bold text-ink' : 'font-semibold text-ink-2')}>{t.name}</span>
                {t.kind === 'connection' ? <Chip tone={t.status === 'accepted' ? 'positive' : 'warning'}>{t.status === 'accepted' ? 'Accepted' : 'Request'}</Chip> : t.sequence ? <Chip tone="accent">Seq</Chip> : null}
                <span className="text-[11px] text-muted-3 shrink-0">{t.time}</span>
              </div>
              <div className="text-[12px] text-muted-2 truncate pl-[34px]">{t.preview}</div>
            </button>
          ))}
        </div>

        {/* pane */}
        <main className="flex-1 overflow-y-auto flex flex-col">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-[13px] text-muted-2">Select a conversation</div>
          ) : (
            <>
              <div className="px-7 py-5 border-b border-border flex items-start gap-3.5">
                <Avatar name={active.name} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] font-bold text-ink">{active.name}</div>
                  <div className="text-[13px] text-muted-b">{active.headline} · {active.company}</div>
                </div>
                {active.personId && <Button onClick={() => nav(`/people/${active.personId}`)}>View contact</Button>}
                {active.kind === 'connection' && active.status === 'pending' ? (
                  <Button variant="primary" icon={<Check size={16} />} onClick={() => act.liAccept(active)}>Accept</Button>
                ) : null}
              </div>

              {active.sequence && (
                <div className="px-7 pt-4">
                  <div className="rounded-lg border border-border-blue bg-accent-wash-4 px-3.5 py-2 flex items-center gap-2 text-[12.5px]">
                    <Sparkle size={14} className="text-accent" /><span className="text-accent-700 font-medium">In sequence:</span><span className="text-ink-3">{active.sequence}</span>
                  </div>
                </div>
              )}

              <div className="px-7 py-6 flex-1">
                <div className="max-w-[620px] flex flex-col gap-3">
                  <div className="self-start bg-[#F6F7F9] rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[13.5px] text-ink-2 max-w-[80%]">{active.preview}</div>
                  <div className="text-[11px] text-muted-3">{active.time}</div>
                </div>
              </div>

              <div className="px-7 py-4 border-t border-border bg-surface">
                <div className="flex items-end gap-2 bg-canvas border border-border rounded-2xl p-2">
                  <button onClick={() => setDraft('Hi ' + active.name.split(' ')[0] + ', thanks for connecting! Would you be open to a quick call this week about ' + active.company + '’s energy setup?')} className="w-8 h-8 rounded-lg flex items-center justify-center text-accent hover:bg-accent-wash shrink-0" title="Draft with AI"><Sparkle size={16} /></button>
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={1} placeholder={`Message ${active.name.split(' ')[0]}…`} className="flex-1 resize-none outline-none bg-transparent text-[14px] text-ink-2 placeholder:text-muted-3 px-1 py-1.5 max-h-28" />
                  <button onClick={() => { if (draft.trim()) { act.liReply(active, draft); setDraft('') } }} disabled={!draft.trim()} className="w-9 h-9 rounded-xl text-white flex items-center justify-center shrink-0 disabled:opacity-40" style={{ background: LI }}><Send size={16} /></button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  )
}

function ComposeLiModal({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (name: string, company: string, msg: string) => void }) {
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [msg, setMsg] = useState('')
  const reset = () => { setName(''); setCompany(''); setMsg('') }
  return (
    <Modal open={open} onClose={onClose} title="New LinkedIn message" subtitle="Drafts a thread — sends when your LinkedIn account is connected"
      footer={<><Button icon={<Sparkle size={15} />} onClick={() => setMsg(`Hi ${name || 'there'}, I came across ${company || 'your company'} and loved what you're building. Would a quick chat about how we help teams like yours be useful?`)}>Draft with AI</Button><Button variant="primary" icon={<Send size={15} />} onClick={() => { if (name.trim() && msg.trim()) { onSend(name.trim(), company || '—', msg.trim()); reset() } }}>Save draft</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="To"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus /></Field>
        <Field label="Company"><Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" /></Field>
      </div>
      <Field label="Message"><Textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Write your message…" /></Field>
    </Modal>
  )
}
