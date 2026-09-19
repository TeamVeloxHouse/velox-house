import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { Button, Avatar, Progress } from '../components/ui'
import { SubSidebar, ViewSwitch } from '../components/chrome'
import { Table, Row, Cell } from '../components/Table'
import { Plus, Bars, Grid, Flow, File, Box, Task, Filter } from '../components/icons'

const columns = ['Kick-off', 'Design', 'Install', 'Commissioning', 'Complete']
type Proj = { name: string; client: string; start: string; due: string; phase: string; progress: number; team: string[] }
const projects: Proj[] = [
  { name: 'Substation Phase 2', client: 'Meridian Power', start: '19 Aug', due: '12 Nov', phase: 'Kick-off', progress: 8, team: ['Jordan Miles', 'Priya Nair'] },
  { name: 'Campus microgrid', client: 'Fenwick University', start: '2 Sep', due: '1 Dec', phase: 'Design', progress: 32, team: ['Priya Nair'] },
  { name: 'EV charger rollout', client: 'Harbour Logistics', start: '28 Aug', due: '30 Oct', phase: 'Design', progress: 21, team: ['Marcus Webb', 'Sana Ali'] },
  { name: 'Solar + storage', client: 'Brightleaf Farms', start: '11 Aug', due: '20 Oct', phase: 'Install', progress: 54, team: ['Jordan Miles'] },
  { name: 'UPS refresh', client: 'Cirrus Hosting', start: '5 Aug', due: '8 Oct', phase: 'Commissioning', progress: 78, team: ['Jordan Miles', 'Marcus Webb'] },
  { name: 'Emergency lighting', client: 'Kingsway Offices', start: '1 Jul', due: 'Delivered', phase: 'Complete', progress: 100, team: ['Priya Nair'] },
]
const phaseCol: Record<string, Proj[]> = {}
columns.forEach((c) => (phaseCol[c] = projects.filter((p) => p.phase === c)))

export function Projects() {
  const [view, setView] = useState<'board' | 'list'>('board')
  const [section, setSection] = useState('Projects')
  const template = '2.2fr 1.5fr 1.4fr 1fr 1fr 1fr'
  return (
    <>
      <TopBar
        title="Projects"
        crumbs={['Post-sale delivery']}
        actions={
          <>
            <Button icon={<Filter size={16} />}>Filter</Button>
            <Button variant="primary" icon={<Plus size={16} />}>New project</Button>
          </>
        }
      />
      <div className="flex-1 flex min-h-0">
        <SubSidebar
          width={210}
          active={section}
          onSelect={setSection}
          groups={[
            { heading: 'Projects', items: [
              { label: 'Projects', icon: Flow, count: 6 },
              { label: 'Templates', icon: File },
              { label: 'Archive', icon: Box },
            ] },
            { heading: 'Tasks', items: [{ label: 'Tasks', icon: Task, count: 18 }] },
          ]}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-[52px] shrink-0 bg-surface border-b border-border flex items-center gap-3 px-6">
            <ViewSwitch
              tabs={[
                { id: 'board', icon: Bars, label: 'Board' },
                { id: 'list', icon: Grid, label: 'List' },
              ]}
              value={view}
              onChange={setView}
            />
            <button className="h-9 px-3 rounded-control border border-border flex items-center gap-2 text-[13px] font-medium text-ink-3 hover:bg-control">
              <Flow size={15} className="text-accent" /> Delivery board
            </button>
            <span className="ml-auto text-[13px] text-muted-2"><span className="font-semibold text-ink-2">{projects.length}</span> projects</span>
          </div>

          {view === 'board' ? (
            <main className="flex-1 overflow-hidden p-6 flex">
              <div className="grid gap-3.5 flex-1 min-h-0" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
                {columns.map((col) => (
                  <div key={col} className="flex flex-col min-h-0">
                    <div className="flex items-center justify-between pb-1">
                      <div className="text-[13px] font-semibold text-ink-2">{col}</div>
                      <span className="text-[12px] text-muted-3">{phaseCol[col].length}</span>
                    </div>
                    <div className="h-[3px] rounded-full mb-2.5 bg-accent-300" />
                    <div className="flex flex-col gap-2.5 overflow-y-auto pr-1 -mr-1">
                      {phaseCol[col].map((p) => (
                        <div key={p.name} className="bg-surface border border-border rounded-rail p-3.5">
                          <div className="text-[13px] font-semibold text-ink-2">{p.name}</div>
                          <div className="text-[12px] text-muted-2">{p.client} · {p.due}</div>
                          <div className="mt-3"><Progress value={p.progress} height={5} color={p.progress === 100 ? '#0E7C66' : '#13927B'} track="#EDF0F4" /></div>
                          <div className="flex items-center justify-between mt-2.5">
                            <div className="flex -space-x-1.5">
                              {p.team.map((t) => (
                                <span key={t} className="ring-2 ring-white rounded-full"><Avatar name={t} size={22} /></span>
                              ))}
                            </div>
                            <span className="text-[12px] font-semibold text-muted-b">{p.progress}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </main>
          ) : (
            <main className="flex-1 overflow-y-auto p-6">
              <Table
                template={template}
                columns={[
                  { key: 'name', header: 'Project' },
                  { key: 'client', header: 'Client' },
                  { key: 'progress', header: 'Progress' },
                  { key: 'phase', header: 'Phase' },
                  { key: 'start', header: 'Start' },
                  { key: 'due', header: 'End' },
                ]}
                footer={<><span>{projects.length} projects</span><span>Delivery board</span></>}
              >
                {projects.map((p) => (
                  <Row key={p.name} template={template}>
                    <Cell className="font-semibold text-ink-2">{p.name}</Cell>
                    <Cell muted>{p.client}</Cell>
                    <Cell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-[120px]"><Progress value={p.progress} height={5} color={p.progress === 100 ? '#0E7C66' : '#13927B'} track="#EDF0F4" /></div>
                        <span className="text-[12px] text-muted-2">{p.progress}%</span>
                      </div>
                    </Cell>
                    <Cell muted>{p.phase}</Cell>
                    <Cell muted>{p.start}</Cell>
                    <Cell muted>{p.due}</Cell>
                  </Row>
                ))}
              </Table>
            </main>
          )}
        </div>
      </div>
    </>
  )
}
