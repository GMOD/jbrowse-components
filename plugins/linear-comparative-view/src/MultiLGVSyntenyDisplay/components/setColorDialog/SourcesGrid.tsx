import { useState } from 'react'

import { SanitizedHTML } from '@jbrowse/core/ui'
import ColorPicker, { ColorPopover } from '@jbrowse/core/ui/ColorPicker'
import { getStr, measureGridWidth } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown'
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp'
import { Button } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'

import { moveDown, moveUp } from './moveUtils.ts'

import type { Source } from './types.ts'
import type { GridColDef, GridRowId } from '@mui/x-data-grid'

const useStyles = makeStyles()({
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
})

interface SortField {
  idx: number
  field: string | null
}

function SourcesGrid({
  rows,
  onChange,
  showTips,
}: {
  rows: Source[]
  onChange: (arg: Source[]) => void
  showTips: boolean
}) {
  const { classes } = useStyles()
  const [colorAnchorEl, setColorAnchorEl] = useState<HTMLElement | null>(null)
  const [selected, setSelected] = useState([] as GridRowId[])
  const {
    name: _name,
    color: _color,
    label: _label,
    ...rest
  } = rows.length > 0 ? rows[0]! : ({} as Source)
  const [widgetColor, setWidgetColor] = useState('blue')
  const [currSort, setCurrSort] = useState<SortField>({
    idx: 0,
    field: null,
  })

  return (
    <div>
      <Button
        disabled={!selected.length}
        onClick={event => {
          setColorAnchorEl(event.currentTarget)
        }}
      >
        Change color of selected
      </Button>
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
      <ColorPopover
        anchorEl={colorAnchorEl}
        color={widgetColor}
        onChange={c => {
          setWidgetColor(c)
          for (const id of selected) {
            const elt = rows.find(f => f.name === id)
            if (elt) {
              elt.color = c
            }
          }
          onChange([...rows])
        }}
        onClose={() => {
          setColorAnchorEl(null)
        }}
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
          columns={[
            {
              field: 'color',
              headerName: 'Color',
              width: 80,
              renderCell: ({ value, id }) => (
                <ColorPicker
                  color={(value as string | undefined) || 'blue'}
                  onChange={c => {
                    const elt = rows.find(f => f.name === id)
                    if (elt) {
                      elt.color = c
                    }
                    onChange([...rows])
                  }}
                />
              ),
            },
            {
              field: 'name',
              headerName: 'Name',
              width: measureGridWidth(rows.map(r => r.name)),
            },
            {
              field: 'label',
              headerName: 'Label (display name)',
              width: Math.max(
                160,
                measureGridWidth(rows.map(r => r.label ?? '')),
              ),
              editable: true,
              renderCell: ({ value }) => (
                <div className={classes.cell}>{getStr(value) || ''}</div>
              ),
            },
            ...Object.keys(rest).map(
              val =>
                ({
                  field: val,
                  renderCell: ({ value }) => (
                    <div className={classes.cell}>
                      <SanitizedHTML html={getStr(value)} />
                    </div>
                  ),
                  width: measureGridWidth(rows.map(r => `${r[val]}`)),
                }) satisfies GridColDef<(typeof rows)[0]>,
            ),
          ]}
          processRowUpdate={(newRow, oldRow) => {
            const elt = rows.find(f => f.name === oldRow.name)
            if (elt) {
              const label = newRow.label ?? ''
              elt.label = label === '' ? undefined : label
            }
            onChange([...rows])
            return newRow
          }}
          sortModel={[]}
          onSortModelChange={args => {
            const sort = args[0]
            const idx = (currSort.idx + 1) % 2
            const field = sort?.field ?? currSort.field
            setCurrSort({ idx, field })
            onChange(
              field
                ? [...rows].sort((a, b) => {
                    const aa = getStr(a[field])
                    const bb = getStr(b[field])
                    return idx === 1
                      ? aa.localeCompare(bb)
                      : bb.localeCompare(aa)
                  })
                : rows,
            )
          }}
        />
      </div>
    </div>
  )
}

export default SourcesGrid
