import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Segmented, Kpi, Chip } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Plus } from '../components/icons'
import { Modal, Field, Input, Select } from '../components/overlays'
import { type Product } from '../data/mock'
import { useState_, useActions } from '../store/store'
import { money } from '../lib/format'

export function Products() {
  const { products } = useState_()
  const act = useActions()
  const [view, setView] = useState('Catalogue')
  const [addOpen, setAddOpen] = useState(false)
  const template = '2fr 1fr 1.2fr 1fr 1fr 0.9fr 0.8fr'
  return (
    <>
      <TopBar
        title="Products"
        center={<Segmented options={['Catalogue', 'Price lists', 'Bundles']} value={view} onChange={setView} />}
        actions={
          <>
            <Button>GBP £</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAddOpen(true)}>Add product</Button>
          </>
        }
      />
      <AddProductModal open={addOpen} onClose={() => setAddOpen(false)} />
      <PageBody>
        <div className="grid grid-cols-3 gap-4">
          <Kpi label="Active products" value="18" delta="2 added this quarter" />
          <Kpi variant="blue" label="Avg. deal size" value="$74K" delta="+6% vs last quarter" />
          <Kpi label="Attach rate" value="1.8" delta="products per deal" deltaTone="muted" />
        </div>
        <Table
          template={template}
          columns={[
            { key: 'name', header: 'Product' },
            { key: 'sku', header: 'SKU' },
            { key: 'cat', header: 'Category' },
            { key: 'price', header: 'Unit price', align: 'right' },
            { key: 'billing', header: 'Billing' },
            { key: 'deals', header: 'Open deals', align: 'right' },
            { key: 'status', header: 'Status' },
          ]}
          footer={<><span>{products.length} products</span><span className="flex gap-3"><button>Prev</button><button className="text-ink-3 font-medium">Next</button></span></>}
        >
          {products.map((p) => (
            <Row key={p.id} template={template}>
              <Cell className="font-semibold text-ink-2">{p.name}</Cell>
              <Cell muted><span className="font-mono text-[12px]">{p.sku}</span></Cell>
              <Cell muted>{p.category}</Cell>
              <Cell align="right" className="font-semibold text-ink-2">{money(p.unitPrice)}</Cell>
              <Cell muted>{p.billing}</Cell>
              <Cell align="right" className="text-ink-2">{p.openDeals}</Cell>
              <Cell><Chip tone={p.active ? 'positive' : 'neutral'} dot>{p.active ? 'Active' : 'Retired'}</Chip></Cell>
            </Row>
          ))}
        </Table>
      </PageBody>
    </>
  )
}

function AddProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const act = useActions()
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState<Product['category']>('Hardware')
  const [price, setPrice] = useState('')
  const [billing, setBilling] = useState<Product['billing']>('One-off')
  const reset = () => { setName(''); setSku(''); setPrice('') }
  return (
    <Modal open={open} onClose={onClose} title="Add product" subtitle="Add to your catalogue"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { if (name.trim()) { act.addProduct({ name: name.trim(), sku: sku || '—', category, unitPrice: Number(price) || 0, billing }); reset(); onClose() } }}>Add product</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Battery Storage Module" autoFocus /></Field>
        <Field label="SKU"><Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="BS-MOD-250" /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Category"><Select value={category} onChange={(e) => setCategory(e.target.value as Product['category'])}><option>Hardware</option><option>Software</option><option>Service</option></Select></Field>
        <Field label="Unit price (£)"><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="28500" /></Field>
        <Field label="Billing"><Select value={billing} onChange={(e) => setBilling(e.target.value as Product['billing'])}><option>One-off</option><option>Monthly</option><option>Annual</option><option>Project</option></Select></Field>
      </div>
    </Modal>
  )
}
