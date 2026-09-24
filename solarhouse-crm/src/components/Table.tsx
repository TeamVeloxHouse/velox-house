import type { ReactNode } from 'react'
import { classNames } from '../lib/format'

export type Col = { key: string; header: ReactNode; align?: 'left' | 'right' | 'center' }

export function Table({
  columns,
  template,
  children,
  footer,
}: {
  columns: Col[]
  template: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="bg-surface border border-border rounded-card overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div
            className="grid bg-[#F2F6FE] border-b border-border-blue-2 px-5"
            style={{ gridTemplateColumns: template }}
          >
            {columns.map((c, i) => (
              <div
                key={i}
                className={classNames(
                  'py-3 text-[11px] uppercase tracking-[0.07em] font-semibold text-muted-2b',
                  c.align === 'right' && 'text-right',
                  c.align === 'center' && 'text-center',
                )}
              >
                {c.header}
              </div>
            ))}
          </div>
          <div>{children}</div>
        </div>
      </div>
      {footer && (
        <div className="flex items-center justify-between px-5 py-3 text-[12px] text-muted-2 border-t border-divider">
          {footer}
        </div>
      )}
    </div>
  )
}

export function Row({
  template,
  children,
  onClick,
  highlight,
}: {
  template: string
  children: ReactNode
  onClick?: () => void
  highlight?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={classNames(
        'grid items-center px-5 border-b border-divider-row last:border-0 text-[13px] transition-colors duration-150',
        onClick && 'cursor-pointer hover:bg-[#F7F9FC]',
        highlight && 'bg-accent-wash-4',
      )}
      style={{ gridTemplateColumns: template }}
    >
      {children}
    </div>
  )
}

export function Cell({
  children,
  align = 'left',
  className,
  muted,
}: {
  children: ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
  muted?: boolean
}) {
  return (
    <div
      className={classNames(
        'py-[13px] pr-3 min-w-0',
        align === 'right' && 'text-right pr-0 pl-3',
        align === 'center' && 'text-center',
        muted && 'text-muted',
        className,
      )}
    >
      {children}
    </div>
  )
}
