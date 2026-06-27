import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'

import { bareFacet, getRowStr, isMetadataFacet } from './util.ts'
import TrackSelectorTrackMenu from '../../HierarchicalTrackSelectorWidget/components/tree/TrackSelectorTrackMenu.tsx'

import type { FacetedColumn } from './FacetedDataGrid.tsx'
import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { FacetedModel } from '../facetedModel.ts'

// Builds the column list: a name column (with the per-track menu) followed by
// the facet columns in field order. A metadata column whose bare key collides
// with a non-metadata column name is disambiguated as "x (from metadata)". All
// non-name cells share getRowStr for value extraction.
export function getFacetedColumns({
  faceted,
  model,
  nameClassName,
}: {
  faceted: FacetedModel
  model: HierarchicalTrackSelectorModel
  nameClassName: string
}): FacetedColumn[] {
  const { facetFields, nonMetadataFieldSet } = faceted
  return [
    {
      id: 'name',
      header: 'name',
      cell: row => (
        <div className={nameClassName}>
          <SanitizedHTML html={row.name} />
          <TrackSelectorTrackMenu id={row.id} conf={row.conf} model={model} />
        </div>
      ),
    },
    ...facetFields.map(id => {
      const bare = bareFacet(id)
      return {
        id,
        header:
          isMetadataFacet(id) && nonMetadataFieldSet.has(bare)
            ? `${bare} (from metadata)`
            : bare,
        cell: row => getRowStr(id, row),
      } satisfies FacetedColumn
    }),
  ]
}
