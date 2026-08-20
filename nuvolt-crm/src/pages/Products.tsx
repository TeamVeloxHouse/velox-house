import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Segmented, Kpi, Chip } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Plus, Download } from '../components/icons'
import { products } from '../data/mock'
import { useActions } from '../store/store'
import { money } from '../lib/format'

export function Products() {
  const act = useActions()
  const [view, setView] = useState('Catalogue')
  const template = '2fr 1fr 1.2fr 1fr 1fr 0.9fr 0.8fr'
  return (
    <>
      <TopBar
        title="Products"
        center={<Segmented options={['Catalogue', 'Price lists', 'Bundles']} value={view} onChange={setView} />}
        actions={
          <>
            <Button>GBP £</Button>
            <Button icon={<Download size={16} />} onClick={() => act.toast('Import started (demo)', 'accent')}>Import</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => act.toast('Add product (demo)', 'accent')}>Add product</Button>
          </>
        }
      />
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
