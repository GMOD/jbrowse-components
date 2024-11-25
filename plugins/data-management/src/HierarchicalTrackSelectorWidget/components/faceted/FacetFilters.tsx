import React from 'react'
import { observer } from 'mobx-react'

// locals
import FacetFilter from './FacetFilter'
import { getRowStr } from './util'
import type { Row } from './util'
import type { HierarchicalTrackSelectorModel } from '../../model'

const FacetFilters = observer(function ({
  rows,
  columns,
  model,
}: {
  rows: Row[]
  columns: { field: string }[]
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
      const key = getRowStr(facet, row)
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

    currentRows = currentRows.filter(row =>
      filter !== undefined ? filter.has(getRowStr(facet, row)) : true,
    )
  }

  return (
    <div>
      {facets.map(c => (
        <FacetFilter
          key={c.field}
          vals={[...uniqs.get(c.field)!]}
          column={c}
          model={model}
        />
      ))}
    </div>
  )
})
export default FacetFilters
