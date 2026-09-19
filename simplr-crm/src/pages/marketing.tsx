import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Kpi, Chip, Button, type ChipTone } from '../components/ui'
import {
  Sparkle, Check, Megaphone, Clock, Layers, Box, Send, Link as LinkIcon,
  File, Download, Plus, Search, ArrowUpRight, Pie, Video,
} from '../components/icons'
import { classNames, initials } from '../lib/format'
import { useState_, useActions } from '../store/store'
import { DeptPage, Section, AiStrip, StatusChip, fmtDate } from './departments'
import type {
  BrandAsset, ContentStatus, MarketingRequest, MediaAsset, MarketingConnector,
} from '../store/types'

/* ── shared bits ─────────────────────────────────────────────── */
const Empty = ({ children }: { children: ReactNode }) => <div className="px-4 py-8 text-[13px] text-muted-2 text-center">{children}</div>

function Row({ icon, title, sub, right }: { icon?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-divider last:border-0">
      {icon && <span className="w-9 h-9 rounded-lg bg-control text-muted-b flex items-center justify-center shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{title}</div>{sub && <div className="text-[12px] text-muted-2 truncate">{sub}</div>}</div>
      {right}
    </div>
  )
}
function TagRow({ tags }: { tags: string[] }) {
  return <span className="flex flex-wrap gap-1">{tags.map((t) => <span key={t} className="text-[11px] text-muted-b bg-control rounded px-1.5 py-0.5">{t}</span>)}</span>
}

const contentTone = (s: ContentStatus): ChipTone =>
  s === 'published' ? 'positive' : s === 'scheduled' || s === 'approved' ? 'accent' : s === 'review' ? 'warning' : 'neutral'
const CONTENT_FLOW: ContentStatus[] = ['idea', 'brief', 'draft', 'review', 'approved', 'scheduled', 'published']
const nextStatus = (s: ContentStatus): ContentStatus => CONTENT_FLOW[Math.min(CONTENT_FLOW.indexOf(s) + 1, CONTENT_FLOW.length - 1)]

const assetIcon = (t: BrandAsset['type']) => (t === 'logo' ? <Sparkle size={16} /> : t === 'deck' ? <Layers size={16} /> : t === 'font' ? <span className="text-[13px] font-bold">Aa</span> : <File size={16} />)

/* ============================== OVERVIEW ============================== */
export function MarketingOverview() {
  const nav = useNavigate()
  const { brandAssets, contentItems, mktRequests, reviews, socialPosts, mktConnectors, mediaAssets } = useState_()
  const act = useActions()
  const openReq = mktRequests.filter((r) => r.status === 'new' || r.status === 'in-progress')
  const scheduled = contentItems.filter((c) => c.status === 'scheduled')
  const inReview = contentItems.filter((c) => c.status === 'review' || c.status === 'approved')
  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '—'

  return (
    <DeptPage title="TellOvi Marketing" crumb="Brand & content operations"
      actions={<Button icon={<ArrowUpRight size={16} />} onClick={() => nav('/marketing/brand')}>Open Brand Hub</Button>}
      kpis={<>
        <Kpi label="Brand assets" value={String(brandAssets.length + mediaAssets.length)} variant="blue" delta="1 source of truth" deltaTone="muted" />
        <Kpi label="Open requests" value={String(openReq.length)} delta={openReq.length ? 'Ovi triaging' : 'Clear'} deltaTone={openReq.length ? 'negative' : 'positive'} />
        <Kpi label="In review / approved" value={String(inReview.length)} />
        <Kpi label="Avg rating" value={`${avg}★`} deltaTone="positive" delta={`${reviews.length} reviews`} />
      </>}>
      <AiStrip role="Marketing" blurb="I’m your marketing librarian and chief-of-staff. Ask me for any brand asset and I’ll hand it over, turn a won job into a week of content, plan the calendar, or draft on-brand review responses — all from your single source of truth."
        actions={[
          { label: 'Find an asset', run: () => nav('/marketing/brand') },
          { label: 'Plan a week of content', run: () => { act.addContentItem({ title: 'Weekly brand post — “Own your energy”', channel: 'LinkedIn', status: 'draft', owner: 'Ovi', date: 'This week' }); act.toast('A week of posts drafted into the planner', 'accent') } },
          { label: 'Turn a won deal into a case study', run: () => act.generateArtifact('Case study — recent install', 'case-study', 'pdf') },
          { label: 'Clear the request queue', run: () => nav('/marketing/requests') },
        ]} />

      <div className="grid md:grid-cols-2 gap-5">
        <Section title="Team requests" meta={`${openReq.length} open`} action={<Button variant="ghost" onClick={() => nav('/marketing/requests')}>All requests</Button>}>
          {mktRequests.slice(0, 5).map((r) => <RequestRow key={r.id} r={r} />)}
          {mktRequests.length === 0 && <Empty>No requests right now.</Empty>}
        </Section>

        <Section title="Content in flight" meta={`${scheduled.length} scheduled`} action={<Button variant="ghost" onClick={() => nav('/marketing/content')}>Planner</Button>}>
          {contentItems.slice(0, 5).map((c) => (
            <Row key={c.id} icon={<Clock size={16} />} title={c.title} sub={`${c.channel}${c.campaign ? ` · ${c.campaign}` : ''} · ${c.date}`} right={<StatusChip tone={contentTone(c.status)}>{c.status}</StatusChip>} />
          ))}
          {contentItems.length === 0 && <Empty>Nothing planned — ask Ovi to plan a week.</Empty>}
        </Section>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Section title="Scheduled posts" meta={`${socialPosts.length} queued`} action={<Button variant="ghost" onClick={() => nav('/marketing/social')}>Social</Button>}>
          {socialPosts.slice(0, 4).map((p) => (
            <Row key={p.id} icon={<Send size={16} />} title={p.body} sub={`${p.channels.join(', ')} · ${p.when}`} right={<StatusChip tone={p.status === 'posted' ? 'positive' : 'accent'}>{p.status}</StatusChip>} />
          ))}
          {socialPosts.length === 0 && <Empty>No posts queued.</Empty>}
        </Section>

        <Section title="Connectors" meta={`${mktConnectors.filter((c) => c.connected).length} connected`} action={<Button variant="ghost" onClick={() => nav('/marketing/connectors')}>Manage</Button>}>
          {mktConnectors.slice(0, 5).map((c) => (
            <Row key={c.id} icon={<LinkIcon size={16} />} title={c.name} sub={c.account || c.kind} right={<StatusChip tone={c.connected ? 'positive' : 'neutral'}>{c.connected ? 'Connected' : 'Off'}</StatusChip>} />
          ))}
        </Section>
      </div>
    </DeptPage>
  )
}

/* ============================== BRAND HUB ============================== */
export function BrandHub() {
  const { brandKit, brandAssets, messaging } = useState_()
  const act = useActions()
  const [q, setQ] = useState('')
  const filtered = brandAssets.filter((a) => !q || a.name.toLowerCase().includes(q.toLowerCase()) || a.tags.some((t) => t.includes(q.toLowerCase())))
  const tokens: { label: string; value: string; hex: string }[] = [
    { label: 'Accent (royal blue)', value: '#13927B', hex: '#13927B' },
    { label: 'Primary', value: brandKit.primary, hex: brandKit.primary },
    { label: 'Highlight', value: brandKit.accent, hex: brandKit.accent },
    { label: 'Ink', value: '#0B1220', hex: '#0B1220' },
    { label: 'Canvas', value: '#F6F7F9', hex: '#F6F7F9' },
    { label: 'Positive', value: '#0E7C66', hex: '#0E7C66' },
  ]
  const logos = filtered.filter((a) => a.type === 'logo')
  const templates = filtered.filter((a) => ['template', 'header', 'deck', 'pdf'].includes(a.type))
  const docs = filtered.filter((a) => a.type === 'guideline' || a.type === 'font')

  return (
    <DeptPage title="TellOvi Marketing" crumb="Brand Hub"
      actions={<div className="flex items-center gap-2">
        <div className="relative"><Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-3" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search assets…" className="h-9 w-52 pl-8 pr-3 rounded-lg border border-border bg-surface text-[13px] outline-none focus:border-border-blue" /></div>
        <Button icon={<Plus size={16} />} onClick={() => act.saveBrandAsset({ name: 'New template', type: 'template', format: 'PDF', tags: ['template'], version: 'v1', updatedAt: Date.now(), latest: true })}>Add asset</Button>
      </div>}>
      <AiStrip role="Brand librarian" blurb="This is the single source of truth — logos, colours, type, templates and the words. Ask me for anything (“the reversed logo”, “the deck template”, “what’s our brand blue?”) and I’ll hand you the latest approved version."
        actions={[
          { label: 'Hand me the primary logo', run: () => act.toast('Primary logo (SVG, v3) — link copied & sent', 'accent') },
          { label: 'Latest deck template', run: () => act.toast('Pitch deck template (PPTX, v4) — opening', 'accent') },
          { label: 'Check brand consistency', run: () => act.toast('Scanned recent collateral — all on-brand ✓', 'positive') },
        ]} />

      {/* brand identity header */}
      <div className="rounded-card border border-border bg-surface overflow-hidden">
        <div className="p-5 flex items-center gap-4" style={{ background: 'linear-gradient(135deg,#EAF6F2 0%,#FBFCFF 100%)' }}>
          <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-[22px] shadow-primary" style={{ background: 'linear-gradient(180deg,#1FAE94 0%,#13927B 100%)' }}>T</span>
          <div className="flex-1 min-w-0">
            <div className="text-[17px] font-bold text-ink">{brandKit.company}</div>
            <div className="text-[13px] text-muted-b">Brand font: <span className="font-semibold text-ink-3">{brandKit.font}</span> · Instrument Sans (display)</div>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-divider">
          {tokens.map((t) => (
            <button key={t.label} onClick={() => act.toast(`${t.value} copied`, 'accent')} className="bg-surface p-3 text-left hover:bg-control transition-colors">
              <span className="block w-full h-9 rounded-md mb-2 border border-border/60" style={{ background: t.hex }} />
              <span className="block text-[11px] font-semibold text-ink-3 truncate">{t.label}</span>
              <span className="block text-[11px] text-muted-2 font-mono">{t.value}</span>
            </button>
          ))}
        </div>
      </div>

      <Section title="Logos" meta={`${logos.length} variants`}>
        {logos.length === 0 ? <Empty>No logos match.</Empty> : logos.map((a) => <AssetRow key={a.id} a={a} onGet={() => act.toast(`${a.name} (${a.format}, ${a.version}) — handed over`, 'accent')} />)}
      </Section>

      <div className="grid md:grid-cols-2 gap-5">
        <Section title="Templates" meta={`${templates.length} branded templates`}>
          {templates.length === 0 ? <Empty>No templates match.</Empty> : templates.map((a) => <AssetRow key={a.id} a={a} onGet={() => act.toast(`${a.name} — opening template`, 'accent')} />)}
        </Section>
        <Section title="Guidelines & type" meta={`${docs.length} items`}>
          {docs.length === 0 ? <Empty>Nothing here.</Empty> : docs.map((a) => <AssetRow key={a.id} a={a} onGet={() => act.toast(`${a.name} — opening`, 'accent')} />)}
        </Section>
      </div>

      <Section title="Messaging & tone of voice" meta={`${messaging.length} snippets`} action={<span className="text-[12px] text-muted-2">The words, not just the visuals</span>}>
        {messaging.map((m) => {
          const tone: ChipTone = m.category === 'banned' ? 'negative' : m.category === 'tagline' ? 'accent' : 'neutral'
          return (
            <div key={m.id} className="flex items-start gap-3 px-4 py-3 border-b border-divider last:border-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5"><span className="text-[12.5px] font-semibold text-ink-2">{m.label}</span><Chip tone={tone}>{m.category}</Chip></div>
                <p className="text-[13px] text-ink-3 leading-snug">{m.text}</p>
              </div>
              <button onClick={() => act.toast(`“${m.label}” copied`, 'accent')} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-border text-muted-b hover:bg-control shrink-0">Copy</button>
            </div>
          )
        })}
      </Section>
    </DeptPage>
  )
}

function AssetRow({ a, onGet }: { a: BrandAsset; onGet: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-divider last:border-0">
      <span className="w-9 h-9 rounded-lg bg-accent-wash text-accent flex items-center justify-center shrink-0">{assetIcon(a.type)}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-ink-2 truncate">{a.name} {a.latest && <span className="text-[10px] font-bold text-positive bg-positive-wash rounded px-1 py-0.5 ml-1 align-middle">LATEST</span>}</div>
        <div className="text-[12px] text-muted-2 flex items-center gap-2">{a.format} · {a.version} · {fmtDate(new Date(a.updatedAt).toISOString())} {a.note && <span className="truncate">· {a.note}</span>}</div>
      </div>
      <button onClick={onGet} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-border-blue bg-accent-wash text-accent shrink-0 flex items-center gap-1.5"><Download size={13} /> Get</button>
    </div>
  )
}

/* ============================== ASSETS / MEDIA ============================== */
export function MarketingAssets() {
  const { mediaAssets } = useState_()
  const act = useActions()
  const [f, setF] = useState<'all' | MediaAsset['type']>('all')
  const rows = mediaAssets.filter((m) => f === 'all' || m.type === f)
  const srcTone = (s: MediaAsset['source']): ChipTone => (s === 'upload' ? 'neutral' : 'accent')
  const srcLabel: Record<MediaAsset['source'], string> = { upload: 'Upload', canva: 'Canva', 'claude-design': 'Claude Design', figma: 'Figma' }
  return (
    <DeptPage title="TellOvi Marketing" crumb="Assets" kpis={<>
      <Kpi label="Assets" value={String(mediaAssets.length)} variant="blue" />
      <Kpi label="Images" value={String(mediaAssets.filter((m) => m.type === 'image').length)} />
      <Kpi label="Video" value={String(mediaAssets.filter((m) => m.type === 'video').length)} />
      <Kpi label="From design tools" value={String(mediaAssets.filter((m) => m.source !== 'upload').length)} deltaTone="muted" delta="synced back" />
    </>} actions={<Button icon={<Plus size={16} />} onClick={() => act.addMedia({ name: 'Uploaded image', type: 'image', tags: ['upload'], source: 'upload', when: 'Just now' })}>Upload</Button>}>
      <AiStrip role="Media librarian" blurb="Every photo, video and graphic — searchable and tagged. Designs finished in Canva or Claude Design sync back here automatically, so nothing gets lost in someone’s downloads folder."
        actions={[
          { label: 'Find install photos', run: () => act.toast('12 install photos found — tagged “rooftop”', 'accent') },
          { label: 'Pull latest from Canva', run: () => act.addMedia({ name: 'Canva export — offer graphic', type: 'graphic', tags: ['canva', 'offer'], source: 'canva', when: 'Just now' }) },
        ]} />
      <Section title="Media library" meta={`${rows.length} items`} action={
        <div className="flex gap-1">{(['all', 'image', 'video', 'graphic'] as const).map((k) => <button key={k} onClick={() => setF(k)} className={classNames('h-8 px-3 rounded-lg text-[12px] font-semibold capitalize', f === k ? 'bg-accent-wash text-accent' : 'text-muted-b hover:bg-control')}>{k}</button>)}</div>
      }>
        {rows.length === 0 ? <Empty>No assets match.</Empty> : rows.map((m) => (
          <Row key={m.id} icon={m.type === 'video' ? <Video size={16} /> : <Box size={16} />} title={m.name}
            sub={<span className="flex items-center gap-2"><TagRow tags={m.tags} />{m.license && <span className="text-muted-3">· {m.license}</span>}</span>}
            right={<span className="flex items-center gap-2"><StatusChip tone={srcTone(m.source)}>{srcLabel[m.source]}</StatusChip><span className="text-[11.5px] text-muted-3 w-20 text-right">{m.when}</span></span>} />
        ))}
      </Section>
    </DeptPage>
  )
}

/* ============================== CONTENT PLANNER ============================== */
export function ContentPlanner() {
  const { contentItems } = useState_()
  const act = useActions()
  const byStatus = (s: ContentStatus) => contentItems.filter((c) => c.status === s)
  const cols: { key: ContentStatus; label: string }[] = [
    { key: 'idea', label: 'Ideas' }, { key: 'draft', label: 'Drafting' }, { key: 'review', label: 'In review' },
    { key: 'approved', label: 'Approved' }, { key: 'scheduled', label: 'Scheduled' }, { key: 'published', label: 'Published' },
  ]
  return (
    <DeptPage title="TellOvi Marketing" crumb="Content" kpis={<>
      <Kpi label="In pipeline" value={String(contentItems.filter((c) => c.status !== 'published').length)} variant="blue" />
      <Kpi label="Scheduled" value={String(byStatus('scheduled').length)} deltaTone="positive" />
      <Kpi label="Awaiting review" value={String(byStatus('review').length)} deltaTone={byStatus('review').length ? 'negative' : 'positive'} />
      <Kpi label="Published (all)" value={String(byStatus('published').length)} />
    </>} actions={<Button icon={<Plus size={16} />} onClick={() => act.addContentItem({ title: 'New content idea', channel: 'LinkedIn', status: 'idea', owner: 'Sana Ali', date: 'This week' })}>Add item</Button>}>
      <AiStrip role="Content planner" blurb="Idea → brief → draft → review → approved → scheduled → published. I can fill the calendar from your wins, repurpose one asset into a week of posts, and keep everything moving."
        actions={[
          { label: 'Plan next week', run: () => { ['LinkedIn', 'Instagram', 'Blog'].forEach((ch, i) => act.addContentItem({ title: `Planned post — ${ch}`, channel: ch, status: 'draft', owner: 'Ovi', date: `Next week · day ${i + 1}` })); act.toast('3 posts drafted into next week', 'accent') } },
          { label: 'Repurpose the latest case study', run: () => act.toast('Case study remixed → 4 posts + 1 email drafted', 'accent') },
        ]} />
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-[900px]">
          {cols.map((col) => {
            const items = byStatus(col.key)
            return (
              <div key={col.key} className="flex-1 min-w-[150px]">
                <div className="flex items-center justify-between px-1 mb-2"><span className="eyebrow text-[10.5px] text-muted-3">{col.label}</span><span className="text-[11px] text-muted-3">{items.length}</span></div>
                <div className="flex flex-col gap-2">
                  {items.map((c) => (
                    <div key={c.id} className="rounded-xl border border-border bg-surface p-3 shadow-card">
                      <div className="text-[12.5px] font-semibold text-ink-2 leading-snug mb-1.5">{c.title}</div>
                      <div className="flex items-center gap-1.5 flex-wrap mb-2"><Chip tone="neutral">{c.channel}</Chip>{c.campaign && <span className="text-[11px] text-muted-2">{c.campaign}</span>}</div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-3 truncate">{c.owner} · {c.date}</span>
                        {c.status !== 'published' && <button onClick={() => act.advanceContent(c.id, nextStatus(c.status))} title="Advance" className="h-6 px-2 rounded-md text-[11px] font-semibold border border-border-blue bg-accent-wash text-accent shrink-0">→</button>}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <div className="rounded-xl border border-dashed border-border py-4 text-center text-[11.5px] text-muted-3">—</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </DeptPage>
  )
}

/* ============================== SOCIAL ============================== */
export function MarketingSocial() {
  const { socialPosts, mktConnectors } = useState_()
  const act = useActions()
  const socials = mktConnectors.filter((c) => c.kind === 'social')
  const connected = socials.filter((c) => c.connected)
  // Seeded-style analytics per network (simulated)
  const analytics = [
    { net: 'LinkedIn', followers: '2,410', growth: '+4.2%', eng: '3.8%' },
    { net: 'Instagram', followers: '1,180', growth: '+6.1%', eng: '5.2%' },
    { net: 'X', followers: '640', growth: '+0.8%', eng: '1.4%' },
  ]
  return (
    <DeptPage title="TellOvi Marketing" crumb="Social" kpis={<>
      <Kpi label="Connected networks" value={String(connected.length)} variant="blue" />
      <Kpi label="Queued posts" value={String(socialPosts.filter((p) => p.status !== 'posted').length)} />
      <Kpi label="Posted (period)" value={String(socialPosts.filter((p) => p.status === 'posted').length)} deltaTone="positive" />
      <Kpi label="Avg engagement" value="3.5%" deltaTone="positive" delta="+0.4pts" />
    </>} actions={<Button icon={<Send size={16} />} onClick={() => { act.schedulePost(['LinkedIn', 'Instagram'], 'New solar install complete in Manchester ☀️ — another home cutting its bills.', 'Tomorrow 09:00'); }}>Schedule post</Button>}>
      <AiStrip role="Social manager" blurb="One place for every network — schedule, watch the numbers, and never miss a comment. I post at the times your audience is actually online and draft replies in your brand voice."
        actions={[
          { label: 'Schedule this week’s queue', run: () => act.toast('7 posts scheduled at optimal times', 'accent') },
          { label: 'Draft replies to new comments', run: () => act.toast('5 replies drafted for approval', 'accent') },
        ]} />
      <div className="grid md:grid-cols-2 gap-5">
        <Section title="Connected accounts" meta={`${connected.length} of ${socials.length}`}>
          {socials.map((c) => (
            <Row key={c.id} icon={<Megaphone size={16} />} title={c.name} sub={c.account || 'Not connected'}
              right={<button onClick={() => act.toggleMktConnector(c.id)} className={classNames('h-8 px-3 rounded-lg text-[12px] font-semibold border', c.connected ? 'border-border text-muted-b hover:bg-control' : 'border-border-blue bg-accent-wash text-accent')}>{c.connected ? 'Connected' : 'Connect'}</button>} />
          ))}
        </Section>
        <Section title="Audience & engagement" meta="Across connected networks">
          {analytics.map((a) => (
            <Row key={a.net} icon={<Pie size={16} />} title={a.net} sub={`${a.followers} followers · ${a.eng} engagement`}
              right={<StatusChip tone="positive">{a.growth}</StatusChip>} />
          ))}
        </Section>
      </div>
      <Section title="Scheduled & posted" meta={`${socialPosts.length} items`}>
        {socialPosts.length === 0 ? <Empty>Nothing scheduled — ask Ovi to plan a week.</Empty> : socialPosts.map((p) => (
          <Row key={p.id} icon={<Clock size={16} />} title={p.body} sub={`${p.channels.join(', ')} · ${p.when}`} right={<StatusChip tone={p.status === 'posted' ? 'positive' : p.status === 'scheduled' ? 'accent' : 'neutral'}>{p.status}</StatusChip>} />
        ))}
      </Section>
    </DeptPage>
  )
}

/* ============================== REQUESTS ============================== */
const reqTone = (s: MarketingRequest['status']): ChipTone => (s === 'done' ? 'positive' : s === 'found' ? 'accent' : s === 'in-progress' ? 'warning' : 'neutral')
const reqLabel: Record<MarketingRequest['status'], string> = { new: 'New', found: 'Ovi found it', 'in-progress': 'With a designer', done: 'Done' }

function RequestRow({ r }: { r: MarketingRequest }) {
  const act = useActions()
  const { brandAssets } = useState_()
  const asset = r.assetId ? brandAssets.find((a) => a.id === r.assetId) : undefined
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-divider last:border-0">
      <span className="w-9 h-9 rounded-full bg-accent-wash text-accent text-[12px] font-bold flex items-center justify-center shrink-0">{initials(r.from)}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-ink-2"><span className="font-semibold">{r.from.split(' (')[0]}</span> <span className="text-muted-2">· {r.when}</span></div>
        <div className="text-[13px] text-ink-3 mt-0.5">“{r.ask}”</div>
        {asset && <div className="text-[12px] text-accent mt-1 flex items-center gap-1"><Check size={12} /> Handed over: {asset.name} ({asset.format})</div>}
        {r.note && !asset && <div className="text-[12px] text-muted-2 mt-1">{r.note}</div>}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <StatusChip tone={reqTone(r.status)}>{reqLabel[r.status]}</StatusChip>
        {r.status === 'new' && <div className="flex gap-1.5">
          <button onClick={() => act.fulfilRequest(r.id, 'found')} className="h-7 px-2.5 rounded-md text-[11.5px] font-semibold border border-border-blue bg-accent-wash text-accent">Ovi: find it</button>
          <button onClick={() => act.fulfilRequest(r.id, 'in-progress', 'Sent to a designer with the brand kit.')} className="h-7 px-2.5 rounded-md text-[11.5px] font-semibold border border-border text-muted-b hover:bg-control">Assign</button>
        </div>}
        {(r.status === 'found' || r.status === 'in-progress') && <button onClick={() => act.fulfilRequest(r.id, 'done')} className="h-7 px-2.5 rounded-md text-[11.5px] font-semibold border border-positive-border bg-positive-wash text-positive">Close</button>}
      </div>
    </div>
  )
}

export function MarketingRequests() {
  const { mktRequests } = useState_()
  const act = useActions()
  const nue = mktRequests.filter((r) => r.status === 'new')
  return (
    <DeptPage title="TellOvi Marketing" crumb="Requests" kpis={<>
      <Kpi label="New" value={String(nue.length)} variant="blue" deltaTone={nue.length ? 'negative' : 'positive'} delta={nue.length ? 'Ovi can triage' : 'Clear'} />
      <Kpi label="In progress" value={String(mktRequests.filter((r) => r.status === 'in-progress').length)} />
      <Kpi label="Resolved by Ovi" value={String(mktRequests.filter((r) => r.status === 'found' || r.status === 'done').length)} deltaTone="positive" />
      <Kpi label="Total" value={String(mktRequests.length)} />
    </>}>
      <AiStrip role="Intake" blurb="“Hi, I need X.” Every ask lands here. If it already exists, I find the latest approved version and hand it straight over. If it’s new, I write the brief and route it to a designer with the brand kit attached."
        actions={[
          { label: 'Auto-resolve what I can', run: () => { nue.forEach((r) => act.fulfilRequest(r.id, 'found')); } },
        ]} />
      <Section title="Request queue" meta={`${nue.length} awaiting triage`}>
        {mktRequests.length === 0 ? <Empty>No requests.</Empty> : mktRequests.map((r) => <RequestRow key={r.id} r={r} />)}
      </Section>
    </DeptPage>
  )
}

/* ============================== CONNECTORS ============================== */
export function MarketingConnectors() {
  const { mktConnectors } = useState_()
  const act = useActions()
  const groups: { kind: MarketingConnector['kind']; label: string; blurb: string }[] = [
    { kind: 'design', label: 'Design tools', blurb: 'Design happens here; finished work syncs back into Assets.' },
    { kind: 'social', label: 'Social networks', blurb: 'Publish and pull analytics from each network.' },
    { kind: 'storage', label: 'Storage', blurb: 'Bring in files from where they already live.' },
    { kind: 'analytics', label: 'Analytics', blurb: 'Attribution and site performance.' },
    { kind: 'email', label: 'Email', blurb: 'Sync campaigns and lists.' },
  ]
  return (
    <DeptPage title="TellOvi Marketing" crumb="Connectors" kpis={<>
      <Kpi label="Connected" value={String(mktConnectors.filter((c) => c.connected).length)} variant="blue" />
      <Kpi label="Design tools" value={String(mktConnectors.filter((c) => c.kind === 'design' && c.connected).length)} />
      <Kpi label="Social" value={String(mktConnectors.filter((c) => c.kind === 'social' && c.connected).length)} />
      <Kpi label="Available" value={String(mktConnectors.length)} deltaTone="muted" />
    </>}>
      <AiStrip role="Connections" blurb="TellOvi is the library and the operator — not the design tool. Connect Canva, Figma or Claude Design and their finished work lands back here, tagged and versioned. Design goes out; the asset comes back."
        actions={[
          { label: 'Open Claude Design', run: () => act.toast('Opening Claude Design — outputs will sync to Assets', 'accent') },
          { label: 'Sync latest from Canva', run: () => act.toast('Pulled 3 new designs from Canva into Assets', 'accent') },
        ]} />
      {groups.map((g) => {
        const list = mktConnectors.filter((c) => c.kind === g.kind)
        if (list.length === 0) return null
        return (
          <Section key={g.kind} title={g.label} meta={g.blurb}>
            {list.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b border-divider last:border-0">
                <span className="w-9 h-9 rounded-lg bg-control text-muted-b flex items-center justify-center shrink-0"><LinkIcon size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-ink-2">{c.name}</div>
                  <div className="text-[12px] text-muted-2 truncate">{c.connected && c.account ? c.account : c.note || 'Not connected'}</div>
                </div>
                {c.name === 'Claude Design' && c.connected && <button onClick={() => act.toast('Opening Claude Design in a new tab', 'accent')} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-border text-muted-b hover:bg-control shrink-0 mr-1">Open</button>}
                <button onClick={() => act.toggleMktConnector(c.id)} className={classNames('h-8 px-3.5 rounded-lg text-[12px] font-semibold border shrink-0', c.connected ? 'border-border text-muted-b hover:bg-control' : 'border-border-blue bg-accent-wash text-accent')}>{c.connected ? 'Disconnect' : 'Connect'}</button>
              </div>
            ))}
          </Section>
        )
      })}
    </DeptPage>
  )
}
