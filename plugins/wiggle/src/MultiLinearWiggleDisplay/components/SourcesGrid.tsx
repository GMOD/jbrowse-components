import React, { useState } from 'react'
import { SanitizedHTML } from '@jbrowse/core/ui'
import ColorPicker, { ColorPopover } from '@jbrowse/core/ui/ColorPicker'
import { getStr, measureGridWidth } from '@jbrowse/core/util'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown'
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp'
import { Button } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { makeStyles } from 'tss-react/mui'

// locals
import { moveUp, moveDown } from './util'
import type { Source } from '../../util'
import type { GridColDef } from '@mui/x-data-grid'

// icons

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
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [selected, setSelected] = useState([] as string[])
  const { name: _name, color: _color, baseUri: _baseUri, ...rest } = rows[0]!
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
          setAnchorEl(event.currentTarget)
        }}
      >
        Change color of selected items
      </Button>
      <Button
        onClick={() => {
          onChange(moveUp([...rows], selected))
        }}
        disabled={!selected.length}
      >
        <KeyboardArrowUpIcon />
        {showTips ? 'Move selected items up' : null}
      </Button>
      <Button
        onClick={() => {
          onChange(moveDown([...rows], selected))
        }}
        disabled={!selected.length}
      >
        <KeyboardArrowDownIcon />
        {showTips ? 'Move selected items down' : null}
      </Button>
      <Button
        onClick={() => {
          onChange(moveUp([...rows], selected, rows.length))
        }}
        disabled={!selected.length}
      >
        <KeyboardDoubleArrowUpIcon />
        {showTips ? 'Move selected items to top' : null}
      </Button>
      <Button
        onClick={() => {
          onChange(moveDown([...rows], selected, rows.length))
        }}
        disabled={!selected.length}
      >
        <KeyboardDoubleArrowDownIcon />
        {showTips ? 'Move selected items to bottom' : null}
      </Button>
      <ColorPopover
        anchorEl={anchorEl}
        color={widgetColor}
        onChange={c => {
          setWidgetColor(c)
          selected.forEach(id => {
            const elt = rows.find(f => f.name === id)
            if (elt) {
              elt.color = c
            }
          })

          onChange([...rows])
        }}
        onClose={() => {
          setAnchorEl(null)
        }}
      />
      <div style={{ height: 400, width: '100%' }}>
        <DataGrid
          getRowId={row => row.name}
          checkboxSelection
          disableRowSelectionOnClick
          onRowSelectionModelChange={arg => {
            setSelected(arg as string[])
          }}
          rows={rows}
          rowHeight={25}
          columnHeaderHeight={33}
          columns={[
            {
              field: 'color',
              headerName: 'Color',
              renderCell: params => {
                const { value, id } = params
                return (
                  <ColorPicker
                    color={value || 'blue'}
                    onChange={c => {
                      const elt = rows.find(f => f.name === id)
                      if (elt) {
                        elt.color = c
                      }
                      onChange([...rows])
                    }}
                  />
                )
              },
            },
            {
              field: 'name',
              headerName: 'Name',
              width: measureGridWidth(rows.map(r => r.name)),
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
                  width: measureGridWidth(
                    rows.map(r => `${r[val as keyof Source]}`),
                  ),
                }) satisfies GridColDef<(typeof rows)[0]>,
            ),
          ]}
          sortModel={
            [
              /* we control the sort as a controlled component using onSortModelChange */
            ]
          }
          onSortModelChange={args => {
            const sort = args[0]
            // this idx%2 flip flops the sorting order, we could inspect args
            // for sort direction asc or desc but this is just a simplified
            // thing since we are controlling sort instead of the default data
            // grid sort anyways
            const idx = (currSort.idx + 1) % 2
            const field = sort!.field || currSort.field
            setCurrSort({ idx, field })
            onChange(
              field
                ? [...rows].sort((a, b) => {
                    const aa = getStr(a[field as keyof Source])
                    const bb = getStr(b[field as keyof Source])
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
