import React from 'react'
import FacetFilter from './FacetFilter'
import { HierarchicalTrackSelectorModel } from '../../model'
import { observer } from 'mobx-react'

const FacetFilters = observer(function ({
  rows,
  columns,
  width,
  model,
}: {
  rows: Record<string, unknown>[]
  columns: { field: string }[]
  width: number
  model: HierarchicalTrackSelectorModel
}) {
  const { faceted } = model
  const { filters } = faceted
  const facets = columns.slice(1)
  const uniqs = new Map(
    facets.map(f => [f.field, new Map<string, number>()] as const),
  )

  // this code "stages the facet filters" in order that the user has selected
  // them, which relies on the js behavior that the order of the returned keys is
  // related to the insertion order.
  const filterKeys = faceted.filters.keys()
  const facetKeys = facets.map(f => f.field)
  const ret = new Set<string>()
  for (const entry of filterKeys) {
    // give non-empty filters priority
    if (filters.get(entry)?.length) {
      ret.add(entry)
    }
  }
  for (const entry of facetKeys) {
    ret.add(entry)
  }

  let currentRows = rows
  for (const facet of ret) {
    const elt = uniqs.get(facet)!
    for (const row of currentRows) {
      const key = `${row[facet] || ''}`
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
    const filter = filters.get(facet)?.length
      ? new Set(filters.get(facet))
      : undefined
    currentRows = currentRows.filter(row => {
      return filter !== undefined ? filter.has(row[facet] as string) : true
    })
  }

  return (
    <div>
      {facets.map(column => (
        <FacetFilter
          key={column.field}
          vals={[...uniqs.get(column.field)!]}
          column={column}
          width={width}
          model={model}
        />
      ))}
    </div>
  )
})
export default FacetFilters
