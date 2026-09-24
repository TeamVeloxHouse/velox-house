/* Customer-portal engagement — shared by the portals list and the portal analytics page. */
import type { CustomerPortal, PortalEvent, Deal, Showroom } from '../store/types'

const DAY = 86_400_000

export type PortalRow = {
  p: CustomerPortal
  showroom?: Showroom
  stage: 'awaiting' | 'pre-install' | 'installing' | 'live'
  stageLabel: string
  progress: number // 0–1 through the install journey
  currentStep: string
  logins: number
  logins30: number
  lastLogin?: number
  views: number
  minutes: number
  score: number // 0–100 engagement
  dormant: boolean
}

export function portalRows(portals: CustomerPortal[], events: PortalEvent[], deals: Deal[], now = Date.now()): PortalRow[] {
  const byPortal = new Map<string, PortalEvent[]>()
  events.forEach((e) => { const a = byPortal.get(e.portalId); if (a) a.push(e); else byPortal.set(e.portalId, [e]) })
  return portals.map((p) => {
    const ev = byPortal.get(p.id) ?? []
    const logins = ev.filter((e) => e.kind === 'login')
    const views = ev.filter((e) => e.kind !== 'login')
    const steps = p.journey ?? []
    const done = steps.filter((s) => s.done).length
    const installed = steps.find((s) => s.key === 'installed')?.done
    const soon = p.installDate && !installed && new Date(p.installDate).getTime() - now < 14 * DAY
    const stage: PortalRow['stage'] = p.status === 'invited' ? 'awaiting' : installed ? 'live' : soon ? 'installing' : 'pre-install'
    const lastLogin = logins.reduce((m, e) => Math.max(m, e.at), 0) || undefined
    const logins30 = logins.filter((e) => now - e.at < 30 * DAY).length
    const minutes = Math.round(views.reduce((s, e) => s + (e.dwellMs ?? 0), 0) / 60000)
    const score = Math.min(100, Math.round(logins30 * 9 + Math.min(40, views.length * 1.2) + (lastLogin && now - lastLogin < 7 * DAY ? 15 : 0)))
    return {
      p, showroom: deals.find((d) => d.id === p.dealId)?.journey?.showroom, stage,
      stageLabel: { awaiting: 'Awaiting first login', 'pre-install': 'Waiting for install', installing: 'Installing soon', live: 'Live system' }[stage],
      progress: steps.length ? done / steps.length : 0, currentStep: steps.find((s) => !s.done)?.label ?? 'All done',
      logins: logins.length, logins30, lastLogin, views: views.length, minutes, score,
      dormant: p.status === 'active' && (!lastLogin || now - lastLogin > 30 * DAY),
    }
  })
}

export const relTime = (t?: number, now = Date.now()) => {
  if (!t) return 'Never'
  const d = Math.floor((now - t) / DAY)
  return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 30 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`
}
