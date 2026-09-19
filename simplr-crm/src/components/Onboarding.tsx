import { useState } from 'react'
import { useState_, useActions } from '../store/store'
import { TRADE_PROFILES, tradeByKey } from '../lib/trades'
import type { TradeKey, FeatureKey, Features } from '../store/types'
import { Button } from './ui'
import { Check, Sparkle, Wrench, Sun, Radar, File as FileIcon, Box } from './icons'
import { classNames } from '../lib/format'

const featureMeta: { key: FeatureKey; icon: (p: { size?: number; className?: string }) => JSX.Element; label: string; desc: string }[] = [
  { key: 'jobs', icon: Wrench, label: 'Jobs & scheduling', desc: 'Book surveys, showroom visits & installs against your crews' },
  { key: 'studio', icon: Sun, label: 'Design studio', desc: 'Address → AI design → price (solar, battery & EV)' },
  { key: 'reach', icon: Radar, label: 'Reach — find new work', desc: 'Prospecting & AI outreach to win more jobs' },
  { key: 'compliance', icon: FileIcon, label: 'Compliance & certificates', desc: 'Per-job checklist for MCS, DNO, FENSA, Gas Safe…' },
  { key: 'inventory', icon: Box, label: 'Stock & inventory', desc: 'Track stock and reserve materials against quotes' },
]

export function Onboarding() {
  const { onboarded } = useState_()
  const act = useActions()
  const [step, setStep] = useState(0)
  const [trade, setTrade] = useState<TradeKey | null>(null)
  const [features, setFeatures] = useState<Features>(tradeByKey('solar').features)

  if (onboarded) return null

  const profile = trade ? tradeByKey(trade) : null

  const pickTrade = (k: TradeKey) => {
    setTrade(k)
    setFeatures({ ...tradeByKey(k).features })
    setStep(1)
  }
  const finish = () => {
    if (!trade) return
    act.selectTrade(trade, features, true)
    act.completeOnboarding()
    act.toast(`Welcome — TellOvi is set up for ${tradeByKey(trade).name.toLowerCase()}`)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6" style={{ background: 'rgba(11,18,32,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-[840px] max-h-[90vh] overflow-y-auto bg-surface rounded-[20px] shadow-modal border border-border">
        {/* header */}
        <div className="px-8 pt-7 pb-5 border-b border-divider">
          <div className="flex items-center gap-2 text-accent-700 mb-2"><Sparkle size={16} /><span className="eyebrow text-[11px]">Set up your workspace</span></div>
          <div className="text-[22px] font-bold text-ink tracking-[-0.01em]">{step === 0 ? 'What does your business do?' : `Great — let’s tailor TellOvi for ${profile?.name}`}</div>
          <div className="text-[13.5px] text-muted-b mt-1">{step === 0 ? 'Pick your trade and TellOvi sets up the right tools, job types, survey template and compliance checklist. You can change any of this later.' : 'These are switched on by default for your trade. Turn anything on or off — nothing is locked.'}</div>
          <div className="flex items-center gap-1.5 mt-4">
            <span className={classNames('h-1.5 rounded-full transition-all', step === 0 ? 'w-8 bg-accent' : 'w-4 bg-accent/40')} />
            <span className={classNames('h-1.5 rounded-full transition-all', step === 1 ? 'w-8 bg-accent' : 'w-4 bg-border')} />
          </div>
        </div>

        {step === 0 ? (
          <div className="p-6 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(238px, 1fr))' }}>
            {TRADE_PROFILES.map((t) => (
              <button key={t.key} onClick={() => pickTrade(t.key)}
                className="group text-left rounded-card border border-border p-4 hover:border-accent hover:shadow-card transition-all bg-white">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl flex items-center justify-center text-[22px] shrink-0" style={{ background: `${t.accent}1A` }}>{t.emoji}</span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-ink truncate">{t.name}</div>
                    <div className="text-[12px] text-muted-2 leading-snug">{t.tagline}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {t.compliance.slice(0, 3).map((c) => (
                    <span key={c} className="text-[10.5px] font-medium text-ink-3 bg-control rounded-md px-1.5 py-0.5">{c}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-6 grid gap-5" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
            <div className="flex flex-col gap-2.5">
              {featureMeta.map((f) => {
                const on = features[f.key]
                return (
                  <button key={f.key} onClick={() => setFeatures((s) => ({ ...s, [f.key]: !s[f.key] }))}
                    className={classNames('flex items-start gap-3 rounded-card border p-3.5 text-left transition-colors', on ? 'border-border-blue bg-accent-wash-4' : 'border-border hover:bg-control')}>
                    <span className={classNames('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', on ? 'bg-accent text-white' : 'bg-control text-muted-2')}><f.icon size={17} /></span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold text-ink-2">{f.label}</div>
                      <div className="text-[12px] text-muted-2 leading-snug">{f.desc}</div>
                    </div>
                    <span className={classNames('w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0', on ? 'bg-accent justify-end' : 'bg-input-border justify-start')}><span className="w-5 h-5 rounded-full bg-white shadow" /></span>
                  </button>
                )
              })}
            </div>
            <div className="rounded-card p-5 text-white h-fit" style={{ background: 'linear-gradient(155deg,#15223B,#0A3B33)' }}>
              <div className="text-[12px]" style={{ color: '#93A0B4' }}>We’ll pre-load</div>
              <div className="text-[16px] font-bold mt-0.5">{profile?.name}</div>
              <div className="h-px bg-white/10 my-3" />
              <Detail label="Job types" items={profile?.jobTypes.map((j) => j.label) ?? []} />
              <Detail label="Survey template" items={profile?.surveyChecklist.slice(0, 4) ?? []} more={(profile?.surveyChecklist.length ?? 0) - 4} />
              <Detail label="Compliance" items={profile?.compliance ?? []} />
              <Detail label="Pricing unit" items={[profile?.estimatorUnit ?? '']} />
            </div>
          </div>
        )}

        {/* footer */}
        <div className="px-8 py-4 border-t border-divider flex items-center justify-between">
          <button onClick={step === 1 ? () => setStep(0) : undefined} className={classNames('text-[13px] font-medium', step === 1 ? 'text-muted-b hover:text-ink-2' : 'text-transparent pointer-events-none')}>← Back</button>
          {step === 1 && (
            <Button variant="primary" icon={<Check size={16} />} onClick={finish}>Finish setup</Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Detail({ label, items, more }: { label: string; items: string[]; more?: number }) {
  if (items.length === 0) return null
  return (
    <div className="mb-3">
      <div className="text-[11px] font-semibold mb-1" style={{ color: '#57C9B4' }}>{label}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((i) => (<span key={i} className="text-[11px] bg-white/10 rounded-md px-1.5 py-0.5">{i}</span>))}
        {more != null && more > 0 && <span className="text-[11px] text-white/50 px-1 py-0.5">+{more} more</span>}
      </div>
    </div>
  )
}
