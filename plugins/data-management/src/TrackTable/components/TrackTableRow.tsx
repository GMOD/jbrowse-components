import { coarseStripHTML } from '@jbrowse/core/util'
import { cx } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import CheckboxLite from '../../HierarchicalTrackSelectorWidget/components/tree/CheckboxLite.tsx'
import { isUnsupported } from '../../HierarchicalTrackSelectorWidget/util.ts'
import { setTracksSelected } from '../tableSelection.ts'
import { useTableStyles } from './tableStyles.ts'
import { getRowStr } from './util.ts'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { TrackRow, TrackTableModel } from '../trackTableModel.ts'
import type { TableColumn } from './TrackTableGrid.tsx'

const SelectableRow = observer(function SelectableRow({
  model,
  table,
  row,
  children,
}: {
  model: HierarchicalTrackSelectorModel
  table: TrackTableModel
  row: TrackRow
  children: React.ReactNode
}) {
  const { classes } = useTableStyles()
  const { useShoppingCart } = table
  const selected = (
    useShoppingCart ? model.selectionSet : model.shownTrackIds
  ).has(row.id)
  return (
    <tr className={cx(classes.bodyRow, selected && classes.selectedRow)}>
      <td className={classes.checkboxCell}>
        <CheckboxLite
          className={classes.rowCheckbox}
          checked={selected}
          disabled={isUnsupported(row.name)}
          label={`Select ${coarseStripHTML(row.name)}`}
          onChange={() => {
            setTracksSelected(model, [row.id], !selected, useShoppingCart)
          }}
        />
      </td>
      {children}
    </tr>
  )
})

const TrackTableRow = observer(function TrackTableRow({
  model,
  table,
  row,
  columns,
}: {
  model: HierarchicalTrackSelectorModel
  table: TrackTableModel
  row: TrackRow
  columns: TableColumn[]
}) {
  const { classes } = useTableStyles()
  return (
    <SelectableRow model={model} table={table} row={row}>
      {columns.map(col => (
        <td
          key={col.id}
          className={classes.bodyCell}
          title={coarseStripHTML(
            col.id === 'name' && row.description
              ? `${row.name}\n${row.description}`
              : getRowStr(col.id, row),
          )}
        >
          {col.cell(row)}
        </td>
      ))}
    </SelectableRow>
  )
})

export default TrackTableRow
