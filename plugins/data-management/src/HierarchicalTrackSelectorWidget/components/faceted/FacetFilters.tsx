import { observer } from 'mobx-react'

import FacetFilter from './FacetFilter.tsx'
import { getRowStr } from './util.ts'

import type { Row } from './util.ts'
import type { HierarchicalTrackSelectorModel } from '../../model.ts'

const FacetFilters = observer(function FacetFilters({
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
  const facetFieldToCategoryCountMap = new Map(
    columns.slice(1).map(f => [f.field, new Map<string, number>()] as const),
  )

  // 1. filterKeys: the title of the facets (right hand panel) that have been
  // already filtered e.g. user clicked a facet on the right hand panel
  const filterKeys = faceted.filters.keys()

  // 2. facetKeys: the title of the facets (right hand panel), just the rest of
  // them
  const facetKeys = facets.map(f => f.field)

  // these two loops add facet filters in the order that the user has selected
  // them, which is the intuitive 'drilling down' behavior users want from
  // faceted selections
  const facetKeysPrioritizingUserSelections = new Set<string>()
  for (const entry of filterKeys) {
    // give non-empty filters priority
    if (filters.get(entry)?.length) {
      facetKeysPrioritizingUserSelections.add(entry)
    }
  }
  for (const entry of facetKeys) {
    facetKeysPrioritizingUserSelections.add(entry)
  }

  let currentRows = rows
  for (const facetKey of facetKeysPrioritizingUserSelections) {
    const categoryCountMap = facetFieldToCategoryCountMap.get(facetKey)
    if (categoryCountMap) {
      for (const row of currentRows) {
        const key = getRowStr(facetKey, row)
        const currentCount = categoryCountMap.get(key)
        // we don't allow filtering on empty yet
        if (key) {
          if (currentCount === undefined) {
            categoryCountMap.set(key, 1)
          } else {
            categoryCountMap.set(key, currentCount + 1)
          }
        }
      }
    }
    const filter = filters.get(facetKey)?.length
      ? new Set(filters.get(facetKey))
      : undefined

    currentRows = currentRows.filter(row =>
      filter !== undefined ? filter.has(getRowStr(facetKey, row)) : true,
    )
  }

  return (
    <div>
      {facets.map(c => (
        <FacetFilter
          key={c.field}
          vals={[...facetFieldToCategoryCountMap.get(c.field)!]}
          column={c}
          model={model}
        />
      ))}
    </div>
  )
})
export default FacetFilters
