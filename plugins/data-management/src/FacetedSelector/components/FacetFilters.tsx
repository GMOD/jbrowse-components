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

  // Active-filter facets first for drill-down: their counts reflect the pre-filter row set
  const orderedFacets = [
    ...facets.filter(f => filters.get(f.field)?.length),
    ...facets.filter(f => !filters.get(f.field)?.length),
  ]

  let currentRows = rows
  for (const facet of orderedFacets) {
    const categoryCountMap = facetFieldToCategoryCountMap.get(facet.field)!
    for (const row of currentRows) {
      const key = getRowStr(facet.field, row)
      if (key) {
        categoryCountMap.set(key, (categoryCountMap.get(key) ?? 0) + 1)
      }
    }
    const filterValues = filters.get(facet.field)
    if (filterValues?.length) {
      const filterSet = new Set(filterValues)
      currentRows = currentRows.filter(row =>
        filterSet.has(getRowStr(facet.field, row)),
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
