import { Children, Fragment, isValidElement, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from './icons'
import { classNames } from '../lib/format'

/* The app's own dropdown — a drop-in for a native <select> (same value / onChange(e.target.value) /
 * <option> children), so every picker in the CRM opens the same styled menu instead of the
 * browser's grey system list. The trigger keeps whatever className the page gave it. */

type Opt = { value: string; label: ReactNode; text: string; disabled?: boolean; group?: string }
export type DropdownProps = {
  value?: string | number
  defaultValue?: string | number
  onChange?: (e: { target: { value: string } }) => void
  onClick?: (e: React.MouseEvent) => void
  children?: ReactNode
  className?: string
  disabled?: boolean
  title?: string
  id?: string
  name?: string
  required?: boolean
  autoFocus?: boolean
  'aria-label'?: string
  style?: React.CSSProperties
}

const textOf = (n: ReactNode): string =>
  n == null || typeof n === 'boolean' ? '' : typeof n === 'string' || typeof n === 'number' ? String(n)
    : Array.isArray(n) ? n.map(textOf).join('') : isValidElement(n) ? textOf((n.props as { children?: ReactNode }).children) : ''

function collect(children: ReactNode, out: Opt[] = [], group?: string): Opt[] {
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return
    const el = c as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean; label?: string }>
    if (el.type === Fragment) collect(el.props.children, out, group)
    else if (el.type === 'optgroup') collect(el.props.children, out, el.props.label)
    else if (el.type === 'option') {
      const text = textOf(el.props.children)
      out.push({ value: el.props.value != null ? String(el.props.value) : text, label: el.props.children, text, disabled: el.props.disabled, group })
    }
  })
  return out
}

export function Dropdown({ value, defaultValue, onChange, onClick, children, className, disabled, title, id, autoFocus, style, ...rest }: DropdownProps) {
  const opts = collect(children)
  const [inner, setInner] = useState(String(defaultValue ?? opts[0]?.value ?? ''))
  const current = value != null ? String(value) : inner
  const sel = opts.find((o) => o.value === current) ?? opts[0]
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; minWidth: number; maxH: number }>()
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const searchable = opts.length > 10
  const shown = q ? opts.filter((o) => o.text.toLowerCase().includes(q.toLowerCase())) : opts

  const place = () => {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom - 12, above = r.top - 12
    const up = below < 240 && above > below
    const left = Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 200) - 8))
    setPos(up ? { left, bottom: window.innerHeight - r.top + 6, minWidth: r.width, maxH: Math.min(340, above) } : { left, top: r.bottom + 6, minWidth: r.width, maxH: Math.min(340, below) })
  }
  const openMenu = () => {
    if (disabled) return
    place(); setQ(''); setActive(Math.max(0, opts.findIndex((o) => o.value === current))); setOpen(true)
  }
  const choose = (o: Opt) => {
    if (o.disabled) return
    if (value == null) setInner(o.value)
    if (o.value !== current) onChange?.({ target: { value: o.value } })
    setOpen(false); btn.current?.focus()
  }

  useLayoutEffect(() => { if (open) menu.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }) }, [open, active])
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false) }
    const scroll = (e: Event) => { if (!menu.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', down)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', place)
    return () => { document.removeEventListener('mousedown', down); window.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', place) }
  }, [open])

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openMenu() }
      return
    }
    const step = (d: number) => { let i = active; for (let n = 0; n < shown.length; n++) { i = (i + d + shown.length) % shown.length; if (!shown[i].disabled) break } setActive(i) }
    if (e.key === 'ArrowDown') { e.preventDefault(); step(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); step(-1) }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) choose(shown[active]) }
    else if (e.key === 'Escape' || e.key === 'Tab') { setOpen(false) }
    else if (!searchable && e.key.length === 1) {
      const i = shown.findIndex((o) => o.text.toLowerCase().startsWith(e.key.toLowerCase()))
      if (i >= 0) setActive(i)
    }
  }

  let lastGroup: string | undefined
  return (
    <>
      <button
        ref={btn}
        type="button"
        id={id}
        title={title}
        aria-label={rest['aria-label']}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        autoFocus={autoFocus}
        style={style}
        onClick={(e) => { onClick?.(e); if (open) setOpen(false); else openMenu() }}
        onKeyDown={onKey}
        className={classNames('sh-select shrink-0 inline-flex items-center gap-2 text-left whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed', open && 'sh-select-open', className)}
      >
        {/* every label stacked in one cell keeps the trigger as wide as its longest option, like a native select */}
        <span className="grid flex-1 min-w-0">
          {opts.map((o) => <span key={o.value} aria-hidden className="invisible h-0 overflow-hidden [grid-area:1/1]">{o.label}</span>)}
          <span className="[grid-area:1/1] truncate">{sel?.label}</span>
        </span>
        <ChevronDown size={14} className={classNames('shrink-0 opacity-60 transition-transform duration-150', open && 'rotate-180')} />
      </button>
      {open && pos && createPortal(
        <div
          ref={menu}
          role="listbox"
          // portals bubble React events to the trigger's ancestors — keep menu clicks from opening rows/cards
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="sh-menu fixed z-[1000] min-w-[180px] max-w-[360px] flex flex-col rounded-[12px] bg-white border border-[#E1E6EC] shadow-[0_16px_36px_-10px_rgba(16,24,40,0.28),0_2px_6px_rgba(16,24,40,0.06)] overflow-hidden"
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: pos.minWidth, maxHeight: pos.maxH }}
        >
          {searchable && (
            <label className="shrink-0 flex items-center gap-2 h-10 px-3 border-b border-[#EEF1F5]">
              <Search size={14} className="text-muted-3" />
              <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0) }} onKeyDown={onKey} placeholder="Search…" className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-ink-2 placeholder:text-muted-3" />
            </label>
          )}
          <div className="overflow-y-auto p-1.5">
            {shown.length === 0 && <div className="px-2.5 py-2 text-[12.5px] text-muted-2">No matches</div>}
            {shown.map((o, i) => {
              const on = o.value === current
              const head = o.group && o.group !== lastGroup ? o.group : undefined
              lastGroup = o.group
              return (
                <Fragment key={o.value + i}>
                  {head && <div className="px-2.5 pt-2 pb-1 eyebrow text-muted-3">{head}</div>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    data-active={i === active}
                    disabled={o.disabled}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o)}
                    className={classNames(
                      'w-full min-h-[34px] px-2.5 py-1.5 rounded-[8px] flex items-center gap-2 text-left text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                      i === active ? 'bg-accent-wash-4 text-ink' : 'text-ink-2',
                      on && 'font-semibold text-accent-700',
                    )}
                  >
                    <span className="flex-1 min-w-0 truncate">{o.label}</span>
                    {on && <Check size={14} className="shrink-0 text-accent" />}
                  </button>
                </Fragment>
              )
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
