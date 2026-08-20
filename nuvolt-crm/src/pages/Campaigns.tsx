import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Segmented, Kpi, Chip, type ChipTone } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Plus, Users, File } from '../components/icons'
import { useActions } from '../store/store'

type Status = 'Sending' | 'Live' | 'Complete' | 'Draft'
const statusTone: Record<Status, ChipTone> = { Sending: 'accent', Live: 'positive', Complete: 'neutral', Draft: 'warning' }

const campaigns: { name: string; type: string; sent: number; opens: number; clicks: number; deals: number; status: Status }[] = [
  { name: 'Q3 Renewables outreach', type: 'Sequence', sent: 480, opens: 62, clicks: 18, deals: 9, status: 'Sending' },
  { name: 'Data-centre resilience', type: 'Email', sent: 1240, opens: 48, clicks: 12, deals: 14, status: 'Live' },
  { name: 'Grid webinar invite', type: 'Email', sent: 890, opens: 55, clicks: 21, deals: 6, status: 'Complete' },
  { name: 'EV fleet nurture', type: 'Sequence', sent: 0, opens: 0, clicks: 0, deals: 0, status: 'Draft' },
  { name: 'Site survey follow-up', type: 'Form', sent: 210, opens: 71, clicks: 34, deals: 4, status: 'Live' },
]

export function Campaigns() {
  const act = useActions()
  const [view, setView] = useState('All')
  const template = '2fr 1fr 1fr 0.9fr 0.9fr 1fr 1fr'
  return (
    <>
      <TopBar
        title="Campaigns"
        center={<Segmented options={['All', 'Email', 'Sequences', 'Forms']} value={view} onChange={setView} />}
        actions={
          <>
            <Button icon={<Users size={16} />} onClick={() => act.toast('Audience builder (demo)', 'accent')}>Audience</Button>
            <Button icon={<File size={16} />} onClick={() => act.toast('Templates (demo)', 'accent')}>Templates</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => act.toast('New campaign (demo)', 'accent')}>New campaign</Button>
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-4 gap-4">
          <Kpi label="Emails sent" value="2,820" delta="Last 30 days" deltaTone="muted" />
          <Kpi variant="blue" label="Avg. open rate" value="54%" delta="+4 pts" />
          <Kpi label="Leads created" value="126" delta="+18 this month" />
          <Kpi variant="deep" label="Pipeline influenced" value="$680K" delta="Across 33 deals" />
        </div>
        <Table
          template={template}
          columns={[
            { key: 'name', header: 'Campaign' },
            { key: 'type', header: 'Type' },
            { key: 'sent', header: 'Sent', align: 'right' },
            { key: 'opens', header: 'Opens', align: 'right' },
            { key: 'clicks', header: 'Clicks', align: 'right' },
            { key: 'deals', header: 'Deals created', align: 'right' },
            { key: 'status', header: 'Status' },
          ]}
          footer={<><span>{campaigns.length} campaigns</span><span>Updated live</span></>}
        >
          {campaigns.map((c) => (
            <Row key={c.name} template={template}>
              <Cell className="font-semibold text-ink-2">{c.name}</Cell>
              <Cell muted>{c.type}</Cell>
              <Cell align="right" className="text-ink-2">{c.sent.toLocaleString()}</Cell>
              <Cell align="right" muted>{c.opens ? `${c.opens}%` : '—'}</Cell>
              <Cell align="right" muted>{c.clicks ? `${c.clicks}%` : '—'}</Cell>
              <Cell align="right" className="font-semibold text-ink-2">{c.deals}</Cell>
              <Cell><Chip tone={statusTone[c.status]} dot>{c.status}</Chip></Cell>
            </Row>
          ))}
        </Table>
      </PageBody>
    </>
  )
}
