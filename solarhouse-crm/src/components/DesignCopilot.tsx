import { useEffect, useRef, useState } from 'react'
import { Sparkle, Check } from './icons'
import { OVI_DESIGN_PROMPTS } from '../lib/oviDesign'

type Msg = { role: 'user' } | { role: 'ovi'; steps: string[]; summary?: string; streaming: boolean }

/** Ovi's in-studio design copilot — a chat that DRIVES the design. You describe the outcome; Ovi
 *  sizes + lays out the array live, streaming each step, then reports what it did and why. */
export function DesignCopilot({ open, onClose, onExecute }: {
  open: boolean
  onClose: () => void
  onExecute: (brief: string, emit: (line: string) => void) => Promise<string>
}) {
  const [msgs, setMsgs] = useState<({ role: 'user'; text: string } | (Msg & { role: 'ovi' }))[]>([])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => { scroller.current?.scrollTo({ top: 9e6, behavior: 'smooth' }) }, [msgs])

  async function run(brief: string) {
    if (!brief.trim() || running) return
    setInput(''); setRunning(true)
    setMsgs((m) => [...m, { role: 'user', text: brief }, { role: 'ovi', steps: [], streaming: true }])
    const emit = (line: string) => setMsgs((m) => {
      const copy = [...m]; const last = copy[copy.length - 1]
      if (last && last.role === 'ovi') copy[copy.length - 1] = { ...last, steps: [...last.steps, line] }
      return copy
    })
    try {
      const summary = await onExecute(brief, emit)
      setMsgs((m) => { const copy = [...m]; const last = copy[copy.length - 1]; if (last && last.role === 'ovi') copy[copy.length - 1] = { ...last, summary, streaming: false }; return copy })
    } catch {
      setMsgs((m) => { const copy = [...m]; const last = copy[copy.length - 1]; if (last && last.role === 'ovi') copy[copy.length - 1] = { ...last, summary: 'I hit a snag laying that out — try rephrasing, or capture the roof first.', streaming: false }; return copy })
    } finally { setRunning(false) }
  }

  if (!open) return null
  return (
    <div className="absolute inset-0 z-[600] flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-[400px] max-w-full h-full bg-surface border-l border-border shadow-modal flex flex-col animate-[slideIn_.18s_ease-out]">
        <style>{`@keyframes slideIn{from{transform:translateX(24px);opacity:.4}to{transform:none;opacity:1}}`}</style>
        {/* header */}
        <div className="px-4 py-3.5 border-b border-divider flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: '#15223B' }}><Sparkle size={16} /></span>
          <div className="flex-1 min-w-0"><div className="font-bold text-[14px] text-ink">Design with Ovi</div><div className="text-[11.5px] text-muted-b">Describe the outcome — Ovi lays it out</div></div>
          <button onClick={onClose} className="text-muted-2 hover:text-ink text-[18px] leading-none">✕</button>
        </div>

        {/* conversation */}
        <div ref={scroller} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {msgs.length === 0 && (
            <div className="text-[12.5px] text-muted-b">
              Tell Ovi what you want and it drives the design — sizing to a goal and laying panels on the best roofs first. For example:
              <div className="flex flex-col gap-1.5 mt-3">
                {OVI_DESIGN_PROMPTS.map((p) => (
                  <button key={p} onClick={() => run(p)} className="text-left px-3 py-2 rounded-lg border border-border hover:border-accent hover:bg-accent-wash text-[12.5px] font-medium text-ink-3">“{p}”</button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => m.role === 'user' ? (
            <div key={i} className="self-end max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2 text-[13px] text-white" style={{ background: '#15223B' }}>{m.text}</div>
          ) : (
            <div key={i} className="self-start max-w-[92%] rounded-2xl rounded-bl-sm bg-control px-3.5 py-2.5">
              <div className="flex flex-col gap-1.5">
                {m.steps.map((s, si) => {
                  const isLast = si === m.steps.length - 1
                  const spinning = m.streaming && isLast
                  return (
                    <div key={si} className="flex items-center gap-2 text-[12.5px] text-ink-3">
                      {spinning ? <span className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin shrink-0" /> : <Check size={13} className="text-positive shrink-0" />}
                      <span>{s}</span>
                    </div>
                  )
                })}
              </div>
              {m.summary && <div className="text-[13px] text-ink-2 mt-2 pt-2 border-t border-divider whitespace-pre-line">{m.summary}</div>}
            </div>
          ))}
        </div>

        {/* input */}
        <div className="p-3 border-t border-divider">
          <div className="flex items-end gap-2">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(input) } }}
              rows={1} placeholder="Design for 100% offset of a 12,000 kWh bill…" className="flex-1 resize-none max-h-24 px-3 py-2 rounded-control border border-input-border bg-white text-[13px] outline-none focus:border-accent" />
            <button onClick={() => run(input)} disabled={running || !input.trim()} className="h-9 w-9 shrink-0 rounded-control text-white flex items-center justify-center disabled:opacity-40" style={{ background: '#15223B' }}><Sparkle size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}
