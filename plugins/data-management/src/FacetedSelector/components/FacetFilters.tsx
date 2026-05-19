import { observer } from 'mobx-react'

import FacetFilter from './FacetFilter.tsx'
import { getRowStr } from './util.ts'

import type { Row } from './util.ts'
import type { FacetedModel } from '../facetedModel.ts'

const FacetFilters = observer(function FacetFilters({
  rows,
  fields,
  faceted,
}: {
  rows: Row[]
  fields: string[]
  faceted: FacetedModel
}) {
  const { filters } = faceted
  const facets = fields.slice(1)
  const facetFieldToCategoryCountMap = new Map(
    facets.map(f => [f, new Map<string, number>()] as const),
  )

  // Active-filter facets first for drill-down: their counts reflect the pre-filter row set
  const orderedFacets = [
    ...facets.filter(f => filters.get(f)?.length),
    ...facets.filter(f => !filters.get(f)?.length),
  ]

  let currentRows = rows
  for (const facet of orderedFacets) {
    const categoryCountMap = facetFieldToCategoryCountMap.get(facet)!
    for (const row of currentRows) {
      const key = getRowStr(facet, row)
      if (key) {
        categoryCountMap.set(key, (categoryCountMap.get(key) ?? 0) + 1)
      }
    }
    const filterValues = filters.get(facet)
    if (filterValues?.length) {
      const filterSet = new Set(filterValues)
      currentRows = currentRows.filter(row =>
        filterSet.has(getRowStr(facet, row)),
      )
    }
  }

  return (
    <div>
      {facets.map(field => (
        <FacetFilter
          key={field}
          vals={[...facetFieldToCategoryCountMap.get(field)!]}
          field={field}
          faceted={faceted}
        />
      ))}
    </div>
  )
})
export default FacetFilters
