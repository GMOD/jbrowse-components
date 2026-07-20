import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'

import OverrideBadge from '../../HierarchicalTrackSelectorWidget/components/tree/OverrideBadge.tsx'
import TrackSelectorTrackMenu from '../../HierarchicalTrackSelectorWidget/components/tree/TrackSelectorTrackMenu.tsx'
import { facetLabel, getRowStr } from './util.ts'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { FacetedModel } from '../facetedModel.ts'
import type { FacetedColumn } from './FacetedDataGrid.tsx'

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
          <OverrideBadge model={model} trackId={row.id} name={row.name} />
          <TrackSelectorTrackMenu id={row.id} conf={row.conf} model={model} />
        </div>
      ),
    },
    ...facetFields.map(
      id =>
        ({
          id,
          header: facetLabel(id, nonMetadataFieldSet),
          cell: row => getRowStr(id, row),
        }) satisfies FacetedColumn,
    ),
  ]
}
