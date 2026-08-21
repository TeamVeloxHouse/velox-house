import { useState } from 'react'
import { useState_, useActions } from '../store/store'
import type { CustomEntity, CustomField } from '../store/types'
import { classNames } from '../lib/format'

/** Inline-editable custom-field rows for a record's Details panel. */
export function CustomFieldRows({ entity, id, values }: { entity: CustomEntity; id: string; values?: Record<string, string> }) {
  const { customFields } = useState_()
  const fields = customFields.filter((f) => f.entity === entity)
  if (fields.length === 0) return null
  return (
    <>
      {fields.map((f) => (
        <CustomRow key={f.id} field={f} entity={entity} id={id} value={values?.[f.id] ?? ''} />
      ))}
    </>
  )
}

function CustomRow({ field, entity, id, value }: { field: CustomField; entity: CustomEntity; id: string; value: string }) {
  const act = useActions()
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(value)

  function commit() {
    setEditing(false)
    if (v !== value) act.setCustom(entity, id, field.id, v)
  }

  return (
    <div className="flex items-center justify-between gap-3 group">
      <span className="text-[12px] text-muted-2 shrink-0">{field.label}</span>
      {field.type === 'select' ? (
        <select
          value={v}
          onChange={(e) => { setV(e.target.value); act.setCustom(entity, id, field.id, e.target.value) }}
          className="text-[13px] font-medium text-ink-2 bg-transparent text-right outline-none cursor-pointer hover:text-accent"
        >
          <option value="">—</option>
          {field.options?.map((o) => (<option key={o} value={o}>{o}</option>))}
        </select>
      ) : editing ? (
        <input
          autoFocus
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setV(value); setEditing(false) } }}
          className="text-[13px] font-medium text-ink-2 bg-white border border-accent rounded px-1.5 py-0.5 text-right outline-none w-[55%]"
        />
      ) : (
        <button onClick={() => setEditing(true)} className={classNames('text-[13px] font-medium text-right hover:text-accent transition-colors', v ? 'text-ink-2' : 'text-muted-3 italic')}>
          {field.type === 'url' && v ? <a href={v.startsWith('http') ? v : `https://${v}`} target="_blank" rel="noreferrer" className="text-accent" onClick={(e) => e.stopPropagation()}>{v.replace(/^https?:\/\//, '')}</a> : v || 'Add'}
        </button>
      )}
    </div>
  )
}
