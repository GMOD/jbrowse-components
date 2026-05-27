import { useState } from 'react'

import { SanitizedHTML } from '@jbrowse/core/ui'
import { ColorPopover } from '@jbrowse/core/ui/ColorPicker'
import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'
import { getStr, measureGridWidth } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown'
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp'
import { Button } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'

import {
  extraColumns,
  moveDown,
  moveUp,
  updateRows,
} from '../sourcesGridUtils.ts'

import type { GridColDef, GridRowId } from '@mui/x-data-grid'

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

interface SortField {
  idx: number
  field: string | null
}

const ALWAYS_RESERVED = ['name', 'source', 'baseUri']

export default function SourceGrid<
  S extends { name: string; color?: string },
>({
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
  const [currSort, setCurrSort] = useState<SortField>({ idx: 0, field: null })
  // One anchor + widget color per color column, keyed by field.
  const [anchorByField, setAnchorByField] = useState<
    Record<string, HTMLElement | null>
  >({})
  const [widgetColorByField, setWidgetColorByField] = useState<
    Record<string, string>
  >({})

  const reserved = new Set<string>([
    ...ALWAYS_RESERVED,
    ...colorColumns.map(c => c.field),
    ...(reservedExtra ?? []),
  ])
  const extras = extraColumns(rows, reserved)

  return (
    <div>
      {colorColumns.map(c => (
        <Button
          key={`bulk-${c.field}`}
          disabled={!selected.length}
          onClick={event => {
            setAnchorByField(prev => ({
              ...prev,
              [c.field]: event.currentTarget,
            }))
          }}
        >
          {c.bulkLabel ?? `Change ${c.headerName.toLowerCase()} of selected`}
        </Button>
      ))}
      <Button
        disabled={!selected.length}
        onClick={() => {
          onChange(moveUp([...rows], selected))
        }}
      >
        <KeyboardArrowUpIcon />
        {showTips ? 'Move selected items up' : null}
      </Button>
      <Button
        disabled={!selected.length}
        onClick={() => {
          onChange(moveDown([...rows], selected))
        }}
      >
        <KeyboardArrowDownIcon />
        {showTips ? 'Move selected items down' : null}
      </Button>
      <Button
        disabled={!selected.length}
        onClick={() => {
          onChange(moveUp([...rows], selected, rows.length))
        }}
      >
        <KeyboardDoubleArrowUpIcon />
        {showTips ? 'Move selected items to top' : null}
      </Button>
      <Button
        disabled={!selected.length}
        onClick={() => {
          onChange(moveDown([...rows], selected, rows.length))
        }}
      >
        <KeyboardDoubleArrowDownIcon />
        {showTips ? 'Move selected items to bottom' : null}
      </Button>
      {colorColumns.map(c => (
        <ColorPopover
          key={`popover-${c.field}`}
          anchorEl={anchorByField[c.field] ?? null}
          color={widgetColorByField[c.field] ?? 'blue'}
          onChange={value => {
            setWidgetColorByField(prev => ({ ...prev, [c.field]: value }))
            onChange(
              updateRows(rows, selected, { [c.field]: value } as Partial<S>),
            )
          }}
          onClose={() => {
            setAnchorByField(prev => ({ ...prev, [c.field]: null }))
          }}
        />
      ))}
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
          columns={[
            ...colorColumns.map(
              c =>
                ({
                  field: c.field,
                  headerName: c.headerName,
                  width: 100,
                  renderCell: ({ value, id }) => (
                    <PopoverPicker
                      color={value || 'blue'}
                      onChange={color => {
                        onChange(
                          updateRows(rows, [id], {
                            [c.field]: color,
                          } as Partial<S>),
                        )
                      }}
                    />
                  ),
                }) satisfies GridColDef<S>,
            ),
            {
              field: 'name',
              headerName: 'Name',
              width: measureGridWidth(rows.map(r => r.name)),
            },
            ...extras.map(
              field =>
                ({
                  field,
                  renderCell: ({ value }) => (
                    <div className={classes.cell}>
                      <SanitizedHTML html={getStr(value)} />
                    </div>
                  ),
                  width: measureGridWidth(
                    rows.map(
                      r => `${(r as Record<string, unknown>)[field] ?? ''}`,
                    ),
                  ),
                }) satisfies GridColDef<S>,
            ),
          ]}
          sortModel={
            [
              /* controlled via onSortModelChange so we can flip-flop direction */
            ]
          }
          onSortModelChange={args => {
            const sort = args[0]
            const idx = (currSort.idx + 1) % 2
            const field = sort?.field ?? currSort.field
            setCurrSort({ idx, field })
            if (!field) {
              onChange(rows)
              return
            }
            onChange(
              [...rows].sort((a, b) => {
                const aa = getStr((a as Record<string, unknown>)[field])
                const bb = getStr((b as Record<string, unknown>)[field])
                return idx === 1
                  ? aa.localeCompare(bb)
                  : bb.localeCompare(aa)
              }),
            )
          }}
        />
      </div>
    </div>
  )
}
