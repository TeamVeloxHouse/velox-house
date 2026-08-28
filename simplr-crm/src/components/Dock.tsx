import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AiMessage, AiComposer, useChat } from './AiChat'
import { useTeamChat } from './useTeamChat'
import { Sparkle, Bars as Expand, Users, Send, Check } from './icons'
import { useState_, useActions } from '../store/store'
import { starterPrompts } from '../lib/ai'
import { YOU_MEMBER_ID, type TeamAiBlock, type TeamChannel, type TeamMessage } from '../store/types'
import { classNames } from '../lib/format'

type Win = { key: string; kind: 'ovi'; channelId?: undefined } | { key: string; kind: 'chat'; channelId: string }

/** The always-present bottom rail: Ask Ovi + dockable team chats that survive navigation. */
export function Dock() {
  const { teamChannels } = useState_()
  const [wins, setWins] = useState<Win[]>([])
  const [min, setMin] = useState<Record<string, boolean>>({})
  const [picker, setPicker] = useState(false)

  const openOvi = () => {
    setWins((w) => (w.some((x) => x.kind === 'ovi') ? w : [...w, { key: 'ovi', kind: 'ovi' }]))
    setMin((m) => ({ ...m, ovi: false }))
    capExpanded('ovi')
  }
  const openChat = (channelId: string) => {
    const key = `chat:${channelId}`
    setWins((w) => (w.some((x) => x.key === key) ? w : [...w, { key, kind: 'chat', channelId }]))
    setMin((m) => ({ ...m, [key]: false }))
    setPicker(false)
    capExpanded(key)
  }
  const close = (key: string) => setWins((w) => w.filter((x) => x.key !== key))
  const toggleMin = (key: string) => setMin((m) => ({ ...m, [key]: !m[key] }))
  // keep at most 3 windows expanded — collapse the oldest others
  const capExpanded = (keepKey: string) => setTimeout(() => setMin((m) => {
    const expanded = wins.filter((w) => !m[w.key] && w.key !== keepKey)
    if (expanded.length < 2) return m
    const next = { ...m }
    expanded.slice(0, expanded.length - 1).forEach((w) => { next[w.key] = true })
    return next
  }), 0)

  useEffect(() => {
    const onOvi = () => openOvi()
    const onChat = (e: Event) => { const id = (e as CustomEvent).detail?.channelId; if (id) openChat(id) }
    window.addEventListener('simplr-open-ovi', onOvi)
    window.addEventListener('simplr-ai-ask', onOvi)
    window.addEventListener('simplr-open-chat', onChat as EventListener)
    return () => {
      window.removeEventListener('simplr-open-ovi', onOvi)
      window.removeEventListener('simplr-ai-ask', onOvi)
      window.removeEventListener('simplr-open-chat', onChat as EventListener)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalUnread = teamChannels.reduce((s, c) => s + c.unread, 0)
  const chanOf = (id: string) => teamChannels.find((c) => c.id === id)

  return (
    <div className="fixed bottom-0 right-0 z-[80] flex items-end gap-3 p-4 pointer-events-none">
      {/* open windows */}
      {wins.map((w) =>
        w.kind === 'ovi'
          ? <OviWindow key={w.key} min={!!min[w.key]} onMin={() => toggleMin(w.key)} onClose={() => close(w.key)} />
          : (() => { const c = chanOf(w.channelId); return c ? <ChatWindow key={w.key} channel={c} min={!!min[w.key]} onMin={() => toggleMin(w.key)} onClose={() => close(w.key)} /> : null })(),
      )}

      {/* launchers */}
      <div className="relative pointer-events-auto flex items-center gap-2">
        {picker && (
          <div className="absolute bottom-14 right-0 w-[260px] bg-surface rounded-2xl shadow-modal border border-border overflow-hidden">
            <div className="px-3 py-2 eyebrow text-muted-3 border-b border-divider">Open a conversation</div>
            <div className="max-h-[320px] overflow-y-auto py-1">
              {teamChannels.filter((c) => c.kind !== 'channel' || true).map((c) => (
                <button key={c.id} onClick={() => openChat(c.id)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-control">
                  <span className="w-6 text-center text-muted-3 shrink-0">{c.kind === 'group' ? <Users size={15} className="inline" /> : c.kind === 'dm' ? '@' : '#'}</span>
                  <span className="flex-1 truncate text-[13px] text-ink-2">{c.name}</span>
                  {c.ai && <Sparkle size={12} className="text-accent" />}
                  {c.unread > 0 && <span className="text-[10px] font-bold text-white bg-accent rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{c.unread}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <button onClick={() => setPicker((p) => !p)} className="relative h-12 w-12 rounded-full bg-surface border border-border shadow-card flex items-center justify-center text-ink-3 hover:border-border-blue transition-colors">
          <Users size={20} />
          {totalUnread > 0 && <span className="absolute -top-1 -right-1 text-[10px] font-bold text-white bg-accent rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{totalUnread}</span>}
        </button>
        <button onClick={openOvi} className="h-12 pl-3.5 pr-4 rounded-full bg-accent-gradient text-white shadow-primary flex items-center gap-2 font-semibold text-[13.5px] hover:brightness-[0.97] active:translate-y-px transition-all">
          <Sparkle size={19} /> Ask Ovi
        </button>
      </div>
    </div>
  )
}

/* ---------- shared window shell ---------- */
function Shell({ title, icon, min, onMin, onClose, onExpand, children, footer }: { title: React.ReactNode; icon: React.ReactNode; min: boolean; onMin: () => void; onClose: () => void; onExpand?: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className={classNames('pointer-events-auto bg-canvas rounded-2xl shadow-modal border border-border flex flex-col overflow-hidden transition-all', min ? 'w-[240px] h-12' : 'w-[340px] h-[480px] max-h-[calc(100vh-40px)]')}>
      <button onClick={onMin} className="h-12 shrink-0 bg-surface border-b border-border flex items-center gap-2.5 px-3.5 text-left">
        {icon}
        <div className="text-[13.5px] font-bold text-ink flex-1 truncate">{title}</div>
        {onExpand && !min && <span onClick={(e) => { e.stopPropagation(); onExpand() }} title="Open full view" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-2 hover:bg-control hover:text-ink-3"><Expand size={15} /></span>}
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-2 hover:bg-control hover:text-ink-3 text-[15px]">{min ? '▴' : '▾'}</span>
        <span onClick={(e) => { e.stopPropagation(); onClose() }} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-2 hover:bg-control hover:text-ink-3 text-[18px] leading-none">×</span>
      </button>
      {!min && (<><div className="flex-1 overflow-y-auto">{children}</div><div className="shrink-0">{footer}</div></>)}
    </div>
  )
}

/* ---------- Ovi window (the actioning assistant, everywhere) ---------- */
function OviWindow({ min, onMin, onClose }: { min: boolean; onMin: () => void; onClose: () => void }) {
  const nav = useNavigate()
  const { turns, ask } = useChat()
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }) }, [turns])
  return (
    <Shell
      min={min} onMin={onMin} onClose={onClose} onExpand={() => nav('/ai')}
      icon={<span className="w-7 h-7 rounded-lg bg-accent-gradient text-white flex items-center justify-center shadow-primary shrink-0"><Sparkle size={15} /></span>}
      title="Ask Ovi"
      footer={<div className="p-3 border-t border-border bg-surface"><AiComposer onSend={ask} compact /></div>}
    >
      <div ref={scroller} className="h-full overflow-y-auto p-3.5 flex flex-col gap-4">
        {turns.length === 0 ? (
          <div className="flex flex-col gap-3">
            <div className="text-[13px] text-muted-b">I’m Ovi — I run across every app and can take real actions. Ask me anything, or start with:</div>
            <div className="flex flex-col gap-2">
              {starterPrompts.slice(0, 4).map((p) => (
                <button key={p} onClick={() => ask(p)} className="text-left bg-surface border border-border rounded-xl px-3 py-2.5 text-[13px] text-ink-3 hover:border-border-blue transition-colors flex items-center gap-2"><Sparkle size={14} className="text-accent shrink-0" />{p}</button>
              ))}
            </div>
          </div>
        ) : turns.map((t, i) => <AiMessage key={i} turn={t} />)}
      </div>
    </Shell>
  )
}

/* ---------- Team chat window ---------- */
function ChatWindow({ channel, min, onMin, onClose }: { channel: TeamChannel; min: boolean; onMin: () => void; onClose: () => void }) {
  const nav = useNavigate()
  const { teamMembers } = useState_()
  const act = useActions()
  const { msgs, work, send } = useTeamChat(channel)
  const scroller = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }); if (!min) act.markChannelRead(channel.id) }, [msgs.length, work, min])
  const member = (id: string) => teamMembers.find((m) => m.id === id)
  const heading = channel.kind === 'channel' ? `# ${channel.name}` : channel.name

  function submit() { if (draft.trim()) { send(draft.trim()); setDraft('') } }

  return (
    <Shell
      min={min} onMin={onMin} onClose={onClose} onExpand={() => nav('/team')}
      icon={<span className="w-7 h-7 rounded-lg bg-control text-ink-3 flex items-center justify-center shrink-0 text-[13px] font-bold">{channel.kind === 'group' ? <Users size={15} /> : channel.kind === 'dm' ? '@' : '#'}</span>}
      title={<span className="flex items-center gap-1.5">{heading}{channel.ai && <Sparkle size={12} className="text-accent" />}{channel.unread > 0 && min && <span className="text-[10px] font-bold text-white bg-accent rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">{channel.unread}</span>}</span>}
      footer={
        <div className="p-2.5 border-t border-border bg-surface flex items-center gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }} placeholder={`Message ${channel.kind === 'dm' ? channel.name : heading}…`} className="flex-1 h-9 px-3 rounded-full border border-input-border bg-white text-[13px] outline-none focus:border-accent" />
          <button onClick={submit} className="w-9 h-9 rounded-full bg-accent-gradient text-white flex items-center justify-center shrink-0 shadow-primary"><Send size={15} /></button>
        </div>
      }
    >
      <div ref={scroller} className="h-full overflow-y-auto p-3 flex flex-col gap-3">
        {msgs.length === 0 && <div className="text-center text-muted-3 text-[12px] py-6">Start the conversation.{channel.ai && ' @mention Ovi for help.'}</div>}
        {msgs.map((m) => <DockMessage key={m.id} m={m} member={member} />)}
        {work && (
          <div className="flex items-center gap-2 text-[12px] text-muted-2"><Sparkle size={13} className="text-accent animate-pulse" /> {work.steps[Math.min(work.i, work.steps.length - 1)]}…</div>
        )}
      </div>
    </Shell>
  )
}

function DockMessage({ m, member }: { m: TeamMessage; member: (id: string) => { name: string; color: string; bot?: boolean } | undefined }) {
  const mine = m.authorId === YOU_MEMBER_ID
  const who = member(m.authorId)
  const isAi = !!who?.bot
  return (
    <div className={classNames('flex gap-2', mine && 'flex-row-reverse')}>
      {!mine && <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 mt-0.5" style={{ background: who?.color ?? '#8A93A3' }}>{isAi ? <Sparkle size={12} /> : who?.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>}
      <div className={classNames('min-w-0 max-w-[80%]', mine && 'items-end flex flex-col')}>
        {!mine && <div className="text-[11px] font-semibold text-ink-3 mb-0.5">{who?.name}</div>}
        <div className={classNames('rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed', mine ? 'bg-accent text-white' : 'bg-surface border border-border text-ink-2')}>{m.text}</div>
        {m.ai && m.ai.map((b, i) => <DockBlock key={i} b={b} />)}
        {m.actions && m.actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">{m.actions.map((a, i) => <span key={i} className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent bg-accent-wash rounded-lg px-2 py-1"><Check size={11} /> {a.label}</span>)}</div>
        )}
      </div>
    </div>
  )
}

/* compact renderer for the AI's structured blocks inside a narrow window */
function DockBlock({ b }: { b: TeamAiBlock }) {
  if (b.type === 'text') return <div className="text-[12.5px] text-ink-3 mt-1.5">{b.text}</div>
  if (b.type === 'stats') return (
    <div className="grid grid-cols-2 gap-1.5 mt-1.5">{b.items.map((s, i) => (<div key={i} className="bg-surface border border-border rounded-lg px-2 py-1.5"><div className="text-[10px] text-muted-2">{s.label}</div><div className={classNames('text-[13px] font-bold', s.tone === 'positive' ? 'text-positive' : s.tone === 'negative' ? 'text-negative' : 'text-ink')}>{s.value}</div></div>))}</div>
  )
  if (b.type === 'bars') return (
    <div className="bg-surface border border-border rounded-lg p-2 mt-1.5 flex flex-col gap-1">{b.title && <div className="text-[10.5px] font-semibold text-muted-2">{b.title}</div>}{b.items.map((it, i) => (<div key={i} className="flex items-center gap-2"><span className="text-[11px] text-ink-3 flex-1 truncate">{it.label}</span><span className="text-[11px] font-semibold text-ink-2">{it.display}</span></div>))}</div>
  )
  if (b.type === 'agenda') return (
    <div className="bg-surface border border-border rounded-lg p-2 mt-1.5"><div className="text-[10.5px] font-semibold text-muted-2 mb-1">{b.title}</div><ul className="list-disc pl-4 flex flex-col gap-0.5">{b.items.map((it, i) => <li key={i} className="text-[11.5px] text-ink-3">{it}</li>)}</ul></div>
  )
  if (b.type === 'tasks') return (
    <div className="bg-surface border border-border rounded-lg p-2 mt-1.5 flex flex-col gap-1">{b.items.map((it, i) => (<div key={i} className="flex items-center gap-1.5 text-[11.5px] text-ink-3"><Check size={11} className="text-accent" />{it.label}<span className="text-muted-3 ml-auto">{it.meta}</span></div>))}</div>
  )
  if (b.type === 'email') return (
    <div className="bg-surface border border-border rounded-lg p-2.5 mt-1.5"><div className="text-[10.5px] text-muted-2">To {b.to}</div><div className="text-[12px] font-semibold text-ink mt-0.5">{b.subject}</div><div className="text-[11.5px] text-ink-3 mt-1 whitespace-pre-line line-clamp-4">{b.body}</div></div>
  )
  return null
}
