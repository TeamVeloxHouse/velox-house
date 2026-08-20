import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Chip } from '../components/ui'
import { Bolt, Filter, Envelope, Task, Bell } from '../components/icons'
import { useActions } from '../store/store'

const steps = [
  { group: 'Trigger', icon: Bolt, title: 'Deal enters "Qualified"', sub: 'When a deal is moved into the Qualified stage', trigger: true },
  { group: 'Conditions', icon: Filter, title: 'Value is over $50,000', sub: 'Only run for higher-value opportunities' },
  { group: 'Actions', icon: Envelope, title: 'Send intro email from owner', sub: 'Template: "Qualified — next steps"' },
  { group: 'Actions', icon: Task, title: 'Create follow-up task', sub: 'Due 2 business days after entry' },
  { group: 'Actions', icon: Bell, title: 'Notify sales manager', sub: 'Slack #deals channel' },
]

export function Automation() {
  const act = useActions()
  return (
    <>
      <TopBar
        title="Automation"
        crumbs={['Qualified deal handoff']}
        center={<Chip tone="positive" dot>On</Chip>}
        actions={
          <>
            <Button onClick={() => act.toast('48 runs in the last 30 days', 'accent')}>Run history</Button>
            <Button onClick={() => act.toast('Test run complete — 1 email, 1 task created')}>Test</Button>
            <Button variant="primary" onClick={() => act.toast('Automation saved')}>Save</Button>
          </>
        }
      />
      <PageBody>
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 320px' }}>
          {/* canvas */}
          <div className="bg-surface border border-border rounded-card p-7">
            <div className="relative flex flex-col gap-0">
              {steps.map((s, i) => {
                const first = i === 0
                const prevGroup = steps[i - 1]?.group
                const showGroup = s.group !== prevGroup
                return (
                  <div key={i}>
                    {showGroup && <div className="eyebrow text-muted-3 mb-2.5 mt-4 first:mt-0">{s.group}</div>}
                    {!first && !showGroup && <div className="w-0.5 h-5 bg-[#D6DCE6] ml-[26px]" />}
                    {!first && showGroup && <div className="w-0.5 h-5 bg-[#D6DCE6] ml-[26px] -mt-2" />}
                    <div
                      className="w-[420px] max-w-full rounded-card p-4 flex items-center gap-3.5 border"
                      style={{
                        borderColor: s.trigger ? '#1D4ED8' : '#E4E8EE',
                        boxShadow: s.trigger ? '0 6px 18px rgba(29,78,216,0.13)' : undefined,
                      }}
                    >
                      <span
                        className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0"
                        style={{ background: s.trigger ? '#1D4ED8' : '#EEF2FB', color: s.trigger ? '#fff' : '#1D4ED8' }}
                      >
                        <s.icon size={17} />
                      </span>
                      <div>
                        <div className="text-[14px] font-semibold text-ink">{s.title}</div>
                        <div className="text-[12px] text-muted-2 mt-0.5">{s.sub}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div className="w-0.5 h-5 bg-[#D6DCE6] ml-[26px]" />
              <button onClick={() => act.toast('Add action (demo)', 'accent')} className="w-[420px] max-w-full rounded-card border border-dashed border-input-border text-[13px] text-muted-2 py-3 hover:border-accent hover:text-accent transition-colors">
                + Add action
              </button>
            </div>
          </div>

          {/* right panel */}
          <div className="flex flex-col gap-4">
            <div className="bg-surface border border-border rounded-card p-5">
              <div className="text-[15px] font-semibold text-ink mb-3.5">Last 30 days</div>
              <PerfRow label="Times run" value="48" />
              <PerfRow label="Emails sent" value="48" />
              <PerfRow label="Tasks created" value="48" />
              <PerfRow label="Errors" value="0" tone="#0E7C66" />
            </div>
            <div className="bg-surface border border-border rounded-card p-5">
              <div className="text-[15px] font-semibold text-ink mb-3">Other automations</div>
              <StatusRow name="Lead round-robin" on />
              <StatusRow name="Stale deal nudge" on />
              <StatusRow name="Won → onboarding" on={false} />
            </div>
            <div className="rounded-card bg-accent-wash-3 border border-[#D3E0FA] p-4 text-[12px] text-accent-700 leading-relaxed">
              Changes take effect on the next matching trigger. Deals already in Qualified won’t be re-processed.
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
function StatusRow({ name, on }: { name: string; on: boolean }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="w-2 h-2 rounded-full" style={{ background: on ? '#0E7C66' : '#C3CBD8' }} />
      <span className="text-[13px] text-ink-2">{name}</span>
      <span className="ml-auto text-[12px] text-muted-3">{on ? 'On' : 'Off'}</span>
    </div>
  )
}
