import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { coarseStripHTML } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import OverrideBadge from '../../HierarchicalTrackSelectorWidget/components/tree/OverrideBadge.tsx'
import TrackNameText from '../../HierarchicalTrackSelectorWidget/components/tree/TrackNameText.tsx'
import TrackSelectorTrackMenu from '../../HierarchicalTrackSelectorWidget/components/tree/TrackSelectorTrackMenu.tsx'
import { selectOnModifierClick } from '../../HierarchicalTrackSelectorWidget/components/tree/selectOnModifierClick.ts'
import { useTableStyles } from './tableStyles.ts'
import { facetLabel, getRowStr, sortKey } from './util.ts'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { TrackTableModel, TrackRow } from '../trackTableModel.ts'
import type { TableColumn } from './TrackTableGrid.tsx'

const NameCell = observer(function NameCell({
  row,
  model,
  checkboxId,
}: {
  row: TrackRow
  model: HierarchicalTrackSelectorModel
  checkboxId: string
}) {
  const { classes } = useTableStyles()
  return (
    <label
      htmlFor={checkboxId}
      className={classes.nameCell}
      data-tooltip-html={row.description}
      aria-description={coarseStripHTML(row.description)}
      onClick={selectOnModifierClick(model, row.id)}
    >
      <TrackNameText name={row.name} />
      <OverrideBadge model={model} trackId={row.id} name={row.name} />
      <TrackSelectorTrackMenu id={row.id} conf={row.conf} model={model} />
    </label>
  )
})

// a value shows in full on hover only when its column cuts it
const ValueCell = observer(function ValueCell({ html }: { html: string }) {
  const { classes } = useTableStyles()
  return (
    <div data-tooltip="" data-clip className={classes.valueCell}>
      <SanitizedHTML html={html} />
    </div>
  )
})

// Builds the column list: a name column (with the per-track menu, and a label
// for the row's checkbox, so a click on the name toggles the track as in the
// tree) followed by the facet columns in field order. A metadata column whose
// bare key collides with a non-metadata column name is disambiguated as "x
// (from metadata)". All non-name cells share getRowStr for value extraction.
export function getTableColumns({
  table,
  model,
  fields,
  checkboxId,
}: {
  table: TrackTableModel
  model: HierarchicalTrackSelectorModel
  fields: string[]
  checkboxId: (rowId: string) => string
}): TableColumn[] {
  const { nonMetadataFieldSet } = table
  return [
    {
      id: 'name',
      header: 'Name',
      fill: true,
      sortValue: row => sortKey('name', row),
      cell: row => (
        <NameCell row={row} model={model} checkboxId={checkboxId(row.id)} />
      ),
    },
    ...fields
      .filter(id => id !== 'name')
      .map(
        id =>
          ({
            id,
            header: facetLabel(id, nonMetadataFieldSet),
            sortValue: row => sortKey(id, row),
            // any metadata value (or category/description) can carry markup, and
            // SanitizedHTML short-circuits to a plain span when it doesn't
            cell: row => <ValueCell html={getRowStr(id, row)} />,
          }) satisfies TableColumn,
      ),
  ]
}
