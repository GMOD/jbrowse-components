import { useState } from 'react'

import { resolveSelectedIds } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'

import BulkColorControls from './BulkColorControls.tsx'
import SelectionMoveButtons from './SelectionMoveButtons.tsx'
import { buildSourceColumns } from './buildSourceColumns.tsx'
import { useSourceSort } from './useSourceSort.ts'
import { IDENTITY_FIELDS, extraColumns } from '../sourcesGridUtils.ts'

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

export default function SourceGrid<S extends { name: string; color?: string }>({
  rows,
  onChange,
  colorColumns,
  defaultColorField,
  reservedExtra,
}: {
  rows: S[]
  onChange: (arg: S[]) => void
  // PopoverPicker columns. Always includes at least `{ field: 'color' }`. When
  // more than one is given, a header toggle picks the single active column that
  // the swatches and bulk button edit (only one color field shown at a time).
  colorColumns: ColorColumn<S>[]
  // Which color column starts active; defaults to the first.
  defaultColorField?: keyof S & string
  // Additional column names the caller wants hidden from the extras list
  // (e.g. variants' `sampleName`, `HP`).
  reservedExtra?: ReadonlySet<string>
}) {
  const { classes } = useStyles()
  const [selected, setSelected] = useState<GridRowId[]>([])
  const [activeField, setActiveField] = useState(
    defaultColorField ?? colorColumns[0]?.field,
  )
  const onSortModelChange = useSourceSort(rows, onChange)

  // Every color field is reserved from `extras`, but only the active one shows
  // as an editable swatch column.
  const reserved = new Set<string>([
    ...IDENTITY_FIELDS,
    ...colorColumns.map(c => c.field),
    ...(reservedExtra ?? []),
  ])
  const extras = extraColumns(rows, reserved)

  const activeColumn =
    colorColumns.find(c => c.field === activeField) ?? colorColumns[0]
  const activeColumns = activeColumn ? [activeColumn] : []

  return (
    <div>
      {colorColumns.length > 1 ? (
        <ToggleButtonGroup
          exclusive
          size="small"
          value={activeColumn?.field}
          onChange={(_event, value) => {
            if (value) {
              setActiveField(value)
            }
          }}
        >
          {colorColumns.map(c => (
            <ToggleButton key={c.field} value={c.field}>
              {c.headerName}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      ) : null}
      <BulkColorControls
        colorColumns={activeColumns}
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
            colorColumns: activeColumns,
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
}
