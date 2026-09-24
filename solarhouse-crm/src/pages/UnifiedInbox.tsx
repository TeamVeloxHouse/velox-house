import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Envelope, Phone, Sparkle, Search, Star, Clock, Check, ChevronDown, ChevronRight, Person, MapPin, Home, Send, Note, Camera, Grid, ArrowUpRight, Calendar, Task, Bolt } from '../components/icons'
import { useActions, useState_ } from '../store/store'
import { classNames, money } from '../lib/format'
import type { CommsChannel, CommsMessage, CommsStage, Conversation } from '../store/types'

/* The Solar House unified inbox — every customer conversation across email, WhatsApp, SMS, calls,
 * web forms, social and the customer portal, in ONE thread per homeowner. Replies are logged here;
 * heavy email work jumps out to Outlook (we don't try to replace it). */

const ME = 'Jordan Miles'
const TEAM = ['Jordan Miles', 'Amy Price', 'Rhys Evans', 'Beth Collins']

type Icon = (p: { size?: number; className?: string }) => JSX.Element
const WhatsAppIcon: Icon = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8L4 20z" /><path d="M9.2 8.6c.3 1.9 1.9 4 4 4.9l1-.9 1.5.8c-.3 1-1.1 1.5-2 1.4-2.9-.4-5.3-2.8-5.6-5.7 0-.9.5-1.7 1.4-2l.8 1.5-1.1 1z" />
  </svg>
)
const SmsIcon: Icon = ({ size = 18, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 5h16v11H9l-5 4V5z" /><path d="M8 10h.01M12 10h.01M16 10h.01" />
  </svg>
)

const CH: Record<CommsChannel, { label: string; color: string; wash: string; icon: Icon }> = {
  email: { label: 'Email', color: '#0A64AD', wash: '#E7F0FA', icon: Envelope },
  whatsapp: { label: 'WhatsApp', color: '#1DA851', wash: '#E6F7EC', icon: WhatsAppIcon },
  sms: { label: 'SMS', color: '#7C3AED', wash: '#F1ECFD', icon: SmsIcon },
  call: { label: 'Calls', color: '#D97706', wash: '#FDF3E3', icon: Phone },
  web: { label: 'Web & lead ads', color: '#0E7A66', wash: '#E6F6F1', icon: Grid },
  social: { label: 'Facebook & Instagram', color: '#DB2777', wash: '#FCE8F2', icon: Camera },
  portal: { label: 'Customer portal', color: '#15223B', wash: '#E8ECF3', icon: Home },
}
const STAGES: { id: CommsStage; label: string }[] = [
  { id: 'new-lead', label: 'New lead' }, { id: 'assessment', label: 'ROI assessment' }, { id: 'quoted', label: 'Quoted' },
  { id: 'survey', label: 'Survey' }, { id: 'installing', label: 'Installing' }, { id: 'customer', label: 'Customer' },
]
const stageLabel = (s: CommsStage) => STAGES.find((x) => x.id === s)?.label ?? s

type View = 'open' | 'reply' | 'mine' | 'unassigned' | 'starred' | 'snoozed' | 'done'
const VIEWS: { id: View; label: string; icon: Icon }[] = [
  { id: 'open', label: 'All open', icon: Envelope }, { id: 'reply', label: 'Needs reply', icon: Clock }, { id: 'mine', label: 'Assigned to me', icon: Person },
  { id: 'unassigned', label: 'Unassigned', icon: Grid }, { id: 'starred', label: 'Starred', icon: Star }, { id: 'snoozed', label: 'Snoozed', icon: Calendar }, { id: 'done', label: 'Done', icon: Check },
]

const last = (c: Conversation) => c.messages.filter((x) => x.dir !== 'note').slice(-1)[0] ?? c.messages.slice(-1)[0]
const needsReply = (c: Conversation) => c.status === 'open' && last(c)?.dir === 'in'
const waitingMins = (c: Conversation) => (needsReply(c) ? Math.round((Date.now() - last(c).at) / 60000) : 0)
const channelsOf = (c: Conversation) => [...new Set(c.messages.filter((x) => x.dir !== 'note').map((x) => x.channel))]
const initials = (n: string) => n.split(/[\s&]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
function rel(t: number) {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  if (m < 1440) return `${Math.round(m / 60)}h`
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
const clock = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
function dayLabel(t: number) {
  const d = new Date(t), today = new Date()
  const y = new Date(); y.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}
function sla(mins: number) {
  if (!mins) return null
  const tone = mins < 30 ? '#0E7C66' : mins < 240 ? '#B45309' : '#B01B4F'
  const bg = mins < 30 ? '#E9F5F1' : mins < 240 ? '#FDF3E3' : '#FDECEF'
  const txt = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h ${mins % 60 ? `${mins % 60}m` : ''}` : `${Math.floor(mins / 1440)}d`
  return { tone, bg, txt: txt.trim() }
}

/** Ovi's read of the thread — intent, summary and suggested replies (deterministic, from the words used). */
function oviRead(c: Conversation) {
  const inbound = c.messages.filter((x) => x.dir === 'in')
  const text = inbound.map((x) => `${x.body} ${x.voicemail ?? ''}`).join(' ').toLowerCase()
  const first = c.name.split(' ')[0]
  if (/power cut|backup/.test(text)) return { intent: 'Buying question', tone: '#0E7C66', summary: `${first} is close to deciding and wants to know if the battery keeps the house running in a power cut. Answer that and they're likely to book.`, replies: [`Hi ${first}, great question! Yes — with the backup gateway we'd include, your essentials keep running in a power cut. I'll explain the options on a quick call, when suits you?`, `Hi ${first}, happy to help. Shall I pop over a short video showing how backup works?`] }
  if (/cheaper|worth the extra|comparing/.test(text)) return { intent: 'Price objection', tone: '#B45309', summary: `${first} is comparing us with a cheaper installer. Lead with value: kit quality, workmanship warranty, aftercare and the portal, not a discount.`, replies: [`Hi ${first}, totally fair to compare. The difference is in what's behind the price: tier-1 kit, our own installers (no subbies), a 10-year workmanship warranty and live monitoring through your portal. Could I walk you through a like-for-like in 10 minutes?`] }
  if (/missed call|ring|call/.test(text) && c.stage === 'new-lead') return { intent: 'Call back', tone: '#B01B4F', summary: `Fresh lead who wants a call${/after six|evening/.test(text) ? ' after 6pm' : ''}. Speed matters most here: leads called within the hour convert far better.`, replies: [`Hi ${first}, it's The Solar House, thanks for getting in touch! I'll call you after 6 this evening. Is this the best number?`] }
  if (/battery/.test(text) && /panels/.test(text)) return { intent: 'Battery retrofit', tone: '#0E7C66', summary: `${first} already has older panels and wants to add a battery, a quick-win retrofit. Ask for their inverter make and a recent bill.`, replies: [`Hi ${first}! Yes, we add batteries to existing systems all the time. Could you send a photo of your inverter label and a recent bill? Then we can give you a proper saving figure.`] }
  if (/scaffold|nobody told/.test(text)) return { intent: 'Complaint risk', tone: '#B01B4F', summary: 'Customer surprised by an unannounced visit. Apologise, confirm the plan in writing and fix the notification.', replies: ['So sorry for the surprise, Helen, that should never have happened without a heads-up. The scaffold is safe to stay up and your install is still confirmed for Tuesday.'] }
  if (/friend|interested too|pass on/.test(text)) return { intent: 'Referral', tone: '#0E7C66', summary: `${first} wants to refer a friend. Thank them, capture the referral and trigger the portal reward.`, replies: [`That's so kind of you, ${first}! Please do pass on our number, or send me Joan's details and I'll give her a ring. As a thank-you, you'll get £100 when her system goes in.`] }
  if (/survey|move|rearrange/.test(text)) return { intent: 'Scheduling', tone: '#0A64AD', summary: 'Scheduling request: confirm a new slot and send a reminder the day before.', replies: [`No problem at all, ${first}. I've moved you and will text a reminder the day before.`] }
  if (/thank|brilliant|wonderful/.test(text)) return { intent: 'Happy customer', tone: '#0E7C66', summary: 'Positive feedback. Ask for a Google review while the moment is warm.', replies: [`Thank you so much, ${first}! Would you mind leaving us a quick Google review? It really helps a small local team.`] }
  return { intent: 'Enquiry', tone: '#0A64AD', summary: `${first} has made a new enquiry. Qualify the roof, bill and timing, and offer a free ROI assessment.`, replies: [`Hi ${first}, thanks for getting in touch with The Solar House! When would be a good time for a quick call about your home?`] }
}

export function UnifiedInbox() {
  const { conversations } = useState_()
  const act = useActions()
  const [view, setView] = useState<View>('open')
  const [channel, setChannel] = useState<CommsChannel | 'all'>('all')
  const [q, setQ] = useState('')
  const [selId, setSelId] = useState<string | null>(null)
  // Panels adapt to the screen: the thread always gets the room; side panels fold away on smaller screens.
  const [leftOpen, setLeftOpen] = useState(() => window.innerWidth >= 1680)
  const [rightOpen, setRightOpen] = useState(() => window.innerWidth >= 1520)
  const [focus, setFocus] = useState(false)
  useEffect(() => {
    let prev = window.innerWidth
    const onResize = () => {
      const w = window.innerWidth
      if ((prev >= 1680) !== (w >= 1680)) setLeftOpen(w >= 1680)
      if ((prev >= 1520) !== (w >= 1520)) setRightOpen(w >= 1520)
      prev = w
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const inView = (c: Conversation, v: View) =>
    v === 'open' ? c.status === 'open' : v === 'reply' ? needsReply(c) : v === 'mine' ? c.assignee === ME && c.status !== 'done'
      : v === 'unassigned' ? !c.assignee && c.status !== 'done' : v === 'starred' ? !!c.starred : v === 'snoozed' ? c.status === 'snoozed' : c.status === 'done'

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return conversations
      .filter((c) => inView(c, view))
      .filter((c) => channel === 'all' || c.messages.some((x) => x.channel === channel))
      .filter((c) => !needle || [c.name, c.address, c.email, c.phone, ...c.messages.map((x) => x.body)].some((v) => v?.toLowerCase().includes(needle)))
      .sort((a, b) => last(b).at - last(a).at)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, view, channel, q])

  const sel = conversations.find((c) => c.id === selId) ?? list[0]
  useEffect(() => { if (sel?.unread) act.updateConversation(sel.id, { unread: false }) }, [sel?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const unread = conversations.filter((c) => c.unread).length
  const overdue = conversations.filter((c) => waitingMins(c) >= 240).length
  const showLeft = leftOpen && !focus, showRight = rightOpen && !focus

  const groups = useMemo(() => {
    const out: { label: string; items: Conversation[] }[] = []
    for (const c of list) {
      const l = dayLabel(last(c).at)
      const g = out.find((x) => x.label === l) ?? (out.push({ label: l, items: [] }), out[out.length - 1])
      g.items.push(c)
    }
    return out
  }, [list])

  return (
    <>
      <TopBar title="Inbox" crumbs={['Every channel, one thread per customer']}
        actions={
          <div className="flex items-center gap-2">
            {overdue > 0 && <span className="h-8 px-2.5 rounded-full bg-negative-wash text-negative text-[12px] font-semibold flex items-center gap-1.5"><Clock size={13} />{overdue} waiting 4h+</span>}
            <span className="h-8 px-2.5 rounded-full bg-control text-ink-3 text-[12px] font-semibold flex items-center gap-1.5">{unread} unread</span>
            <IconBtn title={focus ? 'Exit focus mode' : 'Focus mode: hide side panels'} on={focus} onClick={() => setFocus((f) => !f)}><ArrowUpRight size={16} className={focus ? 'rotate-180' : ''} /></IconBtn>
          </div>
        } />
      <div className="flex-1 flex min-h-0 bg-canvas">
        {/* ── left: views + channels ── */}
        <aside className={classNames('shrink-0 bg-surface border-r border-border flex flex-col transition-[width] duration-200 overflow-hidden', showLeft ? 'w-[236px]' : 'w-[60px]')}>
          <div className={classNames('flex items-center h-12 border-b border-divider shrink-0', showLeft ? 'px-3 justify-between' : 'justify-center')}>
            {showLeft && <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-3">Views</span>}
            <button onClick={() => { setLeftOpen((o) => !o); setFocus(false) }} title={showLeft ? 'Collapse' : 'Expand'} className="w-7 h-7 rounded-md hover:bg-control text-muted-b flex items-center justify-center"><ChevronRight size={15} className={showLeft ? 'rotate-180' : ''} /></button>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar p-2 flex flex-col gap-0.5">
            {VIEWS.map((v) => {
              const n = conversations.filter((c) => inView(c, v.id)).length
              return <RailItem key={v.id} icon={v.icon} label={v.label} count={n} on={view === v.id} compact={!showLeft} alert={v.id === 'reply' && n > 0} onClick={() => setView(v.id)} />
            })}
            {showLeft ? <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-3 px-2 pt-4 pb-1.5">Channels</div> : <div className="h-px bg-divider my-2 mx-2" />}
            <RailItem icon={Grid} label="All channels" count={conversations.filter((c) => inView(c, view)).length} on={channel === 'all'} compact={!showLeft} onClick={() => setChannel('all')} />
            {(Object.keys(CH) as CommsChannel[]).map((k) => (
              <RailItem key={k} icon={CH[k].icon} label={CH[k].label} color={CH[k].color} count={conversations.filter((c) => inView(c, view) && c.messages.some((x) => x.channel === k)).length} on={channel === k} compact={!showLeft} onClick={() => setChannel(k)} />
            ))}
          </div>
          {showLeft && (
            <div className="p-3 border-t border-divider flex flex-col gap-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-3 mb-0.5">Connections</div>
              {([['Outlook', '#0A64AD', false], ['WhatsApp Business', '#1DA851', false], ['Phone (VoIP)', '#D97706', false], ['Website forms', '#0E7A66', false], ['Meta lead ads', '#DB2777', false]] as const).map(([n, c, on]) => (
                <div key={n} className="flex items-center gap-2 text-[12px]">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? c : '#C3CBD8' }} />
                  <span className="text-ink-3 flex-1 truncate">{n}</span>
                  <span className={classNames('text-[10.5px] font-semibold', on ? 'text-positive' : 'text-muted-3')}>{on ? 'Live' : 'Not connected'}</span>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* ── middle: conversation list ── */}
        <section className="w-[340px] shrink-0 bg-surface border-r border-border flex flex-col min-h-0">
          <div className="p-3 border-b border-divider">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, address, message…" className="w-full h-9 pl-8 pr-3 rounded-control bg-control border border-transparent focus:border-accent focus:bg-white text-[13px] outline-none" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="sticky top-0 z-[1] bg-surface/95 backdrop-blur px-4 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-3 border-b border-divider-row">{g.label}</div>
                {g.items.map((c) => <ConvRow key={c.id} c={c} on={c.id === sel?.id} onClick={() => setSelId(c.id)} />)}
              </div>
            ))}
            {!list.length && <div className="p-10 text-center text-[13px] text-muted-2">Nothing here. Inbox zero ☀️</div>}
          </div>
        </section>

        {/* ── thread ── */}
        {sel ? <Thread key={sel.id} c={sel} rightOpen={showRight} toggleRight={() => { setRightOpen((o) => !o); setFocus(false) }} /> : <div className="flex-1 flex items-center justify-center text-[13px] text-muted-2">Select a conversation</div>}

        {/* ── right: customer context ── */}
        {sel && showRight && <ContextPanel c={sel} />}
      </div>
    </>
  )
}

function RailItem({ icon: I, label, count, on, compact, color, alert, onClick }: { icon: Icon; label: string; count: number; on: boolean; compact: boolean; color?: string; alert?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={compact ? `${label} (${count})` : undefined} className={classNames('relative h-9 rounded-lg flex items-center gap-2.5 text-[13px] transition-colors', compact ? 'justify-center' : 'px-2.5', on ? 'bg-accent-wash text-accent font-semibold' : 'text-ink-3 hover:bg-control')}>
      <span style={color && !on ? { color } : undefined}><I size={16} /></span>
      {!compact && <span className="flex-1 text-left truncate">{label}</span>}
      {!compact && count > 0 && <span className={classNames('text-[11px] font-semibold rounded-full min-w-[20px] h-[18px] px-1.5 flex items-center justify-center', alert ? 'bg-negative text-white' : on ? 'bg-accent text-white' : 'text-muted-2')}>{count}</span>}
      {compact && alert && <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-negative" />}
    </button>
  )
}

function ChannelAvatar({ c, size = 40 }: { c: Conversation; size?: number }) {
  const ch = CH[last(c).channel]
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <span className="w-full h-full rounded-full flex items-center justify-center font-semibold text-[13px]" style={{ background: ch.wash, color: ch.color }}>{initials(c.name)}</span>
      <span className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center text-white ring-2 ring-white" style={{ background: ch.color }}><ch.icon size={10} /></span>
    </span>
  )
}

function ConvRow({ c, on, onClick }: { c: Conversation; on: boolean; onClick: () => void }) {
  const l = last(c)
  const s = sla(waitingMins(c))
  const preview = l.channel === 'call' ? (l.callSecs ? `📞 Call · ${Math.round(l.callSecs / 60)} min` : `📞 Missed call${l.voicemail ? ' · voicemail' : ''}`) : l.body.replace(/\n+/g, ' ')
  return (
    <button onClick={onClick} className={classNames('w-full text-left px-4 py-3 border-b border-divider-row flex gap-3 relative transition-colors', on ? 'bg-accent-wash-4' : 'hover:bg-[#FAFBFC]')}>
      {on && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />}
      <ChannelAvatar c={c} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={classNames('text-[13.5px] truncate', c.unread ? 'font-bold text-ink' : 'font-semibold text-ink-2')}>{c.name}</span>
          {c.starred && <Star size={12} className="text-[#F59E0B] shrink-0" />}
          <span className="ml-auto text-[11px] text-muted-3 shrink-0">{rel(l.at)}</span>
        </div>
        <div className={classNames('text-[12.5px] truncate mt-0.5', c.unread ? 'text-ink-2 font-medium' : 'text-muted-b')}>{l.dir === 'out' ? <span className="text-muted-3">You: </span> : null}{preview}</div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-[10.5px] font-semibold rounded px-1.5 py-px bg-control text-ink-3">{stageLabel(c.stage)}</span>
          {s && <span className="text-[10.5px] font-semibold rounded px-1.5 py-px flex items-center gap-1" style={{ background: s.bg, color: s.tone }}><Clock size={10} />{s.txt}</span>}
          {channelsOf(c).length > 1 && <span className="text-[10.5px] text-muted-3">{channelsOf(c).length} channels</span>}
          <span className="ml-auto">{c.assignee ? <span title={c.assignee} className="w-5 h-5 rounded-full bg-[#E8ECF3] text-[#15223B] text-[9px] font-bold flex items-center justify-center">{initials(c.assignee)}</span> : <span className="text-[10.5px] text-muted-3">Unassigned</span>}</span>
          {c.unread && <span className="w-2 h-2 rounded-full bg-accent-500" />}
        </div>
      </div>
    </button>
  )
}

/* ─────────── Thread ─────────── */

function Thread({ c, rightOpen, toggleRight }: { c: Conversation; rightOpen: boolean; toggleRight: () => void }) {
  const act = useActions()
  const read = oviRead(c)
  const scroller = useRef<HTMLDivElement>(null)
  const lastEmail = [...c.messages].reverse().find((x) => x.channel === 'email' && x.subject)
  const replyable: CommsChannel[] = (['whatsapp', 'sms', 'email', 'portal'] as CommsChannel[]).filter((k) => (k === 'email' ? !!c.email : k === 'portal' ? c.stage === 'customer' || c.stage === 'installing' : !!c.phone))
  const [via, setVia] = useState<CommsChannel | 'note'>(() => { const l = last(c).channel; return replyable.includes(l) ? l : replyable[0] ?? 'note' })
  const [draft, setDraft] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [allOpen, setAllOpen] = useState(false)
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }) }, [c.messages.length])

  const lastEmailId = lastEmail?.id
  const isOpen = (m: CommsMessage) => allOpen || expanded[m.id] || m.id === lastEmailId

  function send() {
    const body = draft.trim(); if (!body) return
    act.addCommsMessage(c.id, { id: `cm${Date.now()}`, channel: via === 'note' ? last(c).channel : via, dir: via === 'note' ? 'note' : 'out', author: ME, body, at: Date.now(), subject: via === 'email' && lastEmail ? `Re: ${lastEmail.subject?.replace(/^Re: /, '')}` : undefined })
    if (via !== 'note' && !c.assignee) act.updateConversation(c.id, { assignee: ME })
    setDraft('')
    act.toast(via === 'note' ? 'Internal note added' : `Logged as ${CH[via].label} reply. Sending goes live once ${CH[via].label} is connected`, via === 'note' ? 'positive' : 'accent')
  }

  const outlook = c.email ? `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(c.email)}&subject=${encodeURIComponent(lastEmail ? `Re: ${lastEmail.subject?.replace(/^Re: /, '')}` : 'The Solar House')}` : null
  const wa = c.phone ? `https://wa.me/${c.phone.replace(/\D/g, '')}` : null

  let lastDay = ''
  return (
    <section className="flex-1 flex flex-col min-w-0 bg-[#F7F8FA]">
      {/* header */}
      <div className="h-[68px] shrink-0 bg-surface border-b border-border px-5 flex items-center gap-3">
        <ChannelAvatar c={c} size={38} />
        <div className="min-w-[110px] flex-1">
          <div className="flex items-center gap-2"><span className="text-[15.5px] font-bold text-ink truncate">{c.name}</span>
            <button onClick={() => act.updateConversation(c.id, { starred: !c.starred })} title="Star"><Star size={15} className={c.starred ? 'text-[#F59E0B]' : 'text-muted-3 hover:text-ink-3'} /></button>
          </div>
          <div className="text-[12px] text-muted-2 truncate flex items-center gap-1.5">{channelsOf(c).map((k) => <span key={k} className="flex items-center gap-1" style={{ color: CH[k].color }}><SmallIcon k={k} /></span>)}<span>· {c.address?.split(',').slice(-1)[0]?.trim()}</span></div>
        </div>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {outlook && <a href={outlook} target="_blank" rel="noreferrer" className="h-8 px-3 rounded-control border border-border bg-surface text-[12.5px] font-semibold text-[#0A64AD] hover:bg-[#E7F0FA] flex items-center gap-1.5" title="Opens the conversation in Outlook to reply there"><Envelope size={14} /><span className="hidden xl:inline">Open in Outlook</span></a>}
          {wa && <a href={wa} target="_blank" rel="noreferrer" className="h-8 px-3 rounded-control border border-border bg-surface text-[12.5px] font-semibold text-[#1DA851] hover:bg-[#E6F7EC] flex items-center gap-1.5"><WhatsAppIcon size={14} /><span className="hidden xl:inline">WhatsApp</span></a>}
          {c.phone && <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="w-8 h-8 rounded-control border border-border bg-surface text-ink-3 hover:bg-control flex items-center justify-center" title={`Call ${c.phone}`}><Phone size={14} /></a>}
          <div className="w-px h-6 bg-divider mx-1" />
          <select value={c.assignee ?? ''} onChange={(e) => act.updateConversation(c.id, { assignee: e.target.value || undefined })} className="h-8 px-2 rounded-control border border-border bg-surface text-[12.5px] text-ink-3 outline-none focus:border-accent" title="Assign">
            <option value="">Unassigned</option>{TEAM.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <IconBtn title={c.status === 'snoozed' ? 'Unsnooze' : 'Snooze until tomorrow'} on={c.status === 'snoozed'} onClick={() => act.updateConversation(c.id, { status: c.status === 'snoozed' ? 'open' : 'snoozed' })}><Clock size={15} /></IconBtn>
          <button onClick={() => act.updateConversation(c.id, { status: c.status === 'done' ? 'open' : 'done' })} className={classNames('h-8 px-3 rounded-control text-[12.5px] font-semibold flex items-center gap-1.5', c.status === 'done' ? 'bg-control text-ink-3' : 'bg-accent-gradient text-white shadow-primary')}><Check size={14} />{c.status === 'done' ? 'Reopen' : 'Done'}</button>
          <IconBtn title={rightOpen ? 'Hide customer panel' : 'Show customer panel'} on={rightOpen} onClick={toggleRight}><Person size={15} /></IconBtn>
        </div>
      </div>

      {/* messages */}
      <div ref={scroller} className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-[760px] mx-auto flex flex-col gap-3">
          {c.messages.some((x) => x.channel === 'email') && (
            <div className="flex justify-end"><button onClick={() => setAllOpen((o) => !o)} className="text-[11.5px] font-semibold text-muted-b hover:text-ink-3 flex items-center gap-1"><ChevronDown size={13} className={allOpen ? 'rotate-180' : ''} />{allOpen ? 'Collapse all emails' : 'Expand all emails'}</button></div>
          )}
          {c.messages.map((x) => {
            const d = dayLabel(x.at)
            const sep = d !== lastDay ? (lastDay = d, <div key={`d-${x.id}`} className="flex items-center gap-3 my-1"><span className="h-px flex-1 bg-border" /><span className="text-[11px] font-semibold text-muted-3">{d}</span><span className="h-px flex-1 bg-border" /></div>) : null
            return <div key={x.id} className="flex flex-col gap-3">{sep}<Message m={x} name={c.name} open={isOpen(x)} toggle={() => setExpanded((e) => ({ ...e, [x.id]: !isOpen(x) }))} /></div>
          })}
        </div>
      </div>

      {/* Ovi + composer */}
      <div className="shrink-0 bg-surface border-t border-border px-5 pt-3 pb-4">
        <div className="max-w-[760px] mx-auto">
          <div className="rounded-xl bg-gradient-to-r from-[#EAF6F2] to-[#F4FBF9] border border-border-blue px-3.5 py-2.5 flex items-start gap-2.5 mb-3">
            <span className="w-6 h-6 rounded-md bg-accent-gradient text-white flex items-center justify-center shrink-0 mt-0.5"><Sparkle size={13} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="text-[12px] font-bold text-accent-700">Ovi</span><span className="text-[10.5px] font-semibold rounded px-1.5 py-px bg-white" style={{ color: read.tone }}>{read.intent}</span></div>
              <div className="text-[12.5px] text-ink-3 leading-snug mt-0.5">{read.summary}</div>
            </div>
            <button onClick={() => setDraft(read.replies[0])} className="h-7 px-2.5 rounded-md bg-white border border-border-blue text-[11.5px] font-semibold text-accent shrink-0 hover:bg-accent-wash">Use suggested reply</button>
          </div>
          <div className="rounded-xl border border-input-border focus-within:border-accent bg-white overflow-hidden">
            <div className="flex items-center gap-1 px-2 pt-2">
              <span className="text-[11.5px] text-muted-2 px-1">Reply via</span>
              {replyable.map((k) => (
                <button key={k} onClick={() => setVia(k)} className={classNames('h-7 px-2.5 rounded-md text-[12px] font-semibold flex items-center gap-1.5 transition-colors', via === k ? 'text-white' : 'text-ink-3 hover:bg-control')} style={via === k ? { background: CH[k].color } : undefined}><SmallIcon k={k} />{CH[k].label}</button>
              ))}
              <button onClick={() => setVia('note')} className={classNames('h-7 px-2.5 rounded-md text-[12px] font-semibold flex items-center gap-1.5', via === 'note' ? 'bg-[#FEF3C7] text-[#92400E]' : 'text-ink-3 hover:bg-control')}><Note size={13} />Internal note</button>
            </div>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }} rows={3}
              placeholder={via === 'note' ? 'Add a note for the team, never sent to the customer…' : `Message ${c.name.split(' ')[0]} on ${CH[via as CommsChannel].label}…`}
              className={classNames('w-full px-3 py-2 text-[13.5px] outline-none resize-none', via === 'note' && 'bg-[#FFFBEB]')} />
            <div className="flex items-center gap-2 px-2 pb-2">
              {read.replies.slice(0, 2).map((r, i) => <button key={i} onClick={() => setDraft(r)} className="h-7 max-w-[220px] px-2.5 rounded-full bg-control text-[11.5px] text-ink-3 truncate hover:bg-accent-wash hover:text-accent">{r}</button>)}
              <span className="ml-auto text-[11px] text-muted-3 hidden lg:block">Ctrl+Enter to send</span>
              <button onClick={send} disabled={!draft.trim()} className="h-8 px-3.5 rounded-control bg-accent-gradient text-white text-[12.5px] font-semibold flex items-center gap-1.5 disabled:opacity-40"><Send size={13} />{via === 'note' ? 'Add note' : 'Send'}</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SmallIcon({ k }: { k: CommsChannel }) { const I = CH[k].icon; return <I size={13} /> }

function Message({ m, name, open, toggle }: { m: CommsMessage; name: string; open: boolean; toggle: () => void }) {
  const ch = CH[m.channel]
  const mine = m.dir === 'out'
  if (m.dir === 'note') {
    return (
      <div className="self-center w-full max-w-[640px] rounded-xl bg-[#FFFBEB] border border-[#FDE68A] px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-[11.5px] text-[#92400E] font-semibold"><Note size={13} />Internal note · {m.author}<span className="ml-auto font-normal text-[#B45309]">{clock(m.at)}</span></div>
        <div className="text-[13px] text-[#78350F] mt-1 whitespace-pre-wrap">{m.body}</div>
      </div>
    )
  }
  if (m.channel === 'email') {
    return (
      <div className={classNames('rounded-xl bg-white border shadow-card overflow-hidden', mine ? 'border-border ml-10' : 'border-border mr-10')}>
        <button onClick={toggle} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#FAFBFC]">
          <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: mine ? '#E6F6F1' : ch.wash, color: mine ? '#0E7A66' : ch.color }}>{initials(m.author)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><span className="text-[13px] font-semibold text-ink-2">{m.author}</span><span className="text-[11px] text-muted-3">{mine ? `to ${name}` : 'to you'}</span></div>
            <div className="text-[12px] text-muted-2 truncate">{open ? m.subject : m.body.replace(/\n+/g, ' ')}</div>
          </div>
          <span className="flex items-center gap-1 text-[11px] font-semibold shrink-0" style={{ color: ch.color }}><Envelope size={12} />Email</span>
          <span className="text-[11px] text-muted-3 shrink-0">{clock(m.at)}</span>
          <ChevronDown size={14} className={classNames('text-muted-3 transition-transform', !open && '-rotate-90')} />
        </button>
        {open && <div className="px-4 pb-4 pl-[60px] text-[13.5px] leading-[1.65] text-ink-2 whitespace-pre-wrap border-t border-divider-row pt-3">{m.body}</div>}
      </div>
    )
  }
  if (m.channel === 'call') {
    const missed = !m.callSecs
    return (
      <div className={classNames('rounded-xl border px-4 py-3 max-w-[520px] bg-white', mine ? 'self-end' : 'self-start')} style={{ borderColor: missed ? '#FBCFD9' : '#E4E8EE' }}>
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: missed ? '#FDECEF' : '#FDF3E3', color: missed ? '#B01B4F' : '#D97706' }}><Phone size={15} /></span>
          <div className="flex-1"><div className="text-[13px] font-semibold text-ink-2">{missed ? 'Missed call' : mine ? `Outbound call by ${m.author}` : 'Inbound call'}</div><div className="text-[11.5px] text-muted-2">{missed ? 'No answer' : `${Math.floor((m.callSecs ?? 0) / 60)}m ${(m.callSecs ?? 0) % 60}s`} · {clock(m.at)}</div></div>
        </div>
        {m.voicemail && <div className="mt-2.5 rounded-lg bg-control px-3 py-2"><div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-3 mb-0.5">Voicemail · transcribed</div><div className="text-[13px] text-ink-2 italic">“{m.voicemail}”</div></div>}
      </div>
    )
  }
  if (m.channel === 'web') {
    const rows = m.body.split('\n').map((l) => l.split(/:\s(.+)/)).filter((r) => r.length > 1)
    return (
      <div className="self-start w-full max-w-[560px] rounded-xl bg-white border border-border shadow-card overflow-hidden">
        <div className="px-4 py-2.5 flex items-center gap-2 border-b border-divider-row" style={{ background: ch.wash }}><Grid size={14} className="text-accent" /><span className="text-[12.5px] font-semibold text-accent-700">{m.author}</span><span className="ml-auto text-[11px] text-muted-2">{clock(m.at)}</span></div>
        <div className="px-4 py-3 grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5">{rows.flatMap(([k, v]) => [<span key={`k${k}`} className="text-[12px] text-muted-2">{k}</span>, <span key={`v${k}`} className="text-[13px] text-ink-2 font-medium">{v}</span>])}</div>
      </div>
    )
  }
  // chat-style: WhatsApp, SMS, social, portal
  return (
    <div className={classNames('flex flex-col max-w-[520px]', mine ? 'self-end items-end' : 'self-start items-start')}>
      <div className={classNames('rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-snug whitespace-pre-wrap shadow-card', mine ? 'rounded-br-md text-white' : 'rounded-bl-md bg-white border border-border text-ink-2')} style={mine ? { background: m.author.startsWith('Ovi') ? 'linear-gradient(135deg,#1FAE94,#0E7A66)' : ch.color } : undefined}>{m.body}</div>
      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-3"><span style={{ color: ch.color }} className="flex items-center gap-1 font-semibold"><SmallIcon k={m.channel} />{ch.label}</span>· {mine ? m.author : ''} {clock(m.at)}</div>
    </div>
  )
}

/* ─────────── Customer context ─────────── */

function ContextPanel({ c }: { c: Conversation }) {
  const act = useActions()
  const nav = useNavigate()
  const idx = STAGES.findIndex((s) => s.id === c.stage)
  const firstAt = c.messages[0]?.at
  const inbound = c.messages.filter((x) => x.dir === 'in').length
  return (
    <aside className="w-[312px] shrink-0 bg-surface border-l border-border overflow-y-auto">
      <div className="p-5 border-b border-divider text-center">
        <span className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-[18px] font-bold bg-accent-wash text-accent">{initials(c.name)}</span>
        <div className="text-[15px] font-bold text-ink mt-2">{c.name}</div>
        <div className="text-[12px] text-muted-2">{c.source ? `Came in via ${c.source}` : 'Homeowner'}</div>
        {c.valueHint ? <div className="inline-flex mt-2 text-[12px] font-semibold text-positive bg-positive-wash rounded-full px-2.5 py-0.5">~{money(c.valueHint)} system</div> : null}
      </div>
      <Block title="Contact">
        {c.phone && <Line icon={Phone}><a href={`tel:${c.phone.replace(/\s/g, '')}`} className="hover:text-accent">{c.phone}</a></Line>}
        {c.email && <Line icon={Envelope}><a href={`mailto:${c.email}`} className="hover:text-accent truncate">{c.email}</a></Line>}
        {c.address && <Line icon={MapPin}><a href={`https://www.google.com/maps/search/${encodeURIComponent(c.address)}`} target="_blank" rel="noreferrer" className="hover:text-accent">{c.address}</a></Line>}
      </Block>
      <Block title="Journey">
        <div className="flex flex-col gap-1.5">
          {STAGES.map((s, i) => (
            <button key={s.id} onClick={() => act.updateConversation(c.id, { stage: s.id })} className="flex items-center gap-2.5 text-left group">
              <span className={classNames('w-4 h-4 rounded-full flex items-center justify-center shrink-0', i < idx ? 'bg-accent text-white' : i === idx ? 'ring-4 ring-accent-wash bg-accent' : 'border-2 border-border')}>{i < idx && <Check size={9} />}</span>
              <span className={classNames('text-[12.5px]', i === idx ? 'font-bold text-ink' : i < idx ? 'text-ink-3' : 'text-muted-3 group-hover:text-ink-3')}>{s.label}</span>
            </button>
          ))}
        </div>
      </Block>
      <Block title="Quick actions">
        <div className="grid grid-cols-2 gap-1.5">
          <QA icon={Task} label="Create task" onClick={() => { act.addActivity({ type: 'task', subject: `Follow up with ${c.name}`, who: c.assignee ?? ME, due: 'Today' }); act.toast('Task added to My Tasks') }} />
          <QA icon={Calendar} label="Book survey" onClick={() => { act.updateConversation(c.id, { stage: 'survey' }); act.toast('Moved to Survey. Pick a slot in the booking calendar', 'accent'); nav('/showroom/calendar') }} />
          <QA icon={Bolt} label="Add as lead" onClick={() => { act.addLead({ name: c.name, company: c.address ?? c.name, role: 'Homeowner', source: c.source ?? 'Inbox', phone: c.phone, email: c.email, value: c.valueHint }); act.toast('Added to Leads') }} />
          <QA icon={Home} label="Design roof" onClick={() => nav('/design')} />
        </div>
      </Block>
      <Block title="Conversation">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Mini v={String(c.messages.filter((x) => x.dir !== 'note').length)} l="messages" />
          <Mini v={String(channelsOf(c).length)} l="channels" />
          <Mini v={String(inbound)} l="from them" />
        </div>
        {firstAt && <div className="text-[11.5px] text-muted-2 mt-2.5">First contact {new Date(firstAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>}
      </Block>
    </aside>
  )
}
function Block({ title, children }: { title: string; children: ReactNode }) {
  return <div className="px-5 py-4 border-b border-divider"><div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-3 mb-2.5">{title}</div>{children}</div>
}
function Line({ icon: I, children }: { icon: Icon; children: ReactNode }) {
  return <div className="flex items-start gap-2.5 text-[12.5px] text-ink-3 py-1"><I size={14} className="text-muted-3 shrink-0 mt-0.5" /><span className="min-w-0">{children}</span></div>
}
function QA({ icon: I, label, onClick }: { icon: Icon; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="h-9 rounded-lg border border-border text-[12px] font-semibold text-ink-3 hover:border-accent hover:text-accent hover:bg-accent-wash flex items-center justify-center gap-1.5 transition-colors"><I size={13} />{label}</button>
}
function Mini({ v, l }: { v: string; l: string }) {
  return <div className="rounded-lg bg-control py-2"><div className="text-[15px] font-bold text-ink leading-none">{v}</div><div className="text-[10.5px] text-muted-2 mt-1">{l}</div></div>
}
function IconBtn({ title, on, onClick, children }: { title: string; on?: boolean; onClick: () => void; children: ReactNode }) {
  return <button title={title} onClick={onClick} className={classNames('w-8 h-8 rounded-control border flex items-center justify-center transition-colors', on ? 'border-accent bg-accent-wash text-accent' : 'border-border bg-surface text-ink-3 hover:bg-control')}>{children}</button>
}
