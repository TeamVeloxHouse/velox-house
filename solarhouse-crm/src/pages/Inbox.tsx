import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button, Segmented, Avatar, Chip } from '../components/ui'
import { SubSidebar } from '../components/chrome'
import { Modal, Field, Input, Textarea } from '../components/overlays'
import { Plus, Envelope, File, Note, ArrowUpRight, Box, Sparkle, Check, Send, Robot } from '../components/icons'
import { useState_, useActions } from '../store/store'
import { triageEmail, draftReply } from '../lib/inbox'
import type { EmailMsg } from '../store/types'
import { classNames } from '../lib/format'
import { Dropdown } from '../components/Dropdown'

const folders = [
  { label: 'Inbox', icon: Envelope, key: 'inbox' },
  { label: 'Drafts', icon: Note, key: 'drafts' },
  { label: 'Outbox', icon: ArrowUpRight, key: 'outbox' },
  { label: 'Sent', icon: ArrowUpRight, key: 'sent' },
  { label: 'Archive', icon: Box, key: 'archive' },
]

export function Inbox() {
  const nav = useNavigate()
  const { emails, connections, deals, inboxAutoReply } = useState_()
  const act = useActions()
  const [view, setView] = useState('All')
  const [folder, setFolder] = useState('Inbox')
  const [sel, setSel] = useState<string | null>(null)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [editDraft, setEditDraft] = useState<EmailMsg | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [drafting, setDrafting] = useState(false)

  const dealNameOf = (id?: string) => deals.find((d) => d.id === id)?.name
  const pendingDrafts = emails.filter((e) => e.aiDrafted && e.folder === 'drafts').sort((a, b) => b.createdAt - a.createdAt)

  // Ovi auto-reply: when turned on, draft (or auto-send) replies to un-handled inbound mail.
  useEffect(() => {
    if (inboxAutoReply === 'off') return
    const inbound = emails.filter((e) => e.folder === 'inbox' && !e.handled && e.fromEmail !== 'jordan@tellovi.io')
    if (inbound.length === 0) return
    setDrafting(true)
    const timer = setTimeout(() => {
      inbound.forEach((e) => {
        const { body } = draftReply(e, { dealName: dealNameOf(e.dealId), contactFirst: e.from.split(' ')[0] })
        act.oviDraftReply(e, body, inboxAutoReply === 'send')
      })
      setDrafting(false)
    }, 1200)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboxAutoReply])

  const folderKey = folders.find((f) => f.label === folder)?.key ?? 'inbox'
  const list = emails
    .filter((e) => e.folder === folderKey)
    .filter((e) => (view === 'Unread' ? e.unread : view === 'Deal-linked' ? e.dealId : view === 'Sent' ? e.folder === 'sent' : true))
    .sort((a, b) => b.createdAt - a.createdAt)

  const active = list.find((m) => m.id === sel) ?? list[0]
  const activeTriage = active && active.folder === 'inbox' ? triageEmail(active) : null
  const activeDraft = active && active.folder === 'inbox' ? draftReply(active, { dealName: dealNameOf(active.dealId), contactFirst: active.from.split(' ')[0] }) : null

  useEffect(() => {
    if (active?.unread) act.markRead(active.id)
  }, [active?.id])

  const emailConns = connections.filter((c) => c.kind === 'email')

  function openReply(withAI = false) {
    if (!active) return
    setEditDraft(null)
    setReplyBody(withAI ? draftReply(active, { dealName: dealNameOf(active.dealId), contactFirst: active.from.split(' ')[0] }).body : '')
    setReplyOpen(true)
  }
  function openEditDraft(d: EmailMsg) {
    setEditDraft(d)
    setReplyBody(d.body)
    setReplyOpen(true)
  }
  function sendReply() {
    if (editDraft) {
      act.updateDraft(editDraft.id, replyBody)
      act.approveDraft({ ...editDraft, body: replyBody })
    } else if (active) {
      act.sendEmail({ folder: 'sent', from: 'Jordan Miles', fromEmail: 'jordan@tellovi.io', to: active.fromEmail, subject: `Re: ${active.subject}`, body: replyBody, dealId: active.dealId, personId: active.personId, dealLabel: active.dealLabel, time: 'Just now' })
    }
    setReplyOpen(false); setReplyBody(''); setEditDraft(null)
  }

  return (
    <>
      <TopBar
        title="Sales Inbox"
        center={<Segmented options={['All', 'Unread', 'Deal-linked', 'Sent']} value={view} onChange={setView} />}
        actions={<>
          <label className="flex items-center gap-1.5 text-[12.5px] text-muted-b">
            <Robot size={15} className={inboxAutoReply === 'off' ? 'text-muted-3' : 'text-accent'} />
            <span className="hidden md:inline">Ovi auto-reply</span>
            <Dropdown value={inboxAutoReply} onChange={(e) => act.setAutoReply(e.target.value as 'off' | 'draft' | 'send')} className="h-8 px-2 rounded-control border border-input-border bg-white text-[12.5px] font-medium text-ink-2 outline-none focus:border-accent">
              <option value="off">Off</option>
              <option value="draft">Draft for me</option>
              <option value="send">Auto-send</option>
            </Dropdown>
          </label>
          <Button icon={<File size={16} />} onClick={() => act.toast('Templates — 6 available', 'accent')}>Templates</Button>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setComposeOpen(true)}>Compose</Button>
        </>}
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
          {(drafting || pendingDrafts.length > 0) && folder === 'Inbox' && (
            <div className="border-b-2 border-border-blue bg-accent-wash-4 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-accent-700 mb-2">
                <Sparkle size={13} className={drafting ? 'animate-pulse' : ''} /> {drafting ? 'Ovi is drafting replies…' : `Ovi drafted ${pendingDrafts.length} repl${pendingDrafts.length === 1 ? 'y' : 'ies'} for approval`}
              </div>
              {pendingDrafts.map((d) => (
                <div key={d.id} className="rounded-lg bg-surface border border-border-blue p-2.5 mb-1.5">
                  <div className="flex items-center gap-1.5"><span className="text-[12px] font-semibold text-ink-2 truncate flex-1">To {d.to}</span>{d.dealLabel && <Chip tone="accent">{d.dealLabel}</Chip>}</div>
                  <div className="text-[11.5px] text-muted-2 mt-0.5 line-clamp-2">{d.body.split('\n').filter(Boolean)[0]}</div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <button onClick={() => act.approveDraft(d)} className="h-7 px-2.5 rounded-lg bg-accent text-white text-[11.5px] font-semibold inline-flex items-center gap-1"><Send size={11} /> Approve &amp; send</button>
                    <button onClick={() => openEditDraft(d)} className="h-7 px-2.5 rounded-lg border border-border text-ink-3 text-[11.5px] font-medium hover:bg-control">Edit</button>
                    <button onClick={() => act.dismissDraft(d.id)} className="h-7 px-2.5 rounded-lg text-muted-2 text-[11.5px] font-medium hover:bg-control ml-auto">Dismiss</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {list.length === 0 && <div className="p-6 text-center text-[13px] text-muted-2">No messages in {folder}.</div>}
          {list.map((m) => (
            <button key={m.id} onClick={() => setSel(m.id)} className={classNames('w-full text-left px-4 py-3.5 border-b border-divider flex flex-col gap-1', m.id === active?.id ? 'bg-accent-wash-4' : m.unread ? 'bg-[#F1F6FF]' : 'hover:bg-[#F7F9FC]')}>
              <div className="flex items-center gap-2">
                <span className={classNames('text-[13px] truncate', m.unread ? 'font-bold text-ink' : 'font-semibold text-ink-2')}>{m.folder === 'sent' ? `To: ${m.to}` : m.from}</span>
                {m.dealLabel && <Chip tone="accent">{m.dealLabel}</Chip>}
                {m.folder === 'inbox' && (() => { const tr = triageEmail(m); return tr.intent !== 'other' ? <Chip tone={tr.tone}>{tr.label}</Chip> : null })()}
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

              {activeDraft && (
                <div className="px-7 pt-5">
                  <div className="rounded-card border border-border-blue bg-accent-wash-4 p-4">
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-accent-700"><Sparkle size={15} /> Ovi triage{activeTriage && <Chip tone={activeTriage.tone}>{activeTriage.label}</Chip>}</div>
                    <div className="text-[13px] text-ink-3 leading-relaxed mt-2">{activeDraft.summary}</div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className="text-[12px] text-muted-2">Suggested replies:</span>
                      {activeDraft.suggestions.map((s, i) => (
                        <button key={s} onClick={() => openReply(true)} className={classNames('h-7 px-2.5 rounded-full text-[12px] font-medium', i === 0 ? 'bg-accent text-white' : 'bg-surface border border-border-blue text-accent')}>{s}</button>
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
        title={editDraft ? `Edit Ovi's reply to ${editDraft.to}` : active ? `Reply to ${active.from}` : 'Reply'}
        subtitle={editDraft?.subject ?? active?.subject}
        width={600}
        footer={<><Button onClick={() => { const src = editDraft ?? active; if (src) setReplyBody(draftReply(src, { dealName: dealNameOf(src.dealId), contactFirst: (src.folder === 'drafts' ? src.to : src.from).split(' ')[0] }).body) }} icon={<Sparkle size={15} />}>Rewrite with AI</Button><Button variant="primary" icon={<Send size={15} />} onClick={sendReply}>{editDraft ? 'Approve & send' : 'Send'}</Button></>}
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

