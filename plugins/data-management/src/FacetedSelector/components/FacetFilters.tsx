import { observer } from 'mobx-react'

import FacetFilter from './FacetFilter.tsx'

import type { FacetedModel } from '../facetedModel.ts'

const FacetFilters = observer(function FacetFilters({
  faceted,
}: {
  faceted: FacetedModel
}) {
  return (
    <div>
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
