import { useEffect, useMemo, useRef } from 'react'
import { Kpi, Panel } from './ui'
import { Dropdown } from './Dropdown'
import { Bolt, Check, File, Layers, Target } from './icons'
import { RoofPlan } from './DesignProposal'
import { useActions } from '../store/store'
import type { Design } from '../store/types'
import { moduleById } from '../lib/panels'
import {
  INVERTERS, STRING_COLORS, CABLE_SIZES, acVoltageRise, autoString, breakerFor, checkStrings, dcLoss, defaultElectrical,
  elecOf, gridRoute, inverterById, stringLimits, vmpHot, type Electrical as El, type MpptCheck,
} from '../lib/electrical'

/* Electrical tab — inverter, strings, the string/inverter checks, the grid-connection route, cable voltage
 * rise, a live single-line diagram, and printable site plan / SLD / voltage-rise documents. */

const inputCls = 'h-8 px-2 rounded-[8px] border border-[#E1E6EC] text-[12.5px] font-semibold tabular-nums w-full'

export function Electrical({ design, moduleId, kwp }: { design: Design; moduleId: string; kwp: number }) {
  const act = useActions()
  const planRef = useRef<HTMLDivElement>(null)
  const sldRef = useRef<HTMLDivElement>(null)
  const filled = design.planes.filter((p) => p.panels?.length)
  const count = filled.reduce((s, p) => s + (p.panels?.length ?? 0), 0)

  // first visit: pick a sensible inverter and auto-string
  useEffect(() => {
    if (!design.electrical && count) act.updateDesign(design.id, { electrical: defaultElectrical(design.planes, moduleId, kwp, (design.batteryKwh ?? 0) > 0) })
  }, [design.id, count]) // eslint-disable-line react-hooks/exhaustive-deps

  const el = (design.electrical ?? defaultElectrical(design.planes, moduleId, kwp, false)) as El
  const inv = inverterById(el.inverterId) ?? INVERTERS[1]
  // panels may have changed since the strings were made — drop stale ids
  const live = new Set(filled.flatMap((p) => p.panels!.map((x) => x.id)))
  const strings = el.strings.map((s) => ({ ...s, panelIds: s.panelIds.filter((id) => live.has(id)) })).filter((s) => s.panelIds.length)
  const strung = strings.reduce((n, s) => n + s.panelIds.length, 0)
  const auto = useMemo(() => autoString(design.planes, moduleId, inv), [design.planes, moduleId, inv])
  const checks: MpptCheck[] = useMemo(() => checkStrings({ ...el, strings }, design.planes, moduleId), [el, strings, design.planes, moduleId]) // eslint-disable-line react-hooks/exhaustive-deps
  const allOk = checks.every((m) => m.checks.every((c) => c.ok)) && strung === count
  const set = (patch: Partial<El>) => act.updateDesign(design.id, { electrical: { ...el, ...patch } })
  const restring = (inverterId = el.inverterId) => { const i = inverterById(inverterId)!; set({ inverterId, strings: autoString(design.planes, moduleId, i).strings }) }

  const e = elecOf(filled[0]?.moduleId ?? moduleId), lim = stringLimits(e, inv)
  const dcAc = kwp / inv.acKw
  const route = gridRoute(inv.acKw, el.exportLimitKw)
  const ac = acVoltageRise(inv.acKw, el.acCableM ?? 8, el.acCableMm2 ?? 6, el.ze ?? 0.35)
  const worstString = checks.reduce((m, c) => Math.max(m, c.len), 0)
  const dc = dcLoss(el.dcCableM ?? 15, el.dcCableMm2 ?? 4, e.imp, vmpHot(worstString || 1, e))
  const breaker = breakerFor(ac.I)
  const colored = strings.map((s, i) => ({ id: s.id, panelIds: s.panelIds, color: STRING_COLORS[i % STRING_COLORS.length] }))

  if (!count) return <div className="absolute inset-0 flex items-center justify-center text-[13px] text-muted-b">Place panels first — strings are made from the layout.</div>

  const doc = (kind: 'site' | 'sld' | 'vr') => openDocument(kind, { design, kwp, count, inv, el, strings: colored, checks, ac, dc, breaker, route, planSvg: planRef.current?.querySelector('svg')?.outerHTML ?? '', sldSvg: sldRef.current?.querySelector('svg')?.outerHTML ?? '' })

  return (
    <div className="absolute inset-0 overflow-y-auto px-5 py-5">
      <div className="max-w-[1150px] mx-auto flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-3">
          <Kpi variant={allOk ? 'teal' : 'plain'} icon={Check} label="Design checks" value={allOk ? 'All passing' : `${checks.flatMap((m) => m.checks).filter((c) => !c.ok).length + (strung < count ? 1 : 0)} to fix`} delta={`${strings.length} strings · ${strung}/${count} panels strung`} deltaTone={allOk ? 'positive' : 'negative'} />
          <Kpi icon={Bolt} label="DC / AC ratio" value={dcAc.toFixed(2)} delta={dcAc > 1.5 ? 'high — expect clipping on sunny days' : dcAc < 0.9 ? 'inverter is oversized' : 'healthy'} deltaTone={dcAc > 1.5 ? 'negative' : 'muted'} />
          <Kpi variant="navy" icon={Target} label="Grid connection" value={route.code} delta={`${inv.acKw} kW · ${ac.I.toFixed(1)} A`} />
          <Kpi icon={Layers} label="AC voltage rise" value={`${ac.pctCable.toFixed(2)}%`} delta={`${ac.pctTotal.toFixed(2)}% incl. supply`} deltaTone={ac.pctCable > 1 ? 'negative' : 'muted'} />
        </div>

        <div className="grid grid-cols-[1.15fr_1fr] gap-4 items-start">
          <Panel title="Strings on the roof" sub="Each colour is one string; the numbered dot is where it starts (+)" icon={Layers}
            action={<button onClick={() => restring()} className="h-8 px-3 rounded-[8px] bg-[#15223B] text-white text-[12px] font-semibold">Auto-string</button>}>
            <div ref={planRef}><RoofPlan design={design} strings={colored} light notes /></div>
            {auto.issues.length > 0 && <div className="mt-3 flex flex-col gap-1.5">{auto.issues.map((m, i) => <div key={i} className="text-[12px] rounded-[8px] bg-[#FDF3E3] text-[#92400E] px-2.5 py-1.5">{m}</div>)}</div>}
          </Panel>
          <Panel title="Inverter" sub="Typical datasheet figures — confirm against the exact model's datasheet" icon={Bolt}>
            <Dropdown value={inv.id} onChange={(ev) => restring(ev.target.value)} className="w-full">
              {INVERTERS.map((i) => <option key={i.id} value={i.id}>{`${i.brand} ${i.name} · ${i.acKw} kW${i.hybrid ? ' hybrid' : ''}`}</option>)}
            </Dropdown>
            <div className="grid grid-cols-2 gap-x-4 mt-3 text-[12.5px]">
              {[
                ['MPPTs', inv.mppts], ['Max DC voltage', `${inv.vMax} V`], ['MPPT window', `${inv.mpptMin}–${inv.mpptMax} V`], ['Start-up', `${inv.startV} V`],
                ['Max current / MPPT', `${inv.iMaxPerMppt} A`], ['Max Isc / MPPT', `${inv.iscMaxPerMppt} A`], ['Max PV input', `${inv.maxDcKw} kW`], ['Battery ready', inv.hybrid ? 'Yes (hybrid)' : 'No'],
              ].map(([k, v]) => <div key={k as string} className="flex justify-between py-1.5 border-b border-divider"><span className="text-muted-b">{k}</span><b className="text-ink">{v}</b></div>)}
            </div>
            <div className="text-[12px] text-ink-3 mt-3">With {moduleById(filled[0]?.moduleId ?? moduleId).name}, a string can be <b className="text-ink">{lim.nMin}–{lim.nMax} panels</b> on this inverter.</div>
            <div className="mt-3 text-[12px] rounded-[8px] bg-[#EEF8F5] text-[#0E5E50] px-2.5 py-2">{route.text}</div>
          </Panel>
        </div>

        <Panel title="String checks" sub="Cold Voc at −10 °C, hot Vmp at 70 °C cell temperature, and MPPT current limits" icon={Check}>
          <div className="grid grid-cols-2 gap-4">
            {checks.map((m) => (
              <div key={m.mppt} className="rounded-[10px] border border-[#E6EAF0] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <b className="text-[13px] text-ink">MPPT {m.mppt + 1}</b>
                  <span className="text-[12px] text-muted-b">{m.parallel} × {m.len} panels · {design.planes.find((p) => p.id === m.strings[0].planeId)?.name}</span>
                  <span className="ml-auto flex gap-1">{m.strings.map((s) => { const i = strings.findIndex((x) => x.id === s.id); return <span key={s.id} className="w-3 h-3 rounded-full" style={{ background: STRING_COLORS[i % STRING_COLORS.length] }} /> })}</span>
                </div>
                {m.checks.map((c) => (
                  <div key={c.label} className="flex items-center gap-2 py-1 text-[12.5px] border-b border-divider last:border-0">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${c.ok ? (c.warn ? 'bg-[#D97706]' : 'bg-[#169C85]') : 'bg-[#DC2626]'}`}>{c.ok ? '✓' : '!'}</span>
                    <span className="text-ink-3">{c.label}</span><b className="ml-auto text-ink tabular-nums">{c.value}</b><span className="text-[11.5px] text-muted-b w-[150px] text-right">{c.limit}</span>
                  </div>
                ))}
              </div>
            ))}
            {!checks.length && <div className="text-[12.5px] text-muted-b">No strings yet — press Auto-string.</div>}
          </div>
        </Panel>

        <div className="grid grid-cols-[1fr_1.3fr] gap-4 items-start">
          <Panel title="Cables & voltage rise" sub="BS 7671 mV/A/m for twin & earth; supply part uses the measured Ze" icon={Layers}>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-muted-b">AC run, inverter → consumer unit (m)</span><input type="number" className={inputCls} value={el.acCableM ?? 8} onChange={(ev) => set({ acCableM: Number(ev.target.value) })} /></label>
              <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-muted-b">AC cable (mm²)</span><Dropdown value={String(el.acCableMm2 ?? 6)} onChange={(ev) => set({ acCableMm2: Number(ev.target.value) })}>{CABLE_SIZES.map((s) => <option key={s} value={String(s)}>{s} mm²</option>)}</Dropdown></label>
              <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-muted-b">Ze, external loop impedance (Ω)</span><input type="number" step="0.01" className={inputCls} value={el.ze ?? 0.35} onChange={(ev) => set({ ze: Number(ev.target.value) })} /></label>
              <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-muted-b">Export limit (kW, blank = none)</span><input type="number" step="0.01" className={inputCls} value={el.exportLimitKw ?? ''} onChange={(ev) => set({ exportLimitKw: ev.target.value === '' ? undefined : Number(ev.target.value) })} /></label>
              <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-muted-b">DC run, roof → inverter (m)</span><input type="number" className={inputCls} value={el.dcCableM ?? 15} onChange={(ev) => set({ dcCableM: Number(ev.target.value) })} /></label>
              <label className="flex flex-col gap-1"><span className="text-[11px] font-semibold text-muted-b">DC cable (mm²)</span><Dropdown value={String(el.dcCableMm2 ?? 4)} onChange={(ev) => set({ dcCableMm2: Number(ev.target.value) })}>{[4, 6, 10].map((s) => <option key={s} value={String(s)}>{s} mm² PV cable</option>)}</Dropdown></label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
              <Row k="Inverter output current" v={`${ac.I.toFixed(1)} A`} />
              <Row k="Suggested AC breaker" v={`${breaker} A type B`} />
              <Row k="AC cable rise" v={`${ac.vCable.toFixed(2)} V · ${ac.pctCable.toFixed(2)}%`} bad={ac.pctCable > 1} />
              <Row k="Rise incl. supply (Ze)" v={`${(ac.vCable + ac.vSupply).toFixed(2)} V · ${ac.pctTotal.toFixed(2)}%`} />
              <Row k="DC loss, longest string" v={worstString ? `${dc.v.toFixed(2)} V · ${dc.pct.toFixed(2)}%` : '—'} bad={!!worstString && dc.pct > 1} />
              <Row k="DC loss power" v={worstString ? `${dc.w.toFixed(0)} W per string` : '—'} />
            </div>
            <div className="text-[11px] text-muted-3 mt-2">Guide: keep the inverter's own AC cable rise under 1% and DC losses under 1%. The supply figure uses Ze as a worst-case stand-in for the network impedance.</div>
          </Panel>
          <Panel title="Single-line diagram" sub="Updates live from the strings, inverter, battery and cable choices" icon={File}>
            <div ref={sldRef}><Sld design={design} inv={inv} checks={checks} strings={colored} breaker={breaker} acMm2={el.acCableMm2 ?? 6} dcMm2={el.dcCableMm2 ?? 4} route={route.code} /></div>
          </Panel>
        </div>

        <Panel title="Documents" sub="Opens a print-ready page — use Save as PDF to keep or send it" icon={File}>
          <div className="flex gap-2 flex-wrap">
            <DocBtn onClick={() => doc('site')} label="Site plan" sub="Roof layout, strings, boundary, scale" />
            <DocBtn onClick={() => doc('sld')} label="Single-line diagram" sub="PV → inverter → consumer unit → DNO" />
            <DocBtn onClick={() => doc('vr')} label="Voltage rise & string report" sub="Checks, cables, G98/G99 route" />
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Row({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return <div className={`flex justify-between rounded-[8px] px-2.5 py-1.5 ${bad ? 'bg-[#FDECEF] text-[#B01B4F]' : 'bg-[#F7F9FB]'}`}><span className={bad ? '' : 'text-muted-b'}>{k}</span><b className={bad ? '' : 'text-ink'}>{v}</b></div>
}
function DocBtn({ onClick, label, sub }: { onClick: () => void; label: string; sub: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-[10px] border border-[#DEE3EA] bg-white hover:border-[#62E4CC] hover:shadow-card px-3.5 py-2.5 text-left transition-all">
      <span className="w-9 h-9 rounded-[8px] bg-[#15223B] flex items-center justify-center"><File size={16} className="text-[#62E4CC]" /></span>
      <span><span className="block text-[13px] font-bold text-ink">{label}</span><span className="block text-[11.5px] text-muted-b">{sub}</span></span>
    </button>
  )
}

/** Single-line diagram as SVG: MPPT inputs → DC isolators → inverter (+ battery) → AC isolator → gen meter → CU → meter → cut-out. */
export function Sld({ design, inv, checks, strings, breaker, acMm2, dcMm2, route }: { design: Design; inv: ReturnType<typeof inverterById> & {}; checks: MpptCheck[]; strings: { id: string; color: string }[]; breaker: number; acMm2: number; dcMm2: number; route: string }) {
  const W = 640, rowH = 58, top = 20, n = Math.max(1, checks.length), H = Math.max(260, top + n * rowH + 40)
  const invY = top + (n * rowH) / 2 - 30
  const mod = moduleById(design.planes.find((p) => p.panels?.length)?.moduleId)
  const box = (x: number, y: number, w: number, h: number, t1: string, t2?: string, fill = '#fff') => (
    <g><rect x={x} y={y} width={w} height={h} rx={6} fill={fill} stroke="#15223B" strokeWidth={1.2} /><text x={x + w / 2} y={y + (t2 ? h / 2 - 3 : h / 2 + 4)} fontSize={10} fontWeight={700} textAnchor="middle" fill="#15223B">{t1}</text>{t2 && <text x={x + w / 2} y={y + h / 2 + 10} fontSize={8.5} textAnchor="middle" fill="#5B6576">{t2}</text>}</g>
  )
  const chain = [
    { t1: 'AC isolator', t2: `${breaker} A DP` }, { t1: 'Gen meter', t2: 'MID approved' }, { t1: 'Consumer unit', t2: `${breaker} A RCBO` }, { t1: 'Supply meter', t2: 'import/export' }, { t1: 'Cut-out', t2: `DNO · ${route}` },
  ]
  const invX = 250, cx0 = 360, cy = invY + 30
  return (
    <svg viewBox={`0 0 ${W} ${H + (design.batteryKwh ? 70 : 0)}`} className="w-full h-auto bg-white">
      {checks.map((m, i) => {
        const y = top + i * rowH
        const col = strings[strings.findIndex((s) => s.id === m.strings[0].id)]?.color ?? '#62E4CC'
        return (
          <g key={m.mppt}>
            <rect x={8} y={y} width={120} height={40} rx={6} fill="#15223B" />
            <rect x={8} y={y} width={5} height={40} rx={2} fill={col} />
            <text x={70} y={y + 16} fontSize={10} fontWeight={700} textAnchor="middle" fill="#fff">{`${m.parallel} × ${m.len} × ${mod.watts} W`}</text>
            <text x={70} y={y + 30} fontSize={8.5} textAnchor="middle" fill="#A8EDDF">{`MPPT ${m.mppt + 1} · ${m.checks[0].value} Voc`}</text>
            <line x1={128} y1={y + 20} x2={150} y2={y + 20} stroke="#15223B" strokeWidth={1.2} />
            {box(150, y + 6, 70, 28, 'DC isolator', `${dcMm2} mm²`)}
            <polyline points={`220,${y + 20} 235,${y + 20} 235,${cy} ${invX},${cy}`} fill="none" stroke="#15223B" strokeWidth={1.2} />
          </g>
        )
      })}
      {box(invX, invY, 95, 60, inv.brand, `${inv.name}`, '#EEF8F5')}
      <text x={invX + 47} y={invY + 72} fontSize={8.5} textAnchor="middle" fill="#5B6576">{`${inv.acKw} kW AC`}</text>
      {chain.map((c, i) => {
        const x = cx0 + i * 56
        return <g key={c.t1}><line x1={i ? x - 8 : invX + 95} y1={cy} x2={x} y2={cy} stroke="#15223B" strokeWidth={1.2} />{box(x, cy - 22, 48, 44, '', '')}<text x={x + 24} y={cy - 4} fontSize={7.5} fontWeight={700} textAnchor="middle" fill="#15223B">{c.t1}</text><text x={x + 24} y={cy + 9} fontSize={6.8} textAnchor="middle" fill="#5B6576">{c.t2}</text></g>
      })}
      <text x={cx0 + 5 * 56 - 4} y={cy - 28} fontSize={8} textAnchor="end" fill="#5B6576">{`${acMm2} mm² T&E`}</text>
      {design.batteryKwh ? <g><line x1={invX + 47} y1={invY + 78} x2={invX + 47} y2={H + 10} stroke="#15223B" strokeWidth={1.2} strokeDasharray="4 3" />{box(invX + 2, H + 10, 90, 40, 'Battery', `${design.batteryKwh} kWh usable`, '#F1FBF8')}</g> : null}
    </svg>
  )
}

/* ── printable documents ── */
type DocCtx = {
  design: Design; kwp: number; count: number; inv: NonNullable<ReturnType<typeof inverterById>>; el: El
  strings: { id: string; panelIds: string[]; color: string }[]; checks: MpptCheck[]
  ac: ReturnType<typeof acVoltageRise>; dc: ReturnType<typeof dcLoss>; breaker: number; route: ReturnType<typeof gridRoute>; planSvg: string; sldSvg: string
}
function openDocument(kind: 'site' | 'sld' | 'vr', c: DocCtx) {
  const title = kind === 'site' ? 'Site plan' : kind === 'sld' ? 'Single-line diagram' : 'Voltage rise & string report'
  const mod = moduleById(c.design.planes.find((p) => p.panels?.length)?.moduleId)
  const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]!)
  const block = `
    <table class="tb"><tr><td><b>The Solar House</b><br/><span>Design Studio · MCS installation</span></td>
    <td><b>${esc(c.design.name)}</b><br/><span>${esc(c.design.address)}</span></td>
    <td><b>${title}</b><br/><span>${new Date().toLocaleDateString('en-GB')} · Rev A</span></td>
    <td><b>${c.kwp.toFixed(2)} kWp</b><br/><span>${c.count} × ${esc(mod.brand)} ${mod.watts} W · ${esc(c.inv.brand)} ${esc(c.inv.name)}${c.design.batteryKwh ? ` · ${c.design.batteryKwh} kWh battery` : ''}</span></td></tr></table>`
  const checkRows = c.checks.flatMap((m) => m.checks.map((k) => `<tr><td>MPPT ${m.mppt + 1} (${m.parallel} × ${m.len})</td><td>${k.label}</td><td>${k.value}</td><td>${k.limit}</td><td class="${k.ok ? 'ok' : 'bad'}">${k.ok ? 'Pass' : 'FAIL'}</td></tr>`)).join('')
  let body = ''
  if (kind === 'site') {
    body = `<div class="fig">${c.planSvg}</div>
      <table class="t"><tr><th>Roof face</th><th>Pitch</th><th>Facing</th><th>Panels</th><th>Strings</th></tr>
      ${c.design.planes.filter((p) => p.panels?.length).map((p) => `<tr><td>${esc(p.name || 'Roof')}</td><td>${Math.round(p.pitchDeg)}°</td><td>${Math.round(p.azimuthDeg)}°</td><td>${p.panels!.length}</td><td>${c.strings.map((s, i) => (c.el.strings.find((x) => x.id === s.id)?.planeId === p.id ? `<span class="dot" style="background:${s.color}"></span>S${i + 1} (${s.panelIds.length})` : '')).join(' ')}</td></tr>`).join('')}</table>
      ${(c.design.notes ?? []).length ? `<h3>Site notes</h3><ol>${c.design.notes!.map((n) => `<li>${esc(n.text)}</li>`).join('')}</ol>` : ''}
      <p class="small">Boundary: HM Land Registry INSPIRE Index Polygon (indicative of the registered title extent, not a legal boundary). Imagery-derived measurements to be confirmed on survey.</p>`
  } else if (kind === 'sld') {
    body = `<div class="fig">${c.sldSvg}</div>
      <table class="t"><tr><th>Item</th><th>Specification</th></tr>
      <tr><td>PV array</td><td>${c.count} × ${esc(mod.brand)} ${esc(mod.name)} (${mod.watts} W) = ${c.kwp.toFixed(2)} kWp</td></tr>
      <tr><td>Inverter</td><td>${esc(c.inv.brand)} ${esc(c.inv.name)}, ${c.inv.acKw} kW AC, ${c.inv.mppts} MPPT</td></tr>
      <tr><td>DC cable</td><td>${c.el.dcCableMm2 ?? 4} mm² PV1-F, ${c.el.dcCableM ?? 15} m run, DC isolator per MPPT</td></tr>
      <tr><td>AC cable</td><td>${c.el.acCableMm2 ?? 6} mm² twin &amp; earth, ${c.el.acCableM ?? 8} m, ${c.breaker} A type B RCBO, ${c.breaker} A double-pole AC isolator</td></tr>
      <tr><td>Grid connection</td><td>${esc(c.route.text)}</td></tr>
      ${c.design.batteryKwh ? `<tr><td>Battery</td><td>${c.design.batteryKwh} kWh usable, DC-coupled to the hybrid inverter</td></tr>` : ''}</table>`
  } else {
    body = `<h3>String design checks</h3><table class="t"><tr><th>Input</th><th>Check</th><th>Value</th><th>Limit</th><th>Result</th></tr>${checkRows}</table>
      <h3>AC voltage rise</h3><table class="t">
      <tr><td>Inverter rated output</td><td>${c.inv.acKw} kW → ${c.ac.I.toFixed(1)} A at 230 V</td></tr>
      <tr><td>Cable</td><td>${c.el.acCableMm2 ?? 6} mm² T&amp;E, ${c.el.acCableM ?? 8} m (${({ 2.5: 18, 4: 11, 6: 7.3, 10: 4.4, 16: 2.8 } as Record<number, number>)[c.el.acCableMm2 ?? 6]} mV/A/m)</td></tr>
      <tr><td>Rise in the installation cable</td><td><b>${c.ac.vCable.toFixed(2)} V (${c.ac.pctCable.toFixed(2)}%)</b> ${c.ac.pctCable <= 1 ? '— within the 1% guide' : '— above the 1% guide: upsize the cable or shorten the run'}</td></tr>
      <tr><td>Rise across the supply (Ze ${c.el.ze ?? 0.35} Ω)</td><td>${c.ac.vSupply.toFixed(2)} V (${c.ac.pctSupply.toFixed(2)}%)</td></tr>
      <tr><td>Total rise to the network</td><td><b>${(c.ac.vCable + c.ac.vSupply).toFixed(2)} V (${c.ac.pctTotal.toFixed(2)}%)</b></td></tr></table>
      <h3>DC losses</h3><table class="t"><tr><td>Longest string, ${c.el.dcCableMm2 ?? 4} mm², ${c.el.dcCableM ?? 15} m each way</td><td>${c.dc.v.toFixed(2)} V (${c.dc.pct.toFixed(2)}%), ${c.dc.w.toFixed(0)} W</td></tr></table>
      <h3>Grid connection</h3><p>${esc(c.route.text)}</p>
      <p class="small">Method: string voltages at −10 °C (Voc) and 70 °C (Vmp) cell temperature using the module's temperature coefficients; BS 7671 Appendix 4 voltage-drop values; EREC G98/G99. Module and inverter figures are typical datasheet values and must be confirmed against the fitted products' datasheets.</p>`
  }
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(`<!doctype html><html><head><title>${title} — ${esc(c.design.name)}</title><style>
    @page{size:A4 landscape;margin:12mm} body{font-family:Inter,Segoe UI,Arial,sans-serif;color:#15223B;margin:0;padding:18px}
    h1{font-size:20px;margin:0 0 10px} h3{font-size:13px;margin:16px 0 6px} .fig{border:1px solid #DEE3EA;border-radius:8px;padding:8px;margin-bottom:10px}
    .fig svg{width:100%;height:auto;max-height:520px;display:block} table{border-collapse:collapse;width:100%;font-size:11.5px} .t td,.t th{border:1px solid #DEE3EA;padding:5px 7px;text-align:left} .t th{background:#F1F4F7}
    .tb{margin-top:12px;border:2px solid #15223B} .tb td{border:1px solid #15223B;padding:6px 8px;vertical-align:top;font-size:11px} .tb span{color:#5B6576}
    .ok{color:#0E7A66;font-weight:700} .bad{color:#B01B4F;font-weight:700} .small{font-size:10px;color:#5B6576} .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin:0 3px 0 6px}
    .bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px} button{background:#15223B;color:#fff;border:0;border-radius:6px;padding:7px 14px;font-weight:600;cursor:pointer}
    @media print{.bar button{display:none}}</style></head><body>
    <div class="bar"><h1>${title}</h1><button onclick="print()">Print / Save as PDF</button></div>${body}${block}</body></html>`)
  w.document.close()
}
