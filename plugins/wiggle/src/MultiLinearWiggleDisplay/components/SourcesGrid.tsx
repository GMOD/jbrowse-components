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

import { moveDown, moveUp } from './util.ts'

import type { Source } from '../../util.ts'
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
  const [labelColorAnchorEl, setLabelColorAnchorEl] =
    useState<HTMLElement | null>(null)
  const [selected, setSelected] = useState([] as GridRowId[])
  const {
    name: _name,
    color: _color,
    labelColor: _labelColor,
    source: _source,
    baseUri: _baseUri,
    ...rest
  } = rows.length > 0 ? rows[0]! : {}
  const [widgetColor, setWidgetColor] = useState('blue')
  const [widgetLabelColor, setWidgetLabelColor] = useState('blue')
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
        Change track color of selected
      </Button>
      <Button
        disabled={!selected.length}
        onClick={event => {
          setLabelColorAnchorEl(event.currentTarget)
        }}
      >
        Change label color of selected
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
      <ColorPopover
        anchorEl={labelColorAnchorEl}
        color={widgetLabelColor}
        onChange={c => {
          setWidgetLabelColor(c)
          for (const id of selected) {
            const elt = rows.find(f => f.name === id)
            if (elt) {
              elt.labelColor = c
            }
          }
          onChange([...rows])
        }}
        onClose={() => {
          setLabelColorAnchorEl(null)
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
              headerName: 'Track color',
              width: 100,
              renderCell: ({ value, id }) => (
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
              ),
            },
            {
              field: 'labelColor',
              headerName: 'Label color',
              width: 100,
              renderCell: ({ value, id }) => (
                <ColorPicker
                  color={value || ''}
                  onChange={c => {
                    const elt = rows.find(f => f.name === id)
                    if (elt) {
                      elt.labelColor = c
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
