/* Delivery (ops) templates + project factory — Phase 4. */
import type { StudioProject, ProjectMilestone, ProjectTask, ProductLine } from '../store/types'
import type { SolarDesign } from './solar'

export const MILESTONES: { key: string; label: string }[] = [
  { key: 'sold', label: 'Sold' },
  { key: 'survey', label: 'Site survey' },
  { key: 'design', label: 'Design sign-off' },
  { key: 'permit', label: 'DNO / Permit' },
  { key: 'scheduled', label: 'Install scheduled' },
  { key: 'installed', label: 'Installed' },
  { key: 'commissioned', label: 'Commissioned' },
  { key: 'pto', label: 'PTO / Handover' },
]

const DEFAULT_TASKS = [
  'Book site survey',
  'Complete MCS paperwork',
  'Submit DNO / G99 application',
  'Order panels & inverter',
  'Book scaffolding',
  'Book install team & electrician',
  'Install & test',
  'Building control / inspection',
  'Issue MCS certificate',
  'Submit for PTO',
  'Handover pack to customer',
]

let seq = 5000
const pid = () => `pj${(seq++).toString(36)}`

export function buildProject(opts: {
  dealId?: string
  address: string
  customer: string
  owner: string
  value: number
  design?: SolarDesign
  milestoneIndex?: number
  createdAt?: number
}): StudioProject {
  const milestones: ProjectMilestone[] = MILESTONES.map((m, i) => ({ ...m, done: i < (opts.milestoneIndex ?? 0) }))
  const tasks: ProjectTask[] = DEFAULT_TASKS.map((label, i) => ({ id: `t${i}`, label, done: i < (opts.milestoneIndex ?? 0) }))
  const products: ProductLine[] = []
  if (opts.design) products.push({ name: 'Solar PV', detail: `${opts.design.panels} panels · ${opts.design.systemKwp} kWp`, value: opts.design.systemCost })
  else products.push({ name: 'Solar PV', detail: 'System', value: opts.value })
  return {
    id: pid(),
    dealId: opts.dealId,
    address: opts.address,
    customer: opts.customer,
    owner: opts.owner,
    value: opts.value,
    systemKwp: opts.design?.systemKwp,
    milestoneIndex: opts.milestoneIndex ?? 0,
    milestones,
    tasks,
    products,
    createdAt: opts.createdAt ?? Date.now(),
  }
}
