/* One fixed vocabulary for anything scheduled in the CRM, so every event is recorded the same way
 * and can be reported on (e.g. "consultations booked per showroom", "follow-up calls per adviser"). */

export const EVENT_TYPES = [
  { id: 'meeting', label: 'Meeting' },
  { id: 'call', label: 'Call' },
  { id: 'task', label: 'Task' },
  { id: 'email', label: 'Email' },
] as const
export type EventTypeId = (typeof EVENT_TYPES)[number]['id']

export const PURPOSES: Record<EventTypeId, string[]> = {
  meeting: ['Consultation', 'Proposal walk-through', 'Showroom visit', 'Home visit', 'Site survey', 'Install pre-start', 'Handover', 'Aftercare review', 'Internal / team'],
  call: ['First contact', 'Follow-up', 'Booking confirmation', 'Finance query', 'Proposal follow-up', 'Install update', 'Issue / complaint', 'Aftercare check-in'],
  task: ['Send proposal', 'Chase documents', 'Book survey', 'Raise DNO application', 'Order kit', 'Book scaffold', 'Prepare paperwork', 'Review design'],
  email: ['Quote follow-up', 'Information pack', 'Booking confirmation', 'Chaser', 'Handover pack'],
}

export const LOCATIONS = ['Cardiff showroom', 'Cheltenham showroom', 'Melksham showroom', "Customer's home", 'Video call', 'Phone', 'Office'] as const
export const DURATIONS = [15, 30, 45, 60, 90, 120, 180] as const
export const REMINDERS = [{ id: 'none', label: 'No reminder' }, { id: '15m', label: '15 minutes before' }, { id: '1h', label: '1 hour before' }, { id: '1d', label: 'The day before' }] as const
export const fmtDuration = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60} hour${m === 60 ? '' : 's'}`)
