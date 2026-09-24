import { useEffect, type ReactNode } from 'react'
import { useState_, useActions } from '../store/store'
import { Check, Sparkle } from './icons'
import { Button } from './ui'
import { Dropdown, type DropdownProps } from './Dropdown'
import { classNames } from '../lib/format'

/* ---------- Modal ---------- */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 520,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 pt-[10vh]">
      <div className="absolute inset-0 bg-[rgba(11,18,32,0.35)] backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-surface rounded-overlay shadow-modal w-full flex flex-col max-h-[80vh]" style={{ maxWidth: width }}>
        <div className="px-5 py-4 border-b border-divider flex items-start justify-between">
          <div>
            <div className="text-[16px] font-bold text-ink">{title}</div>
            {subtitle && <div className="text-[13px] text-muted-b mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-2 hover:bg-control hover:text-ink-3 text-[18px] leading-none">×</button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex flex-col gap-3.5">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-divider flex items-center justify-end gap-2.5">{footer}</div>}
      </div>
    </div>
  )
}

/* ---------- Form fields ---------- */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-ink-3">{label}</span>
      {children}
    </label>
  )
}
const inputCls = 'h-9 px-3 rounded-control border border-input-border bg-white text-[13px] text-ink-2 outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow w-full'
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={classNames(inputCls, props.className)} />
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={classNames(inputCls, 'h-auto py-2 resize-none', props.className)} />
}
export function Select({ children, ...props }: DropdownProps) {
  return (
    <Dropdown {...props} className={classNames(inputCls, 'cursor-pointer', props.className)}>
      {children}
    </Dropdown>
  )
}
export { Button }

/* ---------- Toaster ---------- */
export function Toaster() {
  const { toasts } = useState_()
  const { dismissToast } = useActions()
  useEffect(() => {
    if (toasts.length === 0) return
    const timers = toasts.map((t) => setTimeout(() => dismissToast(t.id), 4200))
    return () => timers.forEach(clearTimeout)
  }, [toasts])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2.5 bg-ink text-white rounded-xl pl-3 pr-4 py-2.5 shadow-modal text-[13px] font-medium animate-[slideup_.18s_ease-out]"
          style={{ maxWidth: 420 }}
        >
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            style={{ background: t.tone === 'warning' ? '#C2410C' : t.tone === 'accent' ? '#13927B' : '#0E7C66' }}
          >
            {t.tone === 'accent' ? <Sparkle size={12} /> : <Check size={12} strokeWidth={2.6} />}
          </span>
          <span>{t.text}</span>
          <button onClick={() => dismissToast(t.id)} className="ml-1 text-white/50 hover:text-white text-[16px] leading-none">×</button>
        </div>
      ))}
    </div>
  )
}
