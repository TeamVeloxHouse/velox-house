import type { ReactNode } from 'react'
import { classNames, initials } from '../lib/format'

/* ---------- Button ---------- */
type BtnProps = {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  onClick?: () => void
  icon?: ReactNode
  className?: string
  color?: string
}
export function Button({ children, variant = 'secondary', onClick, icon, className, color }: BtnProps) {
  const base =
    'h-9 inline-flex items-center gap-2 px-3.5 rounded-control text-[13px] transition-[transform,box-shadow,background] duration-150 ease-out select-none active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2'
  if (variant === 'primary')
    return (
      <button
        onClick={onClick}
        className={classNames(base, 'bg-accent-gradient text-white font-semibold shadow-primary hover:brightness-[0.97] active:shadow-none', className)}
      >
        {icon}
        {children}
      </button>
    )
  if (variant === 'ghost')
    return (
      <button onClick={onClick} className={classNames(base, 'text-muted-b font-medium hover:bg-control', className)} style={color ? { color } : undefined}>
        {icon}
        {children}
      </button>
    )
  return (
    <button
      onClick={onClick}
      className={classNames(base, 'bg-card-sheen border border-border-blue text-ink-3 font-medium shadow-[0_1px_1.5px_rgba(16,24,40,0.05)] hover:bg-[#F3F6FC] hover:shadow-[0_2px_5px_rgba(16,24,40,0.08)]', className)}
      style={color ? { color, borderColor: color } : undefined}
    >
      {icon}
      {children}
    </button>
  )
}

/* ---------- Segmented control ---------- */
export function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="inline-flex bg-control rounded-control p-[3px] gap-0.5">
      {options.map((o) => {
        const active = o === value
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={classNames(
              'h-[30px] px-3 rounded-[7px] text-[13px] transition-colors duration-150',
              active ? 'bg-white text-ink font-semibold shadow-[0_1px_2px_rgba(11,18,32,0.08)]' : 'text-muted-b hover:text-ink-3',
            )}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- Status chip ---------- */
const chipStyles: Record<string, { bg: string; fg: string; border?: string }> = {
  positive: { bg: '#E9F5F1', fg: '#0E7C66', border: '#D3E9E2' },
  warning: { bg: '#FDF1E7', fg: '#C2410C' },
  negative: { bg: '#FDECEF', fg: '#B01B4F' },
  accent: { bg: '#EEF2FB', fg: '#1D4ED8' },
  neutral: { bg: '#F1F3F7', fg: '#5D6878' },
}
export type ChipTone = keyof typeof chipStyles
export function Chip({ tone = 'neutral', children, dot }: { tone?: ChipTone; children: ReactNode; dot?: boolean }) {
  const s = chipStyles[tone]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-chip text-[12px] font-semibold whitespace-nowrap"
      style={{ background: s.bg, color: s.fg, border: s.border ? `1px solid ${s.border}` : undefined }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.fg }} />}
      {children}
    </span>
  )
}

/* ---------- Avatar ---------- */
export function Avatar({
  name,
  size = 30,
  variant = 'accent',
  square,
}: {
  name: string
  size?: number
  variant?: 'accent' | 'neutral'
  square?: boolean
}) {
  const bg = variant === 'accent' ? '#EEF2FB' : '#F1F3F7'
  const fg = variant === 'accent' ? '#1D4ED8' : '#5D6878'
  return (
    <span
      className="inline-flex items-center justify-center font-bold shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: square ? 8 : '50%',
        background: bg,
        color: fg,
        fontSize: Math.round(size * 0.36),
      }}
    >
      {initials(name)}
    </span>
  )
}

/* ---------- Card ---------- */
export function Card({ children, className, pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <div className={classNames('bg-surface border border-border rounded-card', pad && 'p-[18px]', className)}>{children}</div>
  )
}

/* ---------- KPI card ---------- */
export function Kpi({
  label,
  value,
  delta,
  deltaTone = 'positive',
  variant = 'plain',
}: {
  label: string
  value: string
  delta?: string
  deltaTone?: 'positive' | 'negative' | 'muted'
  variant?: 'plain' | 'blue' | 'deep'
}) {
  const isDeep = variant === 'deep'
  const deltaColor = isDeep ? '#8FB0FF' : deltaTone === 'positive' ? '#0E7C66' : deltaTone === 'negative' ? '#B01B4F' : '#7A8494'
  return (
    <div
      className={classNames(
        'rounded-card p-[18px]',
        variant === 'blue' && 'bg-kpi-blue border border-border-blue shadow-card',
        variant === 'plain' && 'bg-surface border border-border',
        isDeep && 'bg-deep-panel shadow-lift',
      )}
    >
      <div className="text-[12px] font-medium" style={{ color: isDeep ? '#93A0B4' : variant === 'blue' ? '#5D7091' : '#7A8494' }}>
        {label}
      </div>
      <div className="text-[30px] font-bold mt-2 tracking-[-0.02em]" style={{ color: isDeep ? '#fff' : '#0B1220' }}>
        {value}
      </div>
      {delta && (
        <div className="text-[12px] mt-1.5 font-semibold" style={{ color: deltaColor }}>
          {delta}
        </div>
      )}
    </div>
  )
}

/* ---------- Section eyebrow ---------- */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow text-muted-3">{children}</div>
}

/* ---------- Progress bar ---------- */
export function Progress({ value, color = '#1D4ED8', height = 8, track = '#EEF0F4' }: { value: number; color?: string; height?: number; track?: string }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: track }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  )
}
