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
    'h-9 inline-flex items-center gap-2 whitespace-nowrap shrink-0 px-3.5 rounded-control text-[13px] transition-[transform,box-shadow,background] duration-150 ease-out select-none active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2'
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
      className={classNames(base, 'btn-secondary bg-white border border-[#CDD5DF] text-ink-2 font-semibold shadow-[0_1px_2px_rgba(16,24,40,0.08)] hover:border-accent-400 hover:text-accent hover:bg-accent-wash-4 hover:shadow-[0_3px_8px_-2px_rgba(16,24,40,0.12)]', className)}
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
    // seg-track / seg-on / seg-off pick up a frosted-glass look inside the mint header (index.css).
    <div className="seg-track inline-flex bg-[#E9EDF2] border border-[#DDE3EA] rounded-control p-[3px] gap-0.5">
      {options.map((o) => {
        const active = o === value
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={classNames(
              'h-[30px] px-3 rounded-[7px] text-[13px] transition-colors duration-150',
              active ? 'seg-on' : 'seg-off',
              active ? 'bg-white text-accent font-bold shadow-[0_1px_3px_rgba(11,18,32,0.14)]' : 'text-ink-3 font-medium hover:text-ink hover:bg-white/60',
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
  accent: { bg: '#EAF6F2', fg: '#13927B' },
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
  const bg = variant === 'accent' ? '#EAF6F2' : '#F1F3F7'
  const fg = variant === 'accent' ? '#13927B' : '#5D6878'
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
    <div className={classNames('bg-surface border border-[#E1E6EC] rounded-card shadow-card', pad && 'p-[18px]', className)}>{children}</div>
  )
}

/* ---------- KPI card ---------- */
/* Variants give a row hierarchy: `navy` (the sidebar's colour) for the headline number, `teal`
 * (brand gradient) for the win/outcome, `plain` for supporting figures. `deep` and `blue` are kept
 * for older pages. Optional icon chip and a 0–100 `meter` line add depth without clutter. */
type KpiVariant = 'plain' | 'blue' | 'deep' | 'navy' | 'teal'
export function Kpi({
  label,
  value,
  delta,
  deltaTone = 'positive',
  variant = 'plain',
  icon: I,
  meter,
  meterMark,
}: {
  label: string
  value: string
  delta?: string
  deltaTone?: 'positive' | 'negative' | 'muted'
  variant?: KpiVariant
  icon?: IconT
  /** 0–100 fill for a slim progress line under the value */
  meter?: number
  /** 0–100 position of a threshold tick on the meter */
  meterMark?: number
}) {
  const dark = variant === 'deep' || variant === 'navy'
  const teal = variant === 'teal' // the logo teal with navy type — light, so it has its own palette
  const deltaColor = dark ? '#62E4CC' : teal ? '#15223B'
    : deltaTone === 'positive' ? '#0E7C66' : deltaTone === 'negative' ? '#B01B4F' : '#7A8494'
  const bg: Partial<Record<KpiVariant, string>> = {
    navy: 'radial-gradient(260px 160px at 100% 0%, rgba(98,228,204,0.22) 0%, transparent 70%), linear-gradient(150deg, #1B2B48 0%, #15223B 60%, #111C31 100%)',
    teal: '#62E4CC',
  }
  return (
    <div
      className={classNames(
        'tile-hover relative overflow-hidden rounded-card p-[18px] min-w-0',
        variant === 'blue' && 'bg-kpi-blue border border-border-blue shadow-card',
        variant === 'plain' && 'bg-surface border border-[#E1E6EC] shadow-card',
        variant === 'deep' && 'bg-deep-panel shadow-lift',
        variant === 'navy' && 'text-white shadow-[0_10px_28px_-12px_rgba(21,34,59,0.55)]',
        teal && 'text-[#15223B] shadow-[0_10px_24px_-14px_rgba(14,122,102,0.6)]',
      )}
      style={bg[variant] ? { background: bg[variant] } : undefined}
    >
      <div className="flex items-center gap-2.5">
        {I && (
          <span className={classNames('w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0',
            dark ? 'bg-white/10 text-[#62E4CC] ring-1 ring-inset ring-white/15' : teal ? 'bg-[#15223B] text-[#62E4CC]' : 'text-accent ring-1 ring-inset ring-accent/10')}
            style={dark || teal ? undefined : { background: 'linear-gradient(145deg, #F4FBF9 0%, #DDF2EB 100%)' }}>
            <I size={15} />
          </span>
        )}
        <div className="text-[12.5px] font-semibold" style={{ color: dark ? 'rgba(255,255,255,0.72)' : teal ? 'rgba(21,34,59,0.72)' : variant === 'blue' ? '#5D7091' : '#6B7585' }}>{label}</div>
      </div>
      <div className="text-[32px] font-extrabold mt-3 tracking-[-0.03em] leading-none tabular-nums" style={{ color: dark ? '#fff' : teal ? '#15223B' : '#0B1220' }}>
        {value}
      </div>
      {meter != null && (
        <div className="relative mt-3 h-1.5 rounded-full" style={{ background: dark ? 'rgba(255,255,255,0.16)' : '#EEF1F5' }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, meter))}%`, background: dark ? '#62E4CC' : 'linear-gradient(90deg,#57C9B4,#0E7A66)' }} />
          {meterMark != null && <span className="absolute -top-1 w-0.5 h-3.5 rounded-full" style={{ left: `${meterMark}%`, background: dark ? '#fff' : '#15223B' }} />}
        </div>
      )}
      {delta && (
        <div className="text-[12px] mt-2.5 font-semibold" style={{ color: deltaColor }}>
          {delta}
        </div>
      )}
    </div>
  )
}

/* ---------- Stat tile — the headline number, with hierarchy ----------
 * Icon chip + label, a big value, a supporting line, and an optional tone that tints the chip and
 * the top edge so the eye lands on what matters (good / warning / bad). */
type IconT = (p: { size?: number; className?: string }) => JSX.Element
const TONES = {
  accent: { fg: '#0E7A66', bg: '#E3F4EF', edge: '#1FAE94' },
  good: { fg: '#0E7C66', bg: '#E3F4EF', edge: '#16A34A' },
  warn: { fg: '#B45309', bg: '#FDF1E3', edge: '#D97706' },
  bad: { fg: '#B01B4F', bg: '#FDE8EE', edge: '#DB2777' },
  info: { fg: '#0369A1', bg: '#E6F2FA', edge: '#0284C7' },
  neutral: { fg: '#475467', bg: '#EEF1F5', edge: '#98A1B0' },
}
export type StatTone = keyof typeof TONES
export function StatTile({ label, value, sub, icon: I, tone = 'accent', delta, deltaGood, hint }: { label: string; value: ReactNode; sub?: ReactNode; icon?: IconT; tone?: StatTone; delta?: string; deltaGood?: boolean; hint?: string }) {
  const t = TONES[tone]
  return (
    // Sleek tile: no hard stripe — a soft tone glow in the corner, a gradient icon chip and a hover lift.
    <div className="tile-hover relative rounded-[14px] bg-white border border-[#E6EAF0] shadow-card overflow-hidden px-4 pt-4 pb-3.5 min-w-0" title={hint}>
      <span className="pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-60" style={{ background: `radial-gradient(circle, ${t.bg} 0%, transparent 70%)` }} />
      <div className="relative flex items-center gap-2.5">
        {I && <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 ring-1 ring-inset ring-black/[0.03]" style={{ background: `linear-gradient(145deg, #fff 0%, ${t.bg} 100%)`, color: t.fg }}><I size={15} /></span>}
        <span className="text-[12px] font-semibold text-muted-b truncate">{label}</span>
      </div>
      <div className="relative text-[26px] font-extrabold text-ink tracking-[-0.03em] mt-3 leading-none tabular-nums" style={tone === 'warn' || tone === 'bad' ? { color: t.fg } : undefined}>{value}</div>
      <div className="relative flex items-center gap-1.5 mt-2 min-h-[16px]">
        {delta && <span className={classNames('text-[11px] font-bold rounded px-1 py-px', deltaGood === undefined ? 'bg-control text-muted-b' : deltaGood ? 'bg-positive-wash text-positive' : 'bg-negative-wash text-negative')}>{delta}</span>}
        {sub && <span className="text-[11.5px] text-muted-2 truncate">{sub}</span>}
      </div>
    </div>
  )
}

/* ---------- Panel — a titled section card with a clear header ---------- */
export function Panel({ title, sub, icon: I, action, children, className, pad = true }: { title: string; sub?: string; icon?: IconT; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={classNames('rounded-[14px] bg-white border border-[#E6EAF0] shadow-card overflow-hidden', className)}>
      <header className="px-5 py-3.5 border-b border-[#EEF1F5] flex items-center gap-2.5">
        {I && <span className="w-8 h-8 rounded-[10px] text-accent flex items-center justify-center shrink-0 ring-1 ring-inset ring-accent/10" style={{ background: 'linear-gradient(145deg, #F4FBF9 0%, #DDF2EB 100%)' }}><I size={15} /></span>}
        <div className="min-w-0 flex-1"><div className="text-[14.5px] font-bold text-ink leading-tight">{title}</div>{sub && <div className="text-[12px] text-muted-2 mt-0.5 truncate">{sub}</div>}</div>
        {action}
      </header>
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

/* ---------- Section eyebrow ---------- */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow text-muted-3">{children}</div>
}

/* ---------- Progress bar ---------- */
export function Progress({ value, color = '#13927B', height = 8, track = '#EEF0F4' }: { value: number; color?: string; height?: number; track?: string }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: track }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  )
}
