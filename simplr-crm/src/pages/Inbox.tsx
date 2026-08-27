import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button, Segmented, Avatar, Chip } from '../components/ui'
import { SubSidebar } from '../components/chrome'
import { Modal, Field, Input, Textarea } from '../components/overlays'
import { Plus, Envelope, File, Note, ArrowUpRight, Box, Sparkle, Check, Send } from '../components/icons'
import { useState_, useActions } from '../store/store'
import { classNames } from '../lib/format'

const folders = [
  { label: 'Inbox', icon: Envelope, key: 'inbox' },
  { label: 'Drafts', icon: Note, key: 'drafts' },
  { label: 'Outbox', icon: ArrowUpRight, key: 'outbox' },
  { label: 'Sent', icon: ArrowUpRight, key: 'sent' },
  { label: 'Archive', icon: Box, key: 'archive' },
]

export function Inbox() {
  const nav = useNavigate()
  const { emails, connections } = useState_()
  const act = useActions()
  const [view, setView] = useState('All')
  const [folder, setFolder] = useState('Inbox')
  const [sel, setSel] = useState<string | null>(null)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)

  const folderKey = folders.find((f) => f.label === folder)?.key ?? 'inbox'
  const list = emails
    .filter((e) => e.folder === folderKey)
    .filter((e) => (view === 'Unread' ? e.unread : view === 'Deal-linked' ? e.dealId : view === 'Sent' ? e.folder === 'sent' : true))
    .sort((a, b) => b.createdAt - a.createdAt)

  const active = list.find((m) => m.id === sel) ?? list[0]

  useEffect(() => {
    if (active?.unread) act.markRead(active.id)
  }, [active?.id])

  const emailConns = connections.filter((c) => c.kind === 'email')

  function openReply(withAI = false) {
    if (!active) return
    setReplyBody(withAI ? aiDraft(active.from) : '')
    setReplyOpen(true)
  }
  function sendReply() {
    if (!active) return
    act.sendEmail({ folder: 'sent', from: 'Jordan Miles', fromEmail: 'jordan@tellovi.io', to: active.fromEmail, subject: `Re: ${active.subject}`, body: replyBody, dealId: active.dealId, personId: active.personId, dealLabel: active.dealLabel, time: 'Just now' })
    setReplyOpen(false)
    setReplyBody('')
  }

  return (
    <>
      <TopBar
        title="Sales Inbox"
        center={<Segmented options={['All', 'Unread', 'Deal-linked', 'Sent']} value={view} onChange={setView} />}
        actions={<><Button icon={<File size={16} />} onClick={() => act.toast('Templates — 6 available', 'accent')}>Templates</Button><Button>Tracking · on</Button><Button variant="primary" icon={<Plus size={16} />} onClick={() => setComposeOpen(true)}>Compose</Button></>}
      />
      <div className="flex-1 flex min-h-0">
        <SubSidebar
          width={210}
          active={folder}
          onSelect={setFolder}
          top={<button onClick={() => setComposeOpen(true)} className="w-full h-9 rounded-control bg-accent-gradient text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 shadow-primary"><Plus size={16} /> New email</button>}
          footer={
            <div className="flex flex-col gap-2">
              <div className="eyebrow text-muted-3">Connected accounts</div>
              {emailConns.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-[12px]">
                  <span className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: a.color }}>{a.provider[0]}</span>
                  <span className="text-ink-3 truncate flex-1">{a.account}</span>
                  {a.connected ? <Check size={13} className="text-positive shrink-0" /> : <button onClick={() => act.toggleConnection(a.id, a.provider, false)} className="text-accent text-[11px] font-semibold">Connect</button>}
                </div>
              ))}
            </div>
          }
          groups={[
            { items: folders.map((f) => ({ label: f.label, icon: f.icon, count: emails.filter((e) => e.folder === f.key && (f.key === 'inbox' ? e.unread : true)).length || undefined })) },
            { heading: 'Integrations', items: [{ label: 'WhatsApp', icon: Envelope, badge: 'New' }] },
          ]}
        />

        {/* list */}
        <div className="w-[380px] shrink-0 bg-surface border-r border-border overflow-y-auto">
          {list.length === 0 && <div className="p-6 text-center text-[13px] text-muted-2">No messages in {folder}.</div>}
          {list.map((m) => (
            <button key={m.id} onClick={() => setSel(m.id)} className={classNames('w-full text-left px-4 py-3.5 border-b border-divider flex flex-col gap-1', m.id === active?.id ? 'bg-accent-wash-4' : m.unread ? 'bg-[#F1F6FF]' : 'hover:bg-[#F7F9FC]')}>
              <div className="flex items-center gap-2">
                <span className={classNames('text-[13px] truncate', m.unread ? 'font-bold text-ink' : 'font-semibold text-ink-2')}>{m.folder === 'sent' ? `To: ${m.to}` : m.from}</span>
                {m.dealLabel && <Chip tone="accent">{m.dealLabel}</Chip>}
                <span className="ml-auto text-[11px] text-muted-3 shrink-0">{m.time}</span>
              </div>
              <div className={classNames('text-[13px] truncate', m.unread ? 'font-semibold text-ink-2' : 'text-ink-3')}>{m.subject}</div>
              <div className="text-[12px] text-muted-2 truncate">{m.body.split('\n')[0]}</div>
            </button>
          ))}
        </div>

        {/* reading pane */}
        <main className="flex-1 overflow-y-auto flex flex-col">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-[13px] text-muted-2">Select a message</div>
          ) : (
            <>
              <div className="px-7 py-5 border-b border-border flex items-start gap-3.5">
                <Avatar name={active.from} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] font-bold text-ink">{active.subject}</div>
                  <div className="text-[13px] text-muted-b mt-0.5">{active.from} &lt;{active.fromEmail}&gt; · to me</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" icon={<Sparkle size={16} />} onClick={() => openReply(true)}>Draft with AI</Button>
                  <Button icon={<Envelope size={16} />} onClick={() => openReply(false)}>Reply</Button>
                </div>
              </div>

              {active.dealId && (
                <div className="px-7 pt-5">
                  <div className="rounded-card border border-border-blue bg-accent-wash-4 p-4">
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-accent-700"><Sparkle size={15} /> AI summary</div>
                    <div className="text-[13px] text-ink-3 leading-relaxed mt-2">{aiSummary(active.from)}</div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className="text-[12px] text-muted-2">Suggested replies:</span>
                      {suggestions(active.from).map((s, i) => (
                        <button key={s} onClick={() => { setReplyBody(aiDraft(active.from)); setReplyOpen(true) }} className={classNames('h-7 px-2.5 rounded-full text-[12px] font-medium', i === 0 ? 'bg-accent text-white' : 'bg-surface border border-border-blue text-accent')}>{s}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="px-7 py-6 flex-1">
                <div className="max-w-[720px] text-[14px] leading-[1.7] text-ink-2 whitespace-pre-wrap">{active.body}</div>
              </div>

              <div className="px-7 py-3 border-t border-border bg-[#FBFCFF] flex items-center gap-4 text-[12px]">
                {active.dealId ? (
                  <>
                    <span className="text-muted-2">Linked deal</span>
                    <button onClick={() => nav(`/deals/${active.dealId}`)} className="font-semibold text-accent">{active.dealLabel}</button>
                  </>
                ) : (
                  <span className="text-muted-2">Not linked to a deal</span>
                )}
                {active.personId && <button onClick={() => nav(`/people/${active.personId}`)} className="ml-auto text-accent font-semibold">View contact →</button>}
              </div>
            </>
          )}
        </main>
      </div>

      {/* reply composer */}
      <Modal
        open={replyOpen}
        onClose={() => setReplyOpen(false)}
        title={active ? `Reply to ${active.from}` : 'Reply'}
        subtitle={active?.subject}
        width={600}
        footer={<><Button onClick={() => setReplyBody(aiDraft(active?.from ?? ''))} icon={<Sparkle size={15} />}>Rewrite with AI</Button><Button variant="primary" icon={<Send size={15} />} onClick={sendReply}>Send</Button></>}
      >
        <Textarea rows={10} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Write your reply…" autoFocus />
      </Modal>

      {/* compose */}
      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} onSend={(to, subject, body) => { act.sendEmail({ folder: 'sent', from: 'Jordan Miles', fromEmail: 'jordan@tellovi.io', to, subject, body, time: 'Just now' }); setComposeOpen(false) }} />
    </>
  )
}

function ComposeModal({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (to: string, subject: string, body: string) => void }) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="New email" width={600} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={<Send size={15} />} onClick={() => to.trim() && onSend(to, subject || '(no subject)', body)}>Send</Button></>}>
      <Field label="To"><Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@company.com" autoFocus /></Field>
      <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" /></Field>
      <Field label="Message"><Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" /></Field>
    </Modal>
  )
}

function aiSummary(from: string) {
  return `${from.split(' ')[0]} is ready to move — the phased rollout works. The one blocker is the liability caps, which finance needs resolved in the SOW before sign-off. Decision expected end of next week. Sentiment: positive.`
}
function suggestions(_from: string) {
  return ['Confirm liability caps + attach SOW', 'Offer a legal call this week', 'Thank + hold pricing']
}
function aiDraft(from: string) {
  const f = from.split(' ')[0]
  return `Hi ${f},\n\nThanks for the quick turnaround. To close out the liability caps: our standard is a 12-month fees cap, and I’ve reflected that in the SOW so finance has it in writing. I’ve also split out the maintenance retainer so it’s explicit.\n\nHappy to get legal on a short call this week if that helps you move to sign-off. I’ll hold the current pricing until then.\n\nBest,\nJordan`
}
