import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { Button, Segmented, Progress } from '../components/ui'
import { SubSidebar } from '../components/chrome'
import { Plus, Grid, Target, Bars } from '../components/icons'
import { useActions } from '../store/store'

const revenue = [
  { m: 'Apr', v: 210, t: 180 },
  { m: 'May', v: 165, t: 190 },
  { m: 'Jun', v: 240, t: 200 },
  { m: 'Jul', v: 195, t: 210 },
  { m: 'Aug', v: 260, t: 220 },
  { m: 'Sep', v: 140, t: 230 },
]
const conversion = [
  { s: 'Qualified → Contact Made', v: 82 },
  { s: 'Contact Made → Demo Scheduled', v: 61 },
  { s: 'Demo Scheduled → Proposal Made', v: 47 },
  { s: 'Proposal Made → Negotiations Started', v: 38 },
  { s: 'Negotiations Started → Won', v: 31 },
]
const lossReasons = [
  ['Price', 34],
  ['Timing / budget frozen', 26],
  ['Lost to competitor', 21],
  ['No decision', 19],
] as const
const activityMix = [
  ['Calls', 88, '#1D4ED8'],
  ['Emails', 146, '#3A67E4'],
  ['Meetings', 42, '#5B85F0'],
  ['Tasks', 63, '#8FB0FF'],
] as const
const leaderboard = [
  ['Jordan Miles', 612, true],
  ['Priya Nair', 548, false],
  ['Marcus Webb', 421, false],
  ['Sana Ali', 389, false],
] as const

export function Insights() {
  const act = useActions()
  const [view, setView] = useState('Performance')
  const [report, setReport] = useState('Sales performance')
  const maxRev = 280
  return (
    <>
      <TopBar
        title="Insights"
        center={<Segmented options={['Performance', 'Conversion', 'Activity', 'Goals']} value={view} onChange={setView} />}
        actions={
          <>
            <Button>This quarter</Button>
            <Button>All teams</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => act.toast('New report builder (demo)', 'accent')}>New report</Button>
          </>
        }
      />
      <div className="flex-1 flex min-h-0">
        <SubSidebar
          width={220}
          active={report}
          onSelect={setReport}
          top={
            <button onClick={() => act.toast('Create dashboard or report (demo)', 'accent')} className="w-full h-9 rounded-control border border-border text-[13px] font-medium text-ink-3 flex items-center justify-center gap-1.5 hover:bg-control">
              <Plus size={16} /> Create
            </button>
          }
          groups={[
            { heading: 'Dashboards', items: [
              { label: 'Sales performance', icon: Grid },
              { label: 'Team activity', icon: Grid },
            ] },
            { heading: 'Goals', items: [{ label: 'Q3 revenue goal', icon: Target }] },
            { heading: 'Reports', items: [
              { label: 'Pipeline conversion', icon: Bars },
              { label: 'Deals won by source', icon: Bars },
              { label: 'Loss reasons', icon: Bars },
            ] },
          ]}
        />
        <main className="flex-1 overflow-y-auto p-7 flex flex-col gap-5">
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
          {/* revenue vs target */}
          <div className="bg-surface border border-border rounded-card p-5 flex flex-col" style={{ minHeight: 330 }}>
            <div className="text-[15px] font-semibold text-ink">Revenue vs. target</div>
            <div className="flex-1 flex items-end gap-6 pt-8">
              {revenue.map((r) => {
                const above = r.v >= r.t
                return (
                  <div key={r.m} className="flex-1 flex flex-col items-center gap-2 relative">
                    <div className="relative w-full flex justify-center" style={{ height: 200 }}>
                      <div className="w-8 rounded-t self-end" style={{ height: (r.v / maxRev) * 200, background: above ? '#0E7C66' : '#1D4ED8' }} />
                      <div className="absolute left-0 right-0" style={{ bottom: (r.t / maxRev) * 200, borderTop: '1.5px solid #C3CBD8' }} />
                    </div>
                    <div className="text-[12px] text-muted-2b">{r.m}</div>
                  </div>
                )
              })}
            </div>
            <div className="text-[12px] text-muted-2 mt-2">Bars green when at or above the monthly target line.</div>
          </div>

          {/* stage conversion */}
          <div className="bg-surface border border-border rounded-card p-5">
            <div className="text-[15px] font-semibold text-ink mb-4">Stage conversion</div>
            <div className="flex flex-col gap-3.5">
              {conversion.map((c) => (
                <div key={c.s}>
                  <div className="flex justify-between text-[12px] mb-1.5">
                    <span className="text-ink-3">{c.s}</span>
                    <span className="font-semibold text-ink-2">{c.v}%</span>
                  </div>
                  <Progress value={c.v} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface border border-border rounded-card p-5">
            <div className="text-[15px] font-semibold text-ink mb-4">Loss reasons</div>
            <div className="flex flex-col gap-3">
              {lossReasons.map(([label, v]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[13px] text-ink-3">{label}</span>
                  <span className="text-[13px] font-semibold text-ink-2">{v}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-card p-5">
            <div className="text-[15px] font-semibold text-ink mb-4">Activity mix</div>
            <div className="flex items-end gap-4 h-[150px]">
              {activityMix.map(([label, v, color]) => (
                <div key={label} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full rounded-t" style={{ height: (v / 160) * 120, background: color }} />
                  <div className="text-[11px] text-muted-2 text-center">{label}<br /><span className="font-semibold text-ink-3">{v}</span></div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-card p-5">
            <div className="text-[15px] font-semibold text-ink mb-4">Leaderboard</div>
            <div className="flex flex-col gap-2.5">
              {leaderboard.map(([name, v, me], i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="w-5 text-[12px] text-muted-3 font-semibold">{i + 1}</span>
                  <span className={'text-[13px] flex-1 ' + (me ? 'font-bold text-ink' : 'text-ink-2')}>{name}</span>
                  <span className="text-[13px] font-semibold text-ink-2">${v}K</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[10px] bg-accent-wash-3 border border-[#D3E0FA] p-3 text-[12px] text-accent-700 font-medium">
              You’re 1st this quarter — $64K ahead of 2nd.
            </div>
          </div>
        </div>
        </main>
      </div>
    </>
  )
}
