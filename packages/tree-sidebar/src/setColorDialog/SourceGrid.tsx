import { useState } from 'react'

import { resolveSelectedIds } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import { extraColumns } from '../sourcesGridUtils.ts'
import BulkColorControls from './BulkColorControls.tsx'
import SelectionMoveButtons from './SelectionMoveButtons.tsx'
import { buildSourceColumns } from './buildSourceColumns.tsx'
import { useSourceSort } from './useSourceSort.ts'

import type { GridRowId, GridSortModel } from '@mui/x-data-grid'

const useStyles = makeStyles()({
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
})

// Permanently empty: the grid's sort is controlled externally via
// onSortModelChange (see useSourceSort), so MUI's own model stays unset.
const EMPTY_SORT_MODEL: GridSortModel = []

export default observer(function SourceGrid<
  S extends { name: string; rowColor?: string },
>({
  rows,
  onChange,
  editsColor,
  swatchOf,
  reserved,
}: {
  rows: S[]
  onChange: (arg: S[]) => void
  // Whether each row's `rowColor` shows as an editable swatch, while the
  // rows are coloured each their own.
  editsColor: boolean
  // The color each row takes from an attribute, shown and not edited.
  swatchOf?: (row: S) => string | undefined
  // Fields that drive their own dedicated column or are plumbing, so they must
  // not appear in the auto-derived extras.
  reserved: ReadonlySet<string>
}) {
  const { classes } = useStyles()
  const [selected, setSelected] = useState<GridRowId[]>([])
  const onSortModelChange = useSourceSort(rows, onChange)
  const extras = extraColumns(rows, reserved)

  return (
    <div>
      <BulkColorControls
        editsColor={editsColor}
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
            editsColor,
            swatchOf,
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
