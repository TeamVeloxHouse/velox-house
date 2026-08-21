import type { ReactNode } from 'react'
import { classNames } from '../lib/format'

/** Scrollable working surface under the top bar. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={classNames('flex-1 overflow-y-auto p-7 flex flex-col gap-5', className)}>{children}</main>
}
