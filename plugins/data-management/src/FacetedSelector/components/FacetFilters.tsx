import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import FacetFilter from './FacetFilter.tsx'

import type { FacetedModel } from '../facetedModel.ts'

const FacetFilters = observer(function FacetFilters({
  faceted,
}: {
  faceted: FacetedModel
}) {
  const hasActiveFilters = [...faceted.filters.values()].some(v => v.length > 0)
  return (
    <div>
      <Button
        size="small"
        disabled={!hasActiveFilters}
        onClick={() => {
          faceted.clearFilters()
        }}
      >
        Clear all filters
      </Button>
      {[...faceted.facetCategoryCounts].map(([field, categoryCountMap]) => (
        <FacetFilter
          key={field}
          vals={[...categoryCountMap]}
          field={field}
          faceted={faceted}
        />
      ))}
    </div>
  )
})
export default FacetFilters
