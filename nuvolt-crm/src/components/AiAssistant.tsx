import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AiMessage, AiComposer, useChat } from './AiChat'
import { Sparkle, Bars as Expand } from './icons'
import { starterPrompts } from '../lib/ai'

export function AiAssistant() {
  const [open, setOpen] = useState(false)
  const { turns, ask } = useChat()
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [turns, open])
  // Any "ask" from a record surface pops the assistant open so the reply is visible.
  useEffect(() => {
    const opener = () => setOpen(true)
    window.addEventListener('simplr-ai-ask', opener)
    return () => window.removeEventListener('simplr-ai-ask', opener)
  }, [])

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[80] h-12 pl-3.5 pr-4 rounded-full bg-accent-gradient text-white shadow-primary flex items-center gap-2 font-semibold text-[13.5px] hover:brightness-[0.97] active:translate-y-px transition-all"
        >
          <Sparkle size={19} />
          Ask Simplr AI
        </button>
      )}

      {/* panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-[80] w-[380px] max-w-[calc(100vw-32px)] h-[560px] max-h-[calc(100vh-48px)] bg-canvas rounded-2xl shadow-modal border border-border flex flex-col overflow-hidden">
          <div className="h-12 shrink-0 bg-surface border-b border-border flex items-center gap-2.5 px-3.5">
            <div className="w-7 h-7 rounded-lg bg-accent-gradient text-white flex items-center justify-center shadow-primary">
              <Sparkle size={15} />
            </div>
            <div className="text-[13.5px] font-bold text-ink flex-1">Simplr AI</div>
            <Link to="/ai" onClick={() => setOpen(false)} title="Open full chat" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-2 hover:bg-control hover:text-ink-3">
              <Expand size={16} />
            </Link>
            <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-2 hover:bg-control hover:text-ink-3 text-[18px] leading-none">×</button>
          </div>

          <div ref={scroller} className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-4">
            {turns.length === 0 ? (
              <div className="flex flex-col gap-3">
                <div className="text-[13px] text-muted-b">
                  Hi Jordan — I can analyse your pipeline, draft emails, or take actions for you. Ask me anything, or start with:
                </div>
                <div className="flex flex-col gap-2">
                  {starterPrompts.slice(0, 4).map((p) => (
                    <button
                      key={p}
                      onClick={() => ask(p)}
                      className="text-left bg-surface border border-border rounded-xl px-3 py-2.5 text-[13px] text-ink-3 hover:border-border-blue transition-colors flex items-center gap-2"
                    >
                      <Sparkle size={14} className="text-accent shrink-0" />
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              turns.map((t, i) => <AiMessage key={i} turn={t} />)
            )}
          </div>

          <div className="p-3 border-t border-border bg-surface">
            <AiComposer onSend={ask} compact />
          </div>
        </div>
      )}
    </>
  )
}
