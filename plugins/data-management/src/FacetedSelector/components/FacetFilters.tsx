import { observer } from 'mobx-react'

import FacetFilter from './FacetFilter.tsx'
import { getRowStr } from './util.ts'

import type { Row } from './util.ts'
import type { FacetedModel } from '../facetedModel.ts'

const FacetFilters = observer(function FacetFilters({
  rows,
  columns,
  faceted,
}: {
  rows: Row[]
  columns: { field: string }[]
  faceted: FacetedModel
}) {
  const { filters } = faceted
  const facets = columns.slice(1)
  const facetFieldToCategoryCountMap = new Map(
    facets.map(f => [f.field, new Map<string, number>()] as const),
  )

  // prioritize facets that already have active filters for drill-down behavior
  const facetKeysPrioritizingUserSelections = new Set<string>()
  for (const entry of filters.keys()) {
    if (filters.get(entry)?.length) {
      facetKeysPrioritizingUserSelections.add(entry)
    }
  }
  for (const f of facets) {
    facetKeysPrioritizingUserSelections.add(f.field)
  }

  let currentRows = rows
  for (const facetKey of facetKeysPrioritizingUserSelections) {
    const categoryCountMap = facetFieldToCategoryCountMap.get(facetKey)
    if (categoryCountMap) {
      for (const row of currentRows) {
        const key = getRowStr(facetKey, row)
        if (key) {
          categoryCountMap.set(key, (categoryCountMap.get(key) ?? 0) + 1)
        }
      }
    }
    const filterValues = filters.get(facetKey)
    if (filterValues?.length) {
      const filterSet = new Set(filterValues)
      currentRows = currentRows.filter(row =>
        filterSet.has(getRowStr(facetKey, row)),
      )
    }
  }

  return (
    <div>
      {facets.map(c => (
        <FacetFilter
          key={c.field}
          vals={[...facetFieldToCategoryCountMap.get(c.field)!]}
          column={c}
          faceted={faceted}
        />
      ))}
    </div>
  )
})
export default FacetFilters
