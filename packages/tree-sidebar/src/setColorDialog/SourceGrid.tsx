import { useState } from 'react'

import { resolveSelectedIds } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import BulkColorControls from './BulkColorControls.tsx'
import SelectionMoveButtons from './SelectionMoveButtons.tsx'
import { buildSourceColumns } from './buildSourceColumns.tsx'
import { useSourceSort } from './useSourceSort.ts'
import { extraColumns } from '../sourcesGridUtils.ts'

import type { GridRowId, GridSortModel } from '@mui/x-data-grid'

const useStyles = makeStyles()({
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
})

// A PopoverPicker column. `name`, `source`, `baseUri` are always reserved;
// each color column field is also reserved (so it doesn't render twice).
export interface ColorColumn<S> {
  field: keyof S & string
  headerName: string
  // Label for the header "Change … of selected" button. Falls back to a
  // default constructed from headerName when omitted.
  bulkLabel?: string
}

// Permanently empty: the grid's sort is controlled externally via
// onSortModelChange (see useSourceSort), so MUI's own model stays unset.
const EMPTY_SORT_MODEL: GridSortModel = []

export default observer(function SourceGrid<
  S extends { name: string; color?: string },
>({
  rows,
  onChange,
  colorColumn,
  reserved,
}: {
  rows: S[]
  onChange: (arg: S[]) => void
  // The single color column shown as editable swatches. The dialog owns which
  // one is active (see SetColorDialog's toggle) so the palettizer paints the
  // same field the grid edits.
  colorColumn: ColorColumn<S> | undefined
  // Fields that drive their own dedicated column or are plumbing, so they must
  // not appear in the auto-derived extras. Includes every color field, not just
  // the active one — an inactive color column would otherwise render as a raw
  // hex text column.
  reserved: ReadonlySet<string>
}) {
  const { classes } = useStyles()
  const [selected, setSelected] = useState<GridRowId[]>([])
  const onSortModelChange = useSourceSort(rows, onChange)
  const extras = extraColumns(rows, reserved)

  return (
    <div>
      <BulkColorControls
        colorColumn={colorColumn}
        rows={rows}
        selected={selected}
        onChange={onChange}
      />
      <SelectionMoveButtons
        rows={rows}
        selected={selected}
        onChange={onChange}
      />
      <div style={{ height: 400, width: '100%' }}>
        <DataGrid
          disableRowSelectionOnClick
          getRowId={row => row.name}
          checkboxSelection
          onRowSelectionModelChange={arg => {
            setSelected([
              ...resolveSelectedIds(
                arg,
                rows.map(r => r.name),
              ),
            ])
          }}
          rows={rows}
          rowHeight={25}
          columnHeaderHeight={33}
          columns={buildSourceColumns({
            colorColumn,
            extras,
            rows,
            onChange,
            cellClassName: classes.cell,
          })}
          sortModel={EMPTY_SORT_MODEL}
          onSortModelChange={onSortModelChange}
        />
      </div>
    </div>
  )
})
