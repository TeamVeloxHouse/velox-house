import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Segmented, Kpi, Chip, type ChipTone } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Plus, Users, Megaphone, Sparkle, Send } from '../components/icons'
import { Modal, Field, Input, Textarea } from '../components/overlays'
import { useActions, useState_ } from '../store/store'
import { classNames } from '../lib/format'

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
  const { connections, socialPosts } = useState_()
  const [view, setView] = useState('All')
  const [post, setPost] = useState(false)
  const socialChannels = connections.filter((c) => c.kind === 'social' && c.connected)
  const template = '2fr 1fr 1fr 0.9fr 0.9fr 1fr 1fr'
  return (
    <>
      <TopBar
        title="Campaigns"
        center={<Segmented options={['All', 'Email', 'Sequences', 'Social']} value={view} onChange={setView} />}
        actions={
          <>
            <Button icon={<Users size={16} />} onClick={() => act.toast('Audience builder (demo)', 'accent')}>Audience</Button>
            <Button icon={<Megaphone size={16} />} onClick={() => setPost(true)}>Schedule post</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => act.toast('New campaign (demo)', 'accent')}>New campaign</Button>
          </>
        }
      />
      <PageBody>
        {view === 'Social' ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] text-muted-b mr-1">Connected channels:</span>
              {socialChannels.map((c) => (<span key={c.id} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full text-white" style={{ background: c.color }}>{c.provider}</span>))}
              <button onClick={() => setPost(true)} className="ml-auto"><Button variant="primary" icon={<Plus size={16} />}>Schedule post</Button></button>
            </div>
            <div className="text-[15px] font-semibold text-ink mt-2">Scheduled &amp; posted</div>
            <div className="flex flex-col gap-3">
              {socialPosts.map((p) => (
                <div key={p.id} className="bg-surface border border-border rounded-card p-4 flex items-start gap-3.5">
                  <span className="w-9 h-9 rounded-[10px] bg-accent-wash text-accent flex items-center justify-center shrink-0"><Megaphone size={17} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.channels.map((ch) => (<span key={ch} className="text-[11px] font-semibold text-ink-3 bg-control rounded px-1.5 py-0.5">{ch}</span>))}
                      <Chip tone={p.status === 'posted' ? 'positive' : p.status === 'scheduled' ? 'accent' : 'neutral'} dot>{p.status}</Chip>
                      <span className="ml-auto text-[12px] text-muted-2">{p.when}</span>
                    </div>
                    <div className="text-[13px] text-ink-2 leading-relaxed mt-2">{p.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
        <>
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
        </>
        )}
      </PageBody>
      <SocialComposer open={post} onClose={() => setPost(false)} channels={socialChannels.map((c) => c.provider)} onSchedule={(ch, body, when) => { act.schedulePost(ch, body, when); setView('Social'); setPost(false) }} />
    </>
  )
}

function SocialComposer({ open, onClose, channels, onSchedule }: { open: boolean; onClose: () => void; channels: string[]; onSchedule: (channels: string[], body: string, when: string) => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set(channels))
  const [body, setBody] = useState('')
  const [when, setWhen] = useState('Tomorrow · 09:00')
  return (
    <Modal open={open} onClose={onClose} title="Schedule social post" subtitle="Publishes to every selected network through one unified API" width={560}
      footer={<><Button icon={<Sparkle size={15} />} onClick={() => setBody('Excited to share how we’re helping energy teams close faster with AI-native CRM. Read the story 👇')}>Draft with AI</Button><Button variant="primary" icon={<Send size={15} />} onClick={() => body.trim() && sel.size > 0 && onSchedule([...sel], body, when)}>Schedule</Button></>}>
      <Field label="Channels">
        <div className="flex flex-wrap gap-2">
          {channels.map((ch) => {
            const on = sel.has(ch)
            return <button key={ch} onClick={() => setSel((s) => { const n = new Set(s); n.has(ch) ? n.delete(ch) : n.add(ch); return n })} className={classNames('h-8 px-3 rounded-lg text-[12.5px] font-semibold border', on ? 'bg-accent text-white border-accent' : 'border-border text-muted-b')}>{ch}</button>
          })}
        </div>
      </Field>
      <Field label="Post"><Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What’s happening?" autoFocus /></Field>
      <Field label="When"><Input value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
    </Modal>
  )
}
