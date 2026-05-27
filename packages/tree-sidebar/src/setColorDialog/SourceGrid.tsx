import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { DataGrid } from '@mui/x-data-grid'

import BulkColorControls from './BulkColorControls.tsx'
import SelectionMoveButtons from './SelectionMoveButtons.tsx'
import { buildSourceColumns } from './buildSourceColumns.tsx'
import { useSourceSort } from './useSourceSort.ts'
import { extraColumns } from '../sourcesGridUtils.ts'

import type { GridRowId } from '@mui/x-data-grid'

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

const ALWAYS_RESERVED = ['name', 'source', 'baseUri']

export default function SourceGrid<S extends { name: string; color?: string }>({
  rows,
  onChange,
  showTips,
  colorColumns,
  reservedExtra,
}: {
  rows: S[]
  onChange: (arg: S[]) => void
  showTips: boolean
  // PopoverPicker columns. Always includes at least `{ field: 'color' }`.
  colorColumns: ColorColumn<S>[]
  // Additional column names the caller wants hidden from the extras list
  // (e.g. variants' `sampleName`, `HP`).
  reservedExtra?: ReadonlySet<string>
}) {
  const { classes } = useStyles()
  const [selected, setSelected] = useState([] as GridRowId[])
  const onSortModelChange = useSourceSort(rows, onChange)

  const reserved = new Set<string>([
    ...ALWAYS_RESERVED,
    ...colorColumns.map(c => c.field),
    ...(reservedExtra ?? []),
  ])
  const extras = extraColumns(rows, reserved)

  return (
    <div>
      <BulkColorControls
        colorColumns={colorColumns}
        rows={rows}
        selected={selected}
        onChange={onChange}
      />
      <SelectionMoveButtons
        rows={rows}
        selected={selected}
        onChange={onChange}
        showTips={showTips}
      />
      <div style={{ height: 400, width: '100%' }}>
        <DataGrid
          disableRowSelectionOnClick
          getRowId={row => row.name}
          checkboxSelection
          onRowSelectionModelChange={arg => {
            setSelected([...arg.ids])
          }}
          rows={rows}
          rowHeight={25}
          columnHeaderHeight={33}
          columns={buildSourceColumns({
            colorColumns,
            extras,
            rows,
            onChange,
            cellClassName: classes.cell,
          })}
          sortModel={
            [
              /* controlled via onSortModelChange so we can flip-flop direction */
            ]
          }
          onSortModelChange={onSortModelChange}
        />
      </div>
    </div>
  )
}
