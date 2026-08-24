import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Segmented, Kpi, Chip, type ChipTone } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Plus } from '../components/icons'
import { Modal, Field, Input } from '../components/overlays'
import { useState_, useActions } from '../store/store'
import type { DocumentStatus } from '../store/types'
import { money } from '../lib/format'

const dTone: Record<DocumentStatus, ChipTone> = { Viewed: 'accent', Sent: 'neutral', Expired: 'warning', Signed: 'positive', Draft: 'neutral' }

const lineItems = [
  ['Data-centre UPS units × 4', 168000],
  ['Install & commissioning', 72000],
  ['Grid monitoring licence (3yr)', 43200],
  ['Maintenance retainer (12mo)', 11400],
] as const

export function Documents() {
  const { documents: docs } = useState_()
  const act = useActions()
  const [view, setView] = useState('Quotes')
  const [addOpen, setAddOpen] = useState(false)
  const template = '2fr 1.6fr 1fr 1fr 1fr 1fr'
  const subtotal = lineItems.reduce((s, [, v]) => s + v, 0)
  const discount = 8600
  return (
    <>
      <TopBar
        title="Documents"
        center={<Segmented options={['Quotes', 'Contracts', 'Templates']} value={view} onChange={setView} />}
        actions={
          <>
            <Button>E-signature · on</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAddOpen(true)}>New quote</Button>
          </>
        }
      />
      <NewQuoteModal open={addOpen} onClose={() => setAddOpen(false)} />
      <PageBody>
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 420px' }}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-4">
              <Kpi label="Open quotes" value="$1.1M" delta="14 documents" deltaTone="muted" />
              <Kpi variant="blue" label="Signed this quarter" value="$2.3M" delta="+31% vs last" />
              <Kpi label="Avg. time to sign" value="4.2d" delta="−1.1d" />
            </div>
            <Table
              template={template}
              columns={[
                { key: 'doc', header: 'Document' },
                { key: 'deal', header: 'Deal' },
                { key: 'value', header: 'Value', align: 'right' },
                { key: 'status', header: 'Status' },
                { key: 'views', header: 'Views', align: 'right' },
                { key: 'sent', header: 'Sent' },
              ]}
              footer={<><span>{docs.length} documents</span><span>Live tracking on</span></>}
            >
              {docs.map((d) => (
                <Row key={d.ref} template={template}>
                  <Cell>
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-lg bg-negative text-white text-[10px] font-bold flex items-center justify-center shrink-0">PDF</span>
                      <span className="font-semibold text-ink-2">{d.ref}</span>
                    </div>
                  </Cell>
                  <Cell muted>{d.deal}</Cell>
                  <Cell align="right" className="font-semibold text-ink-2">{money(d.value, { compact: true })}</Cell>
                  <Cell><Chip tone={dTone[d.status]} dot>{d.status}</Chip></Cell>
                  <Cell align="right" muted>{d.views}</Cell>
                  <Cell muted>{d.sent}</Cell>
                </Row>
              ))}
            </Table>
          </div>

          {/* quote preview */}
          <div className="bg-surface border border-border rounded-card overflow-hidden flex flex-col">
            <div className="p-6 flex-1" style={{ background: '#FCFCFD' }}>
              <div className="flex items-center justify-between pb-5 border-b border-divider">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-[10px] bg-accent text-white flex items-center justify-center font-bold">S</span>
                  <div>
                    <div className="text-[15px] font-bold text-ink">Simplr</div>
                    <div className="text-[11px] text-muted-2">Quotation QUO-1042</div>
                  </div>
                </div>
                <div className="text-right text-[11px] text-muted-2">
                  <div>Issued Sep 14, 2026</div>
                  <div>Valid 30 days</div>
                </div>
              </div>
              <div className="py-4 flex flex-col gap-2.5">
                {lineItems.map(([label, v]) => (
                  <div key={label} className="flex items-center justify-between text-[13px]">
                    <span className="text-ink-3">{label}</span>
                    <span className="font-medium text-ink-2">{money(v)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-[13px] text-warning">
                  <span>Volume discount</span>
                  <span className="font-medium">−{money(discount)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-3 border-t border-divider">
                <span className="text-[14px] font-bold text-ink">Total</span>
                <span className="text-[18px] font-bold text-ink">{money(subtotal - discount)}</span>
              </div>
              <div className="text-[11px] text-muted-2 leading-relaxed mt-2">
                Terms: 30% on order, 60% on delivery, 10% on commissioning. Prices exclude VAT.
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                {['Authorised by', 'Client signature'].map((l) => (
                  <div key={l}>
                    <div className="border-b border-dashed border-input-border h-8" />
                    <div className="text-[11px] text-muted-2 mt-1">{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-border flex gap-2">
              <Button className="flex-1 justify-center" onClick={() => act.toast('Quote downloaded (demo)')}>Download</Button>
              <Button className="flex-1 justify-center" onClick={() => act.toast('Quote duplicated')}>Duplicate</Button>
              <Button variant="primary" className="flex-1 justify-center" onClick={() => act.toast('Sent for e-signature to Callum Reed')}>Send for signature</Button>
            </div>
          </div>
        </div>
      </PageBody>
    </>
  )
}

function NewQuoteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const act = useActions()
  const [deal, setDeal] = useState('')
  const [value, setValue] = useState('')
  const reset = () => { setDeal(''); setValue('') }
  return (
    <Modal open={open} onClose={onClose} title="New quote" subtitle="Create a quotation document"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { if (deal.trim()) { act.addDocument({ deal: deal.trim(), value: Number(value) || 0 }); reset(); onClose() } }}>Create quote</Button></>}>
      <Field label="Deal / description"><Input value={deal} onChange={(e) => setDeal(e.target.value)} placeholder="Solar + storage — Acme Ltd" autoFocus /></Field>
      <Field label="Value (£)"><Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="210000" /></Field>
    </Modal>
  )
}
