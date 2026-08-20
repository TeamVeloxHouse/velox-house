import { useMemo, useState } from 'react'
import { TopBar } from '../components/TopBar'
import { Button, Avatar, Chip, Kpi } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Search, Sparkle, Check, Bolt, Plus } from '../components/icons'
import { useActions } from '../store/store'
import { classNames } from '../lib/format'

/* Mock prospect database. In production this maps to a B2B data provider
   (People Data Labs / Apollo) or the Velox discovery pipeline — the shape and
   the reveal-credit flow stay identical. */
type Prospect = {
  id: string
  name: string
  title: string
  company: string
  industry: string
  location: string
  size: string
  seniority: string
  score: number
  email: string
  phone: string
}

const firstNames = ['Amara', 'Ben', 'Chloe', 'Dev', 'Elena', 'Farid', 'Grace', 'Hiro', 'Isla', 'Jae', 'Kira', 'Liam', 'Mona', 'Noah', 'Omar', 'Priya', 'Quinn', 'Rosa', 'Sami', 'Tara', 'Umar', 'Vera', 'Will', 'Yara']
const lastNames = ['Ashworth', 'Bright', 'Calder', 'Doyle', 'Ellis', 'Frost', 'Gill', 'Hale', 'Irwin', 'Joshi', 'Kerr', 'Lund', 'Marsh', 'Nash', 'Okafor', 'Payne', 'Quinn', 'Rao', 'Stone', 'Tan', 'Usman', 'Vance', 'Ward', 'York']
const companies = [
  ['Northwind Energy', 'Utilities'], ['Baseload Power', 'Utilities'], ['Voltify', 'Renewables'], ['GridPoint UK', 'Grid infrastructure'],
  ['Helios Solar', 'Renewables'], ['CoreData Centres', 'Data centres'], ['Stackscale', 'Data centres'], ['MediCare Trust', 'Healthcare'],
  ['Rail North', 'Transport'], ['PortLink Logistics', 'Logistics'], ['Fenwick College', 'Education'], ['BrightRetail', 'Retail'],
  ['Aurora Wind', 'Renewables'], ['Cavendish Estates', 'Property'], ['IronBridge Mfg', 'Manufacturing'], ['Kingsway Group', 'Property'],
]
const titles = ['Facilities Director', 'Head of Engineering', 'CTO', 'Operations Lead', 'Procurement Manager', 'Sustainability Lead', 'Estates Manager', 'Chief Operating Officer', 'Energy Manager', 'Head of IT']
const locations = ['London, UK', 'Manchester, UK', 'Leeds, UK', 'Birmingham, UK', 'Bristol, UK', 'Glasgow, UK', 'Newcastle, UK']
const sizes = ['11–50', '51–200', '201–500', '501–1000', '1000+']
const seniorities = ['C-level', 'VP', 'Director', 'Manager']

function buildDB(): Prospect[] {
  const out: Prospect[] = []
  for (let i = 0; i < 48; i++) {
    const fn = firstNames[i % firstNames.length]
    const ln = lastNames[(i * 3) % lastNames.length]
    const [company, industry] = companies[i % companies.length]
    const title = titles[(i * 5) % titles.length]
    out.push({
      id: `pr${i}`,
      name: `${fn} ${ln}`,
      title,
      company,
      industry,
      location: locations[(i * 2) % locations.length],
      size: sizes[i % sizes.length],
      seniority: /chief|cto|coo|c-level/i.test(title) ? 'C-level' : /head|director/i.test(title) ? 'Director' : /vp/i.test(title) ? 'VP' : 'Manager',
      score: 55 + ((i * 7) % 44),
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}@${company.toLowerCase().replace(/[^a-z]/g, '')}.com`,
      phone: `+44 20 7${String(1000 + ((i * 137) % 8999))} ${String(1000 + ((i * 91) % 8999))}`,
    })
  }
  return out
}
const DB = buildDB()

const industries = [...new Set(companies.map((c) => c[1]))]

export function Prospector() {
  const act = useActions()
  const [industry, setIndustry] = useState('All')
  const [seniority, setSeniority] = useState('All')
  const [size, setSize] = useState('All')
  const [q, setQ] = useState('')
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [credits, setCredits] = useState(500)

  const results = useMemo(
    () =>
      DB.filter((p) => (industry === 'All' || p.industry === industry))
        .filter((p) => (seniority === 'All' || p.seniority === seniority))
        .filter((p) => (size === 'All' || p.size === size))
        .filter((p) => !q || (p.name + p.title + p.company).toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.score - a.score),
    [industry, seniority, size, q],
  )

  function reveal(p: Prospect) {
    if (revealed.has(p.id) || credits <= 0) return
    setRevealed((s) => new Set(s).add(p.id))
    setCredits((c) => c - 1)
    act.toast(`Revealed ${p.name} · 1 credit used`)
  }
  function addLead(p: Prospect) {
    if (added.has(p.id)) return
    if (!revealed.has(p.id)) reveal(p)
    act.addLead({ name: p.name, company: p.company, role: p.title, source: 'Prospector', score: p.score })
    setAdded((s) => new Set(s).add(p.id))
  }

  const template = '24px 2fr 1.6fr 1.2fr 1.4fr 0.7fr 1.1fr'
  const Filter = ({ label, value, set, opts }: { label: string; value: string; set: (v: string) => void; opts: string[] }) => (
    <div>
      <div className="eyebrow text-muted-3 mb-1.5">{label}</div>
      <div className="flex flex-col gap-0.5">
        {['All', ...opts].map((o) => (
          <button key={o} onClick={() => set(o)} className={classNames('text-left px-2.5 py-1.5 rounded-lg text-[13px]', value === o ? 'bg-accent-wash-2 text-accent-700 font-semibold' : 'text-ink-3 hover:bg-control')}>{o}</button>
        ))}
      </div>
    </div>
  )

  return (
    <>
      <TopBar
        title="Prospector"
        crumbs={['Find new leads']}
        actions={
          <>
            <Chip tone="accent" dot>{credits} credits</Chip>
            <Button icon={<Sparkle size={16} />} onClick={() => act.toast('AI built an ICP from your won deals', 'accent')}>Build ICP with AI</Button>
          </>
        }
      />
      <div className="flex-1 flex min-h-0">
        <aside className="w-[232px] shrink-0 bg-surface border-r border-border p-4 overflow-y-auto flex flex-col gap-5">
          <div className="text-[13px] font-semibold text-ink flex items-center gap-1.5"><Bolt size={15} className="text-accent" /> Filters</div>
          <Filter label="Industry" value={industry} set={setIndustry} opts={industries} />
          <Filter label="Seniority" value={seniority} set={setSeniority} opts={seniorities} />
          <Filter label="Company size" value={size} set={setSize} opts={sizes} />
          <div className="rounded-card bg-deep-panel p-3.5 mt-auto">
            <div className="text-[12px]" style={{ color: '#93A0B4' }}>Database</div>
            <div className="text-[18px] font-bold text-white mt-1">400M+ profiles</div>
            <div className="text-[11px] mt-1 leading-snug" style={{ color: '#8FB0FF' }}>Powered by your data provider — verified emails &amp; direct dials on reveal.</div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-7 flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-4">
            <Kpi variant="blue" label="Matching your ICP" value={results.length.toLocaleString()} delta="Ranked by fit" deltaTone="muted" />
            <Kpi label="Revealed" value={String(revealed.size)} delta={`${credits} credits left`} deltaTone="muted" />
            <Kpi label="Added to leads" value={String(added.size)} delta="This session" />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-[380px] h-[38px] border border-border rounded-control flex items-center gap-2.5 px-3 text-muted-3 text-[14px] bg-surface">
              <Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, title or company" className="bg-transparent outline-none flex-1 text-ink-2 placeholder:text-muted-3" />
            </div>
            <span className="ml-auto text-[13px] text-muted-2">{results.length} prospects</span>
          </div>

          <Table
            template={template}
            columns={[
              { key: 'c', header: '' }, { key: 'name', header: 'Prospect' }, { key: 'company', header: 'Company' }, { key: 'loc', header: 'Location' }, { key: 'contact', header: 'Contact' }, { key: 'fit', header: 'Fit', align: 'right' }, { key: 'act', header: '' },
            ]}
            footer={<><span>{results.length} of {DB.length} prospects</span><span>1 credit per reveal</span></>}
          >
            {results.slice(0, 30).map((p) => {
              const isRevealed = revealed.has(p.id)
              const isAdded = added.has(p.id)
              return (
                <Row key={p.id} template={template}>
                  <Cell><span className="w-[18px] h-[18px] rounded-[5px] border border-input-border inline-block" /></Cell>
                  <Cell><div className="flex items-center gap-2.5"><Avatar name={p.name} size={30} /><div className="min-w-0"><div className="font-semibold text-ink-2 truncate">{p.name}</div><div className="text-[12px] text-muted-2 truncate">{p.title}</div></div></div></Cell>
                  <Cell><div className="flex items-center gap-2 min-w-0"><Avatar name={p.company} size={24} square variant="neutral" /><div className="min-w-0"><div className="text-ink-2 font-medium truncate">{p.company}</div><div className="text-[12px] text-muted-2">{p.industry}</div></div></div></Cell>
                  <Cell muted>{p.location}</Cell>
                  <Cell>
                    {isRevealed ? (
                      <div className="min-w-0"><div className="text-[12.5px] text-accent truncate">{p.email}</div><div className="text-[12px] text-muted-2">{p.phone}</div></div>
                    ) : (
                      <button onClick={() => reveal(p)} className="text-[12.5px] text-accent font-semibold flex items-center gap-1 hover:underline"><span className="blur-[3px] select-none">hidden@email.com</span></button>
                    )}
                  </Cell>
                  <Cell align="right"><span className="font-bold" style={{ color: p.score >= 75 ? '#0E7C66' : p.score >= 60 ? '#1D4ED8' : '#7A8494' }}>{p.score}</span></Cell>
                  <Cell align="right">
                    {isAdded ? (
                      <span className="text-[12px] text-positive font-semibold flex items-center gap-1 justify-end"><Check size={13} /> Added</span>
                    ) : isRevealed ? (
                      <button onClick={() => addLead(p)} className="text-[12px] text-accent font-semibold flex items-center gap-1 justify-end hover:underline"><Plus size={13} /> Add lead</button>
                    ) : (
                      <button onClick={() => reveal(p)} className="text-[12px] text-accent font-semibold hover:underline">Reveal</button>
                    )}
                  </Cell>
                </Row>
              )
            })}
          </Table>
        </main>
      </div>
    </>
  )
}
