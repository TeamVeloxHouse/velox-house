import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button } from '../components/ui'
import { AiMessage, AiComposer, useChat } from '../components/AiChat'
import { Sparkle, Bars, Envelope, Note, Robot, Bolt } from '../components/icons'
import { starterPrompts } from '../lib/ai'
import { useState_ } from '../store/store'

const capabilities = [
  { icon: Bars, title: 'Analyse your pipeline', sub: 'Risk, concentration, forecast — ask in plain English' },
  { icon: Envelope, title: 'Draft & send emails', sub: 'On-brand follow-ups from real deal context' },
  { icon: Note, title: 'Summarise anything', sub: 'A deal, an account, a week of activity' },
  { icon: Bolt, title: 'Take action', sub: 'Create tasks, move deals, book next steps' },
]

export function TellOviAI() {
  const nav = useNavigate()
  const { turns, ask } = useChat()
  const { agents } = useState_()
  const running = agents.filter((a) => a.on).length
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [turns])

  const empty = turns.length === 0

  return (
    <>
      <TopBar
        title="TellOvi AI"
        crumbs={['Your CRM copilot']}
        actions={
          <>
            <button
              onClick={() => nav('/agents')}
              title="Manage agents"
              className="h-9 pl-3 pr-2.5 rounded-control border border-border bg-surface text-[13px] font-semibold text-ink-3 hover:bg-control flex items-center gap-2 transition-colors"
            >
              <Robot size={16} />Agents
              <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-positive bg-positive-wash rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />{running} running
              </span>
            </button>
            <Button variant="primary" icon={<Sparkle size={16} />}>New chat</Button>
          </>
        }
      />
      <div className="flex-1 flex min-h-0">
        {/* chat column */}
        <div className="flex-1 flex flex-col min-w-0">
          <div ref={scroller} className="flex-1 overflow-y-auto">
            {empty ? (
              <div className="max-w-[760px] mx-auto px-7 py-12 flex flex-col gap-8">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-accent-gradient text-white flex items-center justify-center shadow-primary">
                    <Sparkle size={28} />
                  </div>
                  <div>
                    <div className="text-[24px] font-bold text-ink tracking-[-0.02em]">Good morning, Jordan</div>
                    <div className="text-[14px] text-muted-b mt-1">I’m connected to your whole CRM. Ask me to analyse, draft, or get something done.</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {capabilities.map((c) => (
                    <div key={c.title} className="bg-surface border border-border rounded-card p-4 flex items-start gap-3">
                      <span className="w-9 h-9 rounded-[10px] bg-accent-wash text-accent flex items-center justify-center shrink-0"><c.icon size={18} /></span>
                      <div>
                        <div className="text-[13.5px] font-semibold text-ink-2">{c.title}</div>
                        <div className="text-[12.5px] text-muted-2 mt-0.5">{c.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="eyebrow text-muted-3 mb-2.5">Try asking</div>
                  <div className="flex flex-col gap-2">
                    {starterPrompts.map((p) => (
                      <button
                        key={p}
                        onClick={() => ask(p)}
                        className="text-left bg-surface border border-border rounded-xl px-4 py-3 text-[13.5px] text-ink-3 hover:border-border-blue hover:bg-[#FBFCFF] transition-colors flex items-center gap-2.5"
                      >
                        <Sparkle size={15} className="text-accent shrink-0" />
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-[760px] mx-auto px-7 py-7 flex flex-col gap-6">
                {turns.map((t, i) => (
                  <AiMessage key={i} turn={t} />
                ))}
              </div>
            )}
          </div>

          {/* composer */}
          <div className="border-t border-border bg-canvas px-7 py-4">
            <div className="max-w-[760px] mx-auto">
              <AiComposer onSend={ask} />
              <div className="text-[11px] text-muted-3 text-center mt-2">
                TellOvi AI can read and act on your CRM. It always shows its work before doing anything irreversible.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
