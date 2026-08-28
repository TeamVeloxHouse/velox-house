import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button, Chip } from '../components/ui'
import {
  Sparkle, Send, Plus, Check, Megaphone, Star, Users, Robot, File, Video, Envelope, Target, Clock, Bolt,
} from '../components/icons'
import { classNames, initials, money } from '../lib/format'
import { useState_, useActions } from '../store/store'
import { AI_MEMBER_ID, YOU_MEMBER_ID } from '../store/types'
import type { TeamAiBlock, TeamChannel, TeamMessage, TeamMember, Announcement, AnnouncementKind, TeamActionRef } from '../store/types'
import { useTeamChat } from '../components/useTeamChat'

/* ---------- small helpers ---------- */
function ago(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
const presenceColor: Record<TeamMember['status'], string> = { online: '#0E9F6E', away: '#E8721A', dnd: '#B01B4F', offline: '#B6BECC' }
const REACTIONS = ['👍', '🎉', '🙌', '🔥', '😄', '👀']

function MemberAvatar({ m, size = 32, ring }: { m?: TeamMember; size?: number; ring?: boolean }) {
  if (!m) return null
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {m.bot ? (
        <span className="inline-flex items-center justify-center rounded-[9px] text-white shadow-primary" style={{ width: size, height: size, background: 'linear-gradient(180deg,#3B6BF5 0%,#1D4ED8 100%)' }}>
          <Sparkle size={Math.round(size * 0.52)} />
        </span>
      ) : (
        <span className="inline-flex items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, background: m.color, fontSize: Math.round(size * 0.38) }}>
          {initials(m.name)}
        </span>
      )}
      {ring && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface" style={{ background: presenceColor[m.status] }} />}
    </span>
  )
}

/* ---------- rich chat text: **bold** + @mentions ---------- */
function ChatText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|@TellOvi AI|@ai\b)/gi)
  return (
    <span className="whitespace-pre-wrap leading-relaxed">
      {parts.map((p, i) => {
        if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>
        if (/^@tellovi ai$/i.test(p) || /^@ai$/i.test(p)) return <span key={i} className="font-semibold text-accent bg-accent-wash rounded px-1">{p}</span>
        return <span key={i}>{p}</span>
      })}
    </span>
  )
}

/* ---------- AI answer blocks (answers + visuals) ---------- */
function AiBlocks({ blocks }: { blocks: TeamAiBlock[] }) {
  return (
    <div className="flex flex-col gap-2.5 mt-1">
      {blocks.map((b, i) => <AiBlock key={i} b={b} />)}
    </div>
  )
}
function AiBlock({ b }: { b: TeamAiBlock }) {
  if (b.type === 'text') return <p className="text-[13.5px] text-ink-3"><ChatText text={b.text} /></p>
  if (b.type === 'stats')
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {b.items.map((s, i) => (
          <div key={i} className="bg-surface border border-border rounded-lg p-2.5">
            <div className="text-[11px] text-muted-2">{s.label}</div>
            <div className={classNames('text-[15px] font-bold mt-0.5', s.tone === 'positive' && 'text-positive', s.tone === 'negative' && 'text-negative', s.tone === 'muted' && 'text-muted-b', !s.tone && 'text-ink')}>{s.value}</div>
          </div>
        ))}
      </div>
    )
  if (b.type === 'bars') {
    const max = Math.max(1, ...b.items.map((x) => x.value))
    const barColor = (t?: string) => (t === 'warning' ? '#E8721A' : t === 'positive' ? '#0E9F6E' : '#3B6BF5')
    return (
      <div className="bg-surface border border-border rounded-card p-3.5">
        {b.title && <div className="text-[12px] font-semibold text-ink-2 mb-2.5">{b.title}</div>}
        <div className="flex flex-col gap-2">
          {b.items.map((it, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-[110px] shrink-0 text-[12px] text-muted-b truncate text-right">{it.label}</div>
              <div className="flex-1 h-[22px] bg-control rounded-md overflow-hidden">
                <div className="h-full rounded-md flex items-center justify-end pr-2 min-w-[36px] transition-all" style={{ width: `${Math.max(8, (it.value / max) * 100)}%`, background: barColor(it.tone) }}>
                  <span className="text-[11px] font-bold text-white whitespace-nowrap">{it.display}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (b.type === 'agenda')
    return (
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <div className="px-3.5 py-2 border-b border-divider bg-surface-tint text-[12px] font-semibold text-accent-700 flex items-center gap-1.5"><File size={13} /> {b.title}</div>
        <ol className="py-1.5">
          {b.items.map((it, i) => (
            <li key={i} className="flex items-start gap-2.5 px-3.5 py-1.5">
              <span className="mt-px w-5 h-5 rounded-md bg-accent-wash text-accent text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="text-[13px] text-ink-2">{it}</span>
            </li>
          ))}
        </ol>
      </div>
    )
  if (b.type === 'tasks')
    return (
      <div className="flex flex-col gap-1.5">
        {b.items.map((t, i) => (
          <div key={i} className="flex items-start gap-2.5 bg-surface border border-border rounded-lg p-2.5">
            <span className="mt-0.5 w-4 h-4 rounded-md border border-input-border shrink-0" />
            <div className="min-w-0"><div className="text-[13px] font-medium text-ink-2">{t.label}</div><div className="text-[12px] text-muted-2">{t.meta}</div></div>
          </div>
        ))}
      </div>
    )
  if (b.type === 'email')
    return (
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-3.5 py-2 border-b border-divider bg-surface-tint text-[12px] flex flex-col gap-0.5">
          <div><span className="text-muted-2">To</span> <span className="text-ink-2 font-medium">{b.to}</span></div>
          <div><span className="text-muted-2">Subject</span> <span className="text-ink-2 font-semibold">{b.subject}</span></div>
        </div>
        <div className="px-3.5 py-3 text-[13px] text-ink-2 whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto">{b.body}</div>
      </div>
    )
  return null
}

const actionIcon: Record<TeamActionRef['kind'], typeof File> = { task: Check, deck: File, meeting: Video, email: Envelope, doc: File, campaign: Target }

/* ---------- one chat message ---------- */
function MessageRow({ msg, channel, onHandle, onReact }: { msg: TeamMessage; channel: TeamChannel; onHandle: () => void; onReact: (emoji: string) => void }) {
  const nav = useNavigate()
  const { teamMembers } = useState_()
  const [picker, setPicker] = useState(false)
  const author = teamMembers.find((m) => m.id === msg.authorId)
  const isAi = msg.authorId === AI_MEMBER_ID
  const isYou = msg.authorId === YOU_MEMBER_ID
  const actionable = !isAi && !isYou && !msg.handled && channel.ai &&
    /\b(prepare|draft|write|book|schedule|set up|create|send|pull together|put together|can you|could you|would you|please)\b/i.test(msg.text)

  return (
    <div className="group flex gap-2.5 px-1">
      <MemberAvatar m={author} size={34} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-bold text-ink-2">{author?.name}</span>
          {isAi && <Chip tone="accent" dot>AI</Chip>}
          {author?.boss && <Chip tone="neutral">{author.role}</Chip>}
          <span className="text-[11.5px] text-muted-3">{ago(msg.createdAt)}</span>
        </div>
        {msg.text && <div className="text-[13.5px] text-ink-3 mt-0.5"><ChatText text={msg.text} /></div>}
        {msg.ai && msg.ai.length > 0 && <AiBlocks blocks={msg.ai} />}

        {/* things the AI did, as openable chips */}
        {msg.actions && msg.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {msg.actions.map((a, i) => {
              const Icon = actionIcon[a.kind]
              return (
                <button key={i} onClick={() => a.to && nav(a.to)} className="h-8 px-3 rounded-lg text-[12.5px] font-medium border border-positive-border bg-positive-wash text-positive flex items-center gap-1.5 hover:brightness-95 transition">
                  <Icon size={13} /> {a.label}
                </button>
              )
            })}
          </div>
        )}

        {/* AI reads a teammate's request and acts on it */}
        {actionable && (
          <button onClick={onHandle} className="mt-2 h-8 px-3 rounded-lg text-[12.5px] font-semibold border border-border-blue bg-accent-wash text-accent flex items-center gap-1.5 hover:bg-[#E4ECFB] transition">
            <Sparkle size={13} /> Let TellOvi AI handle this
          </button>
        )}

        {/* reactions */}
        <div className="flex items-center gap-1.5 mt-1.5">
          {(msg.reactions ?? []).map((r) => {
            const mine = r.by.includes(YOU_MEMBER_ID)
            return (
              <button key={r.emoji} onClick={() => onReact(r.emoji)} className={classNames('h-6 px-2 rounded-full text-[12px] flex items-center gap-1 border transition', mine ? 'bg-accent-wash border-border-blue text-accent' : 'bg-surface border-border text-muted-b hover:bg-control')}>
                <span>{r.emoji}</span><span className="font-semibold">{r.by.length}</span>
              </button>
            )
          })}
          <div className="relative">
            <button onClick={() => setPicker((o) => !o)} className="h-6 w-6 rounded-full border border-border text-muted-3 hover:text-ink-3 hover:bg-control flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-[13px]">☺</button>
            {picker && (
              <div className="absolute z-20 bottom-8 left-0 bg-surface border border-border rounded-xl shadow-modal p-1 flex gap-0.5">
                {REACTIONS.map((e) => (
                  <button key={e} onClick={() => { onReact(e); setPicker(false) }} className="w-8 h-8 rounded-lg hover:bg-control text-[16px]">{e}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- composer ---------- */
function Composer({ placeholder, onSend, disabled }: { placeholder: string; onSend: (t: string) => void; disabled?: boolean }) {
  const [v, setV] = useState('')
  function submit() { if (!v.trim() || disabled) return; onSend(v.trim()); setV('') }
  return (
    <div className="bg-surface border border-border rounded-2xl flex items-end gap-2 p-2 shadow-card">
      <button onClick={() => setV((x) => (x.startsWith('@TellOvi AI ') ? x : '@TellOvi AI ' + x))} title="Mention TellOvi AI" className="w-9 h-9 rounded-xl border border-border-blue bg-accent-wash text-accent hover:bg-[#E4ECFB] flex items-center justify-center shrink-0"><Sparkle size={16} /></button>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
        rows={1}
        placeholder={placeholder}
        className="flex-1 resize-none outline-none bg-transparent text-[14px] text-ink-2 placeholder:text-muted-3 px-1.5 py-1.5 max-h-32"
      />
      <button onClick={submit} disabled={!v.trim() || disabled} className="w-9 h-9 rounded-xl bg-accent-gradient text-white flex items-center justify-center shadow-primary disabled:opacity-40 disabled:shadow-none shrink-0"><Send size={16} /></button>
    </div>
  )
}

/* ---------- AI working indicator ---------- */
function Working({ steps, i }: { steps: string[]; i: number }) {
  return (
    <div className="flex gap-2.5 px-1">
      <MemberAvatar m={{ id: AI_MEMBER_ID, name: 'TellOvi AI', role: '', color: '#3B6BF5', status: 'online', bot: true }} size={34} />
      <div className="rounded-card border border-border bg-surface-tint overflow-hidden py-1 min-w-[260px]">
        {steps.map((s, si) => (
          <div key={si} className="flex items-center gap-2.5 px-3.5 py-1.5">
            <span className="shrink-0">
              {si < i ? <span className="w-4 h-4 rounded-full bg-positive flex items-center justify-center"><Check size={11} className="text-white" strokeWidth={3} /></span>
                : si === i ? <span className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin inline-block" />
                  : <span className="w-4 h-4 rounded-full border-2 border-input-border inline-block" />}
            </span>
            <span className={classNames('text-[13px]', si < i ? 'text-ink-2 font-medium' : si === i ? 'text-ink-2 font-semibold' : 'text-muted-3')}>{s}{si === i && ' …'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ================= Announcements board ================= */
const annStyle: Record<AnnouncementKind, { label: string; chip: 'positive' | 'accent' | 'warning' | 'neutral'; icon: typeof Star }> = {
  win: { label: 'Win', chip: 'positive', icon: Star },
  news: { label: 'News', chip: 'accent', icon: Megaphone },
  update: { label: 'Update', chip: 'neutral', icon: Bolt },
  shoutout: { label: 'Shoutout', chip: 'warning', icon: Users },
}

function AnnouncementsBoard() {
  const { announcements, teamMembers } = useState_()
  const act = useActions()
  const member = (id: string) => teamMembers.find((m) => m.id === id)
  const sorted = [...announcements].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt)
  const latestWin = sorted.find((a) => a.kind === 'win')
  const rest = sorted.filter((a) => a.id !== latestWin?.id)

  const [kind, setKind] = useState<AnnouncementKind>('win')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [val, setVal] = useState('')
  function post() {
    if (!title.trim()) return
    act.postAnnouncement(kind, title.trim(), body.trim(), val ? Number(val) : undefined)
    setTitle(''); setBody(''); setVal('')
  }

  function CheerRow({ a }: { a: Announcement }) {
    const cheered = a.cheers.includes(YOU_MEMBER_ID)
    return (
      <button onClick={() => act.toggleCheer(a.id)} className={classNames('h-8 px-3 rounded-full text-[12.5px] font-semibold border flex items-center gap-1.5 transition', cheered ? 'bg-accent-wash border-border-blue text-accent' : 'bg-surface border-border text-muted-b hover:bg-control')}>
        🎉 <span>{a.cheers.length > 0 ? a.cheers.length : ''} {cheered ? 'Cheered' : 'Cheer'}</span>
      </button>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[820px] mx-auto px-7 py-7 flex flex-col gap-6">
        {/* Latest win — the hero */}
        {latestWin && (
          <div className="rounded-card overflow-hidden text-white shadow-primary" style={{ background: 'linear-gradient(135deg,#0E7C66 0%,#0B5C4C 55%,#0A3F45 100%)' }}>
            <div className="p-6">
              <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide opacity-90"><Star size={15} /> Latest win</div>
              <div className="text-[26px] font-bold tracking-[-0.02em] mt-2">{latestWin.title}</div>
              {latestWin.value != null && <div className="text-[15px] font-semibold mt-1 opacity-90">{money(latestWin.value)} closed</div>}
              <p className="text-[14px] mt-3 leading-relaxed opacity-95 max-w-[640px]">{latestWin.body}</p>
              <div className="flex items-center gap-3 mt-4">
                <div className="flex items-center gap-2 text-[12.5px] opacity-90">Posted by {member(latestWin.authorId)?.name} · {ago(latestWin.createdAt)}</div>
                <button onClick={() => act.toggleCheer(latestWin.id)} className={classNames('h-8 px-3 rounded-full text-[12.5px] font-semibold flex items-center gap-1.5 transition', latestWin.cheers.includes(YOU_MEMBER_ID) ? 'bg-white text-positive' : 'bg-white/15 text-white hover:bg-white/25')}>
                  🎉 <span>{latestWin.cheers.length} {latestWin.cheers.includes(YOU_MEMBER_ID) ? 'Cheered' : 'Cheer'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Post composer */}
        <div className="bg-surface border border-border rounded-card p-4">
          <div className="text-[13px] font-bold text-ink mb-2.5">Post to the board</div>
          <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
            {(Object.keys(annStyle) as AnnouncementKind[]).map((k) => (
              <button key={k} onClick={() => setKind(k)} className={classNames('h-8 px-3 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5 border transition', kind === k ? 'bg-accent-wash border-border-blue text-accent' : 'border-border text-muted-b hover:bg-control')}>
                {annStyle[k].label}
              </button>
            ))}
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'win' ? 'e.g. Meridian Group — £90k closed 🎉' : 'Title'} className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-[13.5px] text-ink-2 outline-none focus:border-border-blue mb-2" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Add the detail — who, what, why it matters…" className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-[13.5px] text-ink-2 outline-none focus:border-border-blue resize-none mb-2" />
          <div className="flex items-center gap-2">
            {kind === 'win' && <input value={val} onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Deal value £" className="h-9 w-40 px-3 rounded-lg border border-border bg-surface text-[13px] text-ink-2 outline-none focus:border-border-blue" />}
            <div className="ml-auto"><Button variant="primary" icon={<Send size={15} />} onClick={post}>Post</Button></div>
          </div>
        </div>

        {/* Feed */}
        <div className="flex flex-col gap-3">
          {rest.map((a) => {
            const st = annStyle[a.kind]
            return (
              <div key={a.id} className="bg-surface border border-border rounded-card p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={classNames('w-7 h-7 rounded-lg flex items-center justify-center', a.kind === 'win' ? 'bg-positive-wash text-positive' : a.kind === 'shoutout' ? 'bg-[#FDF1E7] text-[#C2410C]' : a.kind === 'news' ? 'bg-accent-wash text-accent' : 'bg-control text-muted-b')}><st.icon size={15} /></span>
                  <Chip tone={st.chip}>{st.label}</Chip>
                  <span className="text-[11.5px] text-muted-3 ml-auto">{member(a.authorId)?.name} · {ago(a.createdAt)}</span>
                </div>
                <div className="text-[15px] font-bold text-ink">{a.title}</div>
                {a.value != null && <div className="text-[13px] font-semibold text-positive mt-0.5">{money(a.value)}</div>}
                <p className="text-[13.5px] text-ink-3 mt-1.5 leading-relaxed">{a.body}</p>
                <div className="mt-3"><CheerRow a={a} /></div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ================= Channel chat ================= */
function ChannelView({ channel }: { channel: TeamChannel }) {
  const act = useActions()
  const scroller = useRef<HTMLDivElement>(null)
  const { msgs, members, work, send, handle } = useTeamChat(channel)

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }) }, [msgs.length, work])

  const kindLabel = channel.kind === 'dm' ? 'Direct message' : channel.kind === 'group' ? 'Group' : 'Channel'
  const heading = channel.kind === 'channel' ? `# ${channel.name}` : channel.name

  return (
    <div className="flex-1 flex min-h-0">
      <div className="flex-1 flex flex-col min-w-0">
        {/* channel header */}
        <div className="h-[52px] shrink-0 border-b border-border bg-surface flex items-center gap-3 px-6">
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-ink truncate flex items-center gap-2">{heading}{channel.ai && <Chip tone="accent" dot>TellOvi AI is in here</Chip>}</div>
          </div>
          {channel.topic && <div className="text-[12.5px] text-muted-2 truncate hidden md:block border-l border-divider pl-3">{channel.topic}</div>}
          <div className="ml-auto flex -space-x-1.5">
            {members.slice(0, 6).map((m) => <MemberAvatar key={m.id} m={m} size={26} />)}
          </div>
        </div>

        {/* messages */}
        <div ref={scroller} className="flex-1 overflow-y-auto px-5 py-5">
          <div className="max-w-[780px] mx-auto flex flex-col gap-5">
            {msgs.length === 0 && (
              <div className="text-center text-muted-2 text-[13px] py-10">This is the start of your conversation.{channel.ai && ' @mention TellOvi AI to get answers, visuals or have it action a request.'}</div>
            )}
            {msgs.map((m) => <MessageRow key={m.id} msg={m} channel={channel} onHandle={() => handle(m)} onReact={(e) => act.reactToMessage(m.id, e)} />)}
            {work && <Working steps={work.steps} i={work.i} />}
          </div>
        </div>

        {/* composer */}
        <div className="border-t border-border bg-canvas px-5 py-4">
          <div className="max-w-[780px] mx-auto">
            <Composer placeholder={channel.kind === 'dm' ? `Message ${channel.name}…` : `Message ${heading}…`} onSend={send} disabled={!!work} />
            <div className="text-[11px] text-muted-3 text-center mt-2">{kindLabel} · {members.length} members{channel.ai && ' · TellOvi AI can answer with live data and take action'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ================= Page shell ================= */
export function Team() {
  const { teamChannels, teamMembers } = useState_()
  const act = useActions()
  const [sel, setSel] = useState<string>('announcements')

  // keep the open channel marked read
  useEffect(() => { if (sel !== 'announcements') act.markChannelRead(sel) }, [sel, teamChannels.find((c) => c.id === sel)?.unread])

  const channels = teamChannels.filter((c) => c.kind === 'channel')
  const groups = teamChannels.filter((c) => c.kind === 'group')
  const dms = teamChannels.filter((c) => c.kind === 'dm')
  const totalUnread = teamChannels.reduce((s, c) => s + c.unread, 0)
  const selChannel = teamChannels.find((c) => c.id === sel)
  const member = (id: string) => teamMembers.find((m) => m.id === id)

  function NavBtn({ c }: { c: TeamChannel }) {
    const on = c.id === sel
    const other = c.kind === 'dm' ? member(c.memberIds.find((id) => id !== YOU_MEMBER_ID) || '') : undefined
    return (
      <button onClick={() => setSel(c.id)} className={classNames('w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-left transition-colors', on ? 'bg-accent-wash-2 text-accent-700 font-semibold' : 'text-ink-3 hover:bg-control')}>
        {c.kind === 'dm' ? <MemberAvatar m={other} size={22} ring /> : <span className={classNames('w-[22px] text-center shrink-0', on ? 'text-accent' : 'text-muted-3')}>{c.kind === 'group' ? <Users size={16} className="inline" /> : '#'}</span>}
        <span className="flex-1 truncate">{c.name}</span>
        {c.ai && <Sparkle size={12} className={on ? 'text-accent' : 'text-muted-3'} />}
        {c.unread > 0 && <span className="text-[10px] font-bold text-white bg-accent rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{c.unread}</span>}
      </button>
    )
  }

  function addChannel() {
    const name = window.prompt('New channel name')?.trim()
    if (name) { const c = act.addChannel(name.replace(/^#\s*/, ''), 'channel'); setSel(c.id) }
  }

  return (
    <>
      <TopBar
        title="Team"
        crumbs={['Your internal space']}
        actions={<Button icon={<Plus size={16} />} onClick={addChannel}>New channel</Button>}
      />
      <div className="flex-1 flex min-h-0">
        {/* channel list */}
        <aside className="w-[240px] shrink-0 bg-surface border-r border-border flex flex-col overflow-y-auto">
          <div className="p-3 flex-1 flex flex-col gap-4">
            <button onClick={() => setSel('announcements')} className={classNames('w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] font-semibold transition', sel === 'announcements' ? 'bg-accent-gradient text-white shadow-primary' : 'bg-accent-wash text-accent hover:bg-[#E4ECFB]')}>
              <Megaphone size={17} /> <span className="flex-1 text-left">Announcements</span>
            </button>

            <div>
              <div className="eyebrow text-muted-3 px-2.5 mb-1.5 flex items-center"><span className="flex-1">Channels</span><button onClick={addChannel} className="text-muted-3 hover:text-accent"><Plus size={13} /></button></div>
              <div className="flex flex-col gap-0.5">{channels.map((c) => <NavBtn key={c.id} c={c} />)}</div>
            </div>

            {groups.length > 0 && (
              <div>
                <div className="eyebrow text-muted-3 px-2.5 mb-1.5">Groups</div>
                <div className="flex flex-col gap-0.5">{groups.map((c) => <NavBtn key={c.id} c={c} />)}</div>
              </div>
            )}

            <div>
              <div className="eyebrow text-muted-3 px-2.5 mb-1.5">Direct messages</div>
              <div className="flex flex-col gap-0.5">{dms.map((c) => <NavBtn key={c.id} c={c} />)}</div>
            </div>
          </div>

          {/* roster */}
          <div className="p-3 border-t border-divider">
            <div className="eyebrow text-muted-3 px-1 mb-2">Team · {teamMembers.filter((m) => m.status === 'online').length} online</div>
            <div className="flex flex-col gap-1.5">
              {teamMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-2 px-1">
                  <MemberAvatar m={m} size={24} ring />
                  <div className="min-w-0"><div className="text-[12.5px] font-medium text-ink-2 truncate leading-tight">{m.name}{m.you && ' (you)'}</div><div className="text-[11px] text-muted-3 truncate leading-tight">{m.role}</div></div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* main */}
        {sel === 'announcements' || !selChannel ? <AnnouncementsBoard /> : <ChannelView key={selChannel.id} channel={selChannel} />}
      </div>
      {totalUnread > 0 && sel === 'announcements' && <span className="sr-only">{totalUnread} unread</span>}
    </>
  )
}
