import { useState } from 'react'

import { resolveSelectedIds } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Checkbox, FormControlLabel } from '@mui/material'
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
  // The effective color a row renders with when its own value is unset (e.g.
  // MAF/wiggle label text defaults to black). Shown in the swatch — with an
  // "auto" affordance — so the grid reflects what's actually on screen instead
  // of a misleading placeholder. Never persisted on Submit.
  defaultColor?: string
  // Secondary columns (e.g. wiggle's label color) most users never touch. When
  // true the column and its bulk button are hidden behind a "Show …" toggle so
  // the common case is a single-color grid.
  advanced?: boolean
}

// Permanently empty: the grid's sort is controlled externally via
// onSortModelChange (see useSourceSort), so MUI's own model stays unset.
const EMPTY_SORT_MODEL: GridSortModel = []

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
  const [showAdvanced, setShowAdvanced] = useState(false)
  const onSortModelChange = useSourceSort(rows, onChange)

  // Hidden columns still reserve their field so they never leak into `extras`.
  const reserved = new Set<string>([
    ...IDENTITY_FIELDS,
    ...colorColumns.map(c => c.field),
    ...(reservedExtra ?? []),
  ])
  const extras = extraColumns(rows, reserved)

  const advancedColumns = colorColumns.filter(c => c.advanced)
  const visibleColorColumns = showAdvanced
    ? colorColumns
    : colorColumns.filter(c => !c.advanced)
  const advancedToggleLabel =
    advancedColumns.length === 1
      ? `Show ${advancedColumns[0]!.headerName.toLowerCase()}`
      : 'Show advanced color options'

  return (
    <div>
      <BulkColorControls
        colorColumns={visibleColorColumns}
        rows={rows}
        selected={selected}
        onChange={onChange}
      />
      {advancedColumns.length > 0 ? (
        <FormControlLabel
          control={
            <Checkbox
              checked={showAdvanced}
              onChange={() => {
                setShowAdvanced(!showAdvanced)
              }}
            />
          }
          label={advancedToggleLabel}
        />
      ) : null}
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
            colorColumns: visibleColorColumns,
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
