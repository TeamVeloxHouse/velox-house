import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Chip } from '../components/ui'
import { Bolt, Filter, Envelope, Task, Bell, Bars, Clock, Plus, Check } from '../components/icons'
import { useState_, useActions, uid } from '../store/store'
import type { AutoStepKind } from '../store/types'

const kindIcon: Record<AutoStepKind, any> = { trigger: Bolt, condition: Filter, email: Envelope, task: Task, notify: Bell, stage: Bars, wait: Clock }
const groupOf: Record<AutoStepKind, string> = { trigger: 'Trigger', condition: 'Conditions', email: 'Actions', task: 'Actions', notify: 'Actions', stage: 'Actions', wait: 'Actions' }
const addable: { kind: AutoStepKind; title: string; subtitle: string }[] = [
  { kind: 'email', title: 'Send an email', subtitle: 'From the deal owner' },
  { kind: 'task', title: 'Create a task', subtitle: 'Assigned to the owner' },
  { kind: 'notify', title: 'Send a notification', subtitle: 'Slack or in-app' },
  { kind: 'stage', title: 'Move deal stage', subtitle: 'Advance automatically' },
  { kind: 'wait', title: 'Wait', subtitle: 'Delay before next step' },
  { kind: 'condition', title: 'Add a condition', subtitle: 'Branch on a field' },
]

export function Automation() {
  const { id } = useParams()
  const nav = useNavigate()
  const { automations } = useState_()
  const act = useActions()
  const automation = automations.find((a) => a.id === id) ?? automations[0]
  const [menuOpen, setMenuOpen] = useState(false)

  if (!automation) return (<><TopBar title="Automation" /><PageBody><div className="text-muted-b">No rule found. <button onClick={() => nav('/agents')} className="text-accent font-semibold">Back to Automations</button>.</div></PageBody></>)

  const steps = automation.steps
  function addStep(kind: AutoStepKind, title: string, subtitle: string) {
    act.updateAutomation(automation.id, { steps: [...steps, { id: uid('as'), kind, title, subtitle }] })
    setMenuOpen(false)
    act.toast('Step added')
  }
  function removeStep(id: string) {
    act.updateAutomation(automation.id, { steps: steps.filter((s) => s.id !== id) })
  }

  return (
    <>
      <TopBar
        title="Automations"
        crumbs={['Rules', automation.name]}
        center={<Chip tone={automation.active ? 'positive' : 'neutral'} dot>{automation.active ? 'On' : 'Off'}</Chip>}
        actions={
          <>
            <Button onClick={() => nav('/agents')}>← All automations</Button>
            <Button onClick={() => act.updateAutomation(automation.id, { active: !automation.active })}>{automation.active ? 'Turn off' : 'Turn on'}</Button>
            <Button onClick={() => act.toast('Test run complete — 1 email, 1 task created')}>Test</Button>
            <Button variant="primary" icon={<Check size={16} />} onClick={() => act.saveAutomation(automation.id, {})}>Save</Button>
          </>
        }
      />
      <PageBody>
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 320px' }}>
          <div className="bg-surface border border-border rounded-card p-7">
            <div className="flex flex-col gap-0">
              {steps.map((s, i) => {
                const Icon = kindIcon[s.kind]
                const prevGroup = i > 0 ? groupOf[steps[i - 1].kind] : null
                const showGroup = groupOf[s.kind] !== prevGroup
                const trigger = s.kind === 'trigger'
                return (
                  <div key={s.id}>
                    {showGroup && <div className="eyebrow text-muted-3 mb-2.5 mt-4 first:mt-0">{groupOf[s.kind]}</div>}
                    {i > 0 && <div className="w-0.5 h-5 bg-[#D6DCE6] ml-[26px]" />}
                    <div className="group w-[440px] max-w-full rounded-card p-4 flex items-center gap-3.5 border" style={{ borderColor: trigger ? '#1D4ED8' : '#E4E8EE', boxShadow: trigger ? '0 6px 18px rgba(29,78,216,0.13)' : undefined }}>
                      <span className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0" style={{ background: trigger ? '#1D4ED8' : '#EEF2FB', color: trigger ? '#fff' : '#1D4ED8' }}><Icon size={17} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold text-ink">{s.title}</div>
                        <div className="text-[12px] text-muted-2 mt-0.5">{s.subtitle}</div>
                      </div>
                      {!trigger && <button onClick={() => removeStep(s.id)} className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center text-muted-2 hover:text-negative hover:bg-negative-wash text-[16px]">×</button>}
                    </div>
                  </div>
                )
              })}
              <div className="w-0.5 h-5 bg-[#D6DCE6] ml-[26px]" />
              <div className="relative w-[440px] max-w-full">
                <button onClick={() => setMenuOpen((o) => !o)} className="w-full rounded-card border border-dashed border-input-border text-[13px] text-muted-2 py-3 hover:border-accent hover:text-accent transition-colors flex items-center justify-center gap-1.5"><Plus size={15} /> Add step</button>
                {menuOpen && (
                  <div className="absolute z-30 mt-1 left-0 right-0 bg-surface border border-border rounded-card shadow-modal overflow-hidden">
                    {addable.map((a) => {
                      const Icon = kindIcon[a.kind]
                      return (
                        <button key={a.kind} onClick={() => addStep(a.kind, a.title, a.subtitle)} className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-control border-b border-divider last:border-0">
                          <span className="w-7 h-7 rounded-lg bg-accent-wash text-accent flex items-center justify-center"><Icon size={14} /></span>
                          <span><span className="block text-[13px] font-semibold text-ink-2">{a.title}</span><span className="block text-[12px] text-muted-2">{a.subtitle}</span></span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-surface border border-border rounded-card p-5">
              <div className="text-[15px] font-semibold text-ink mb-3.5">Last 30 days</div>
              <PerfRow label="Times run" value="48" />
              <PerfRow label="Emails sent" value="48" />
              <PerfRow label="Tasks created" value="48" />
              <PerfRow label="Errors" value="0" tone="#0E7C66" />
            </div>
            <div className="rounded-card bg-accent-wash-3 border border-[#D3E0FA] p-4 text-[12px] text-accent-700 leading-relaxed">
              Changes take effect on the next matching trigger. Deals already in this stage won’t be re-processed.
            </div>
          </div>
        </div>
      </PageBody>
    </>
  )
}

function PerfRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[13px] text-muted-b">{label}</span>
      <span className="text-[13px] font-semibold" style={{ color: tone ?? '#1B2534' }}>{value}</span>
    </div>
  )
}
