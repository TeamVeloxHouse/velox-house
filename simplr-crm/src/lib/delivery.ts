/* Delivery (ops) templates + project factory — Phase 4. */
import type { StudioProject, ProjectMilestone, ProjectTask, ProductLine, ProjectOrder, ProjectInvoice, OrderItem, InvoiceKind } from '../store/types'
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
let oseq = 7000
export const oid = () => `or${(oseq++).toString(36)}`
let iseq = 9000
export const invid = () => `in${(iseq++).toString(36)}`

const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export function buildOrder(supplier: string, items: OrderItem[]): ProjectOrder {
  return { id: oid(), supplier, items, status: 'draft' }
}

/** Next sensible invoice number for a project (INV-<pid>-NN). */
export function nextInvoiceNumber(p: StudioProject): string {
  const n = (p.invoices?.length ?? 0) + 1
  return `INV-${p.id.toUpperCase()}-${String(n).padStart(2, '0')}`
}

export function buildInvoice(p: StudioProject, kind: InvoiceKind, amount: number): ProjectInvoice {
  return { id: invid(), number: nextInvoiceNumber(p), kind, amount, status: 'draft', issuedDate: today(), dueDate: plusDays(14) }
}

export const orderTotal = (o: ProjectOrder) => o.items.reduce((s, it) => s + it.qty * it.unitCost, 0)

/** Money summary for a project: what's been ordered, invoiced, paid and what's still outstanding. */
export function projectFinance(p: StudioProject) {
  const orders = p.orders ?? []
  const invoices = p.invoices ?? []
  const orderedCost = orders.reduce((s, o) => s + orderTotal(o), 0)
  const invoiced = invoices.reduce((s, i) => s + i.amount, 0)
  const paid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
  const outstanding = invoiced - paid
  const uninvoiced = Math.max(0, p.value - invoiced)
  const grossMargin = p.value - orderedCost
  return { orderedCost, invoiced, paid, outstanding, uninvoiced, grossMargin }
}

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
