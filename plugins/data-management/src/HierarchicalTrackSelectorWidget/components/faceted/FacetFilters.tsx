import React from 'react'
import FacetFilter from './FacetFilter'

export default function FacetFilters({
  rows,
  columns,
  dispatch,
  filters,
  width,
}: {
  rows: Record<string, unknown>[]
  filters: Record<string, string[]>
  columns: { field: string }[]
  dispatch: (arg: { key: string; val: string[] }) => void
  width: number
}) {
  const facets = columns.slice(1)
  const uniqs = new Map(
    facets.map(f => [f.field, new Map<string, number>()] as const),
  )
  for (const facet of facets) {
    const elt = uniqs.get(facet.field)!
    for (const row of rows) {
      const key = `${row[facet.field] || ''}`
      const val = elt.get(key)
      // we don't allow filtering on empty yet
      if (key) {
        if (val === undefined) {
          elt.set(key, 1)
        } else {
          elt.set(key, val + 1)
        }
      }
    }
  }

  return (
    <div>
      {facets.map(column => {
        return (
          <FacetFilter
            key={column.field}
            vals={[...uniqs.get(column.field)!]}
            column={column}
            width={width}
            dispatch={dispatch}
            filters={filters}
          />
        )
      })}
    </div>
  )
}
