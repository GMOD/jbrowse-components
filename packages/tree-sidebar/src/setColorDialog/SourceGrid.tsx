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

import type { EachRowPicks } from './buildSourceColumns.tsx'
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

export default observer(function SourceGrid<S extends { name: string }>({
  rows,
  onChange,
  colors,
  eachRow,
  reserved,
}: {
  rows: S[]
  onChange: (arg: S[]) => void
  // The colour each row shows, by name.
  colors: ReadonlyMap<string, string>
  // Under Each row, where a row's swatch is its pick.
  eachRow?: EachRowPicks
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
      {eachRow ? (
        <BulkColorControls selected={selected} onPick={eachRow.onPick} />
      ) : null}
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
            colors,
            eachRow,
            extras,
            rows,
            cellClassName: classes.cell,
          })}
          sortModel={EMPTY_SORT_MODEL}
          onSortModelChange={onSortModelChange}
        />
      </div>
    </div>
  )
})
