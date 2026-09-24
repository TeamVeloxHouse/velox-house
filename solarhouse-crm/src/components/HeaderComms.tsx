import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkle, Users, Send } from './icons'
import { useState_ } from '../store/store'
import { YOU_MEMBER_ID } from '../store/types'
import { classNames } from '../lib/format'

/* Header launchers for Ask Ovi and team messages — they live in the top bar so nothing floats over
 * the page. Messages drops down a conversation list; picking one opens its chat window under the header. */

export function AskOviButton() {
  return (
    <button onClick={() => window.dispatchEvent(new CustomEvent('simplr-open-ovi'))} title="Ask Ovi"
      className="h-9 pl-2.5 pr-3.5 rounded-[10px] bg-[#15223B] text-white text-[13px] font-semibold flex items-center gap-1.5 hover:bg-[#1E2F4E] shrink-0">
      <Sparkle size={15} className="text-[#62E4CC]" />Ask Ovi
    </button>
  )
}

const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `${Math.max(1, m)}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d` }

export function MessagesButton() {
  const nav = useNavigate()
  const { teamChannels, teamMessages, teamMembers } = useState_()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [open])
  const unread = teamChannels.reduce((s, c) => s + c.unread, 0)
  const lastOf = (id: string) => teamMessages.filter((m) => m.channelId === id).sort((a, b) => b.createdAt - a.createdAt)[0]
  const rows = teamChannels.map((c) => ({ c, last: lastOf(c.id) })).sort((a, b) => (b.c.unread - a.c.unread) || ((b.last?.createdAt ?? 0) - (a.last?.createdAt ?? 0)))
  const who = (id?: string) => teamMembers.find((m) => m.id === id)
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen((o) => !o)} title="Messages" className="sh-hdr-btn w-9 flex items-center justify-center relative">
        <Users size={17} />
        {unread > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#15223B] text-[#62E4CC] text-[10px] font-bold flex items-center justify-center">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] rounded-[14px] bg-white border border-[#E1E6EC] shadow-[0_20px_44px_-12px_rgba(16,24,40,0.32)] overflow-hidden z-[90] text-left">
          <div className="px-4 py-3 border-b border-[#EEF1F5] flex items-center gap-2">
            <span className="text-[14px] font-bold text-[#15223B] flex-1">Messages</span>
            {unread > 0 && <span className="text-[11px] font-semibold text-muted-b">{unread} unread</span>}
          </div>
          <div className="max-h-[420px] overflow-y-auto py-1">
            {rows.map(({ c, last }) => {
              const author = who(last?.authorId)
              return (
                <button key={c.id} onClick={() => { window.dispatchEvent(new CustomEvent('simplr-open-chat', { detail: { channelId: c.id } })); setOpen(false) }}
                  className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-[#F7F9FB]">
                  <span className={classNames('w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0 text-[13px] font-bold', c.unread ? 'bg-[#15223B] text-[#62E4CC]' : 'bg-[#EEF1F5] text-ink-3')}>{c.kind === 'group' ? <Users size={15} /> : c.kind === 'dm' ? '@' : '#'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5"><span className={classNames('text-[13px] truncate', c.unread ? 'font-bold text-ink' : 'font-semibold text-ink-2')}>{c.kind === 'channel' ? `# ${c.name}` : c.name}</span>{c.ai && <Sparkle size={11} className="text-[#0E7A66]" />}<span className="ml-auto text-[11px] text-muted-3 shrink-0">{last ? ago(last.createdAt) : ''}</span></span>
                    <span className={classNames('block text-[12px] truncate mt-0.5', c.unread ? 'text-ink-2' : 'text-muted-2')}>{last ? `${last.authorId === YOU_MEMBER_ID ? 'You' : author?.bot ? 'Ovi' : author?.name.split(' ')[0] ?? ''}: ${last.text || 'sent an update'}` : 'No messages yet'}</span>
                  </span>
                  {c.unread > 0 && <span className="mt-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#62E4CC] text-[#15223B] text-[10px] font-bold flex items-center justify-center">{c.unread}</span>}
                </button>
              )
            })}
          </div>
          <button onClick={() => { setOpen(false); nav('/team') }} className="w-full px-4 py-2.5 border-t border-[#EEF1F5] text-[12.5px] font-semibold text-[#15223B] hover:bg-[#F7F9FB] flex items-center justify-center gap-1.5"><Send size={13} />Open Team chat</button>
        </div>
      )}
    </div>
  )
}
