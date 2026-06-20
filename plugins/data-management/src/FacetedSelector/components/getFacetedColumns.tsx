import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'

import TrackSelectorTrackMenu from '../../HierarchicalTrackSelectorWidget/components/tree/TrackSelectorTrackMenu.tsx'

import type { FacetedColumn } from './FacetedDataGrid.tsx'
import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { FacetedModel, FacetedRow } from '../facetedModel.ts'

// Builds the column list: a name column (with the per-track menu), the
// non-metadata facet columns, then the metadata columns (disambiguated when a
// metadata key collides with a non-metadata column name).
export function getFacetedColumns({
  faceted,
  model,
  nameClassName,
}: {
  faceted: FacetedModel
  model: HierarchicalTrackSelectorModel
  nameClassName: string
}): FacetedColumn[] {
  const { filteredNonMetadataKeys, filteredMetadataKeys, nonMetadataFieldSet } =
    faceted
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
    ...filteredNonMetadataKeys.map(
      e =>
        ({
          id: e,
          header: e,
          cell: (row: FacetedRow) =>
            row[e as 'category' | 'adapter' | 'description'],
        }) satisfies FacetedColumn,
    ),
    ...filteredMetadataKeys.map(
      e =>
        ({
          id: `metadata.${e}`,
          header: nonMetadataFieldSet.has(e) ? `${e} (from metadata)` : e,
          cell: (row: FacetedRow) => {
            const val = row.metadata[e]
            return val == null ? null : `${val}`
          },
        }) satisfies FacetedColumn,
    ),
  ]
}
