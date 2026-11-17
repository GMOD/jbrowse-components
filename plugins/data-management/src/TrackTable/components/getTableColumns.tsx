import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { observer } from 'mobx-react'

import OverrideBadge from '../../HierarchicalTrackSelectorWidget/components/tree/OverrideBadge.tsx'
import TrackNameText from '../../HierarchicalTrackSelectorWidget/components/tree/TrackNameText.tsx'
import TrackSelectorTrackMenu from '../../HierarchicalTrackSelectorWidget/components/tree/TrackSelectorTrackMenu.tsx'
import { useTableStyles } from './tableStyles.ts'
import { facetLabel, getRowStr } from './util.ts'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { TrackTableModel, TrackRow } from '../trackTableModel.ts'
import type { TableColumn } from './TrackTableGrid.tsx'

const NameCell = observer(function NameCell({
  row,
  model,
}: {
  row: TrackRow
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useTableStyles()
  return (
    <div className={classes.nameCell}>
      <TrackNameText name={row.name} />
      <OverrideBadge model={model} trackId={row.id} name={row.name} />
      <TrackSelectorTrackMenu id={row.id} conf={row.conf} model={model} />
    </div>
  )
})

// Builds the column list: a name column (with the per-track menu) followed by
// the facet columns in field order. A metadata column whose bare key collides
// with a non-metadata column name is disambiguated as "x (from metadata)". All
// non-name cells share getRowStr for value extraction.
export function getTableColumns({
  table,
  model,
  fields,
}: {
  table: TrackTableModel
  model: HierarchicalTrackSelectorModel
  fields: string[]
}): TableColumn[] {
  const { nonMetadataFieldSet } = table
  return [
    {
      id: 'name',
      header: 'name',
      cell: row => <NameCell row={row} model={model} />,
    },
    ...fields
      .filter(id => id !== 'name')
      .map(
        id =>
          ({
            id,
            header: facetLabel(id, nonMetadataFieldSet),
            // any metadata value (or category/description) can carry markup, and
            // SanitizedHTML short-circuits to a plain span when it doesn't
            cell: row => <SanitizedHTML html={getRowStr(id, row)} />,
          }) satisfies TableColumn,
      ),
  ]
}
