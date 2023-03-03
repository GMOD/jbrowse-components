import React, { useState } from 'react'
import { Button, DialogContent, DialogActions } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import {
  getStr,
  isUriLocation,
  measureGridWidth,
  useLocalStorage,
} from '@jbrowse/core/util'
import { DataGrid, GridCellParams } from '@mui/x-data-grid'
import clone from 'clone'

// locals
import DraggableDialog from './DraggableDialog'
import ColorPicker, { ColorPopover } from '@jbrowse/core/ui/ColorPicker'
import { UriLink } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { moveUp, moveDown } from './util'
import { Source } from '../../util'

// icons
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp'
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'

const useStyles = makeStyles()({
  content: {
    minWidth: 800,
  },
})

export default function SetColorDialog({
  model,
  handleClose,
}: {
  model: {
    sources?: Source[]
    setLayout: (s: Source[]) => void
    clearLayout: () => void
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const { sources } = model
  const [currLayout, setCurrLayout] = useState(clone(sources || []))
  const [showTips, setShowTips] = useLocalStorage('multiwiggle-showTips', true)
  return (
    <DraggableDialog
      open
      onClose={handleClose}
      maxWidth="xl"
      title={'Multi-wiggle color/arrangement editor'}
    >
      <DialogContent className={classes.content}>
        <Button
          variant="contained"
          style={{ float: 'right' }}
          onClick={() => setShowTips(!showTips)}
        >
          {showTips ? 'Hide tips' : 'Show tips'}
        </Button>
        <br />
        {showTips ? (
          <>
            Helpful tips
            <ul>
              <li>You can select rows in the table with the checkboxes</li>
              <li>
                Multi-select is enabled with shift-click and control-click
              </li>
              <li>
                The "Move selected items up/down" can re-arrange subtracks
              </li>
              <li>
                Sorting the data grid itself can also re-arrange subtracks
              </li>
              <li>Changes are applied when you hit Submit</li>
              <li>
                You can click and drag the dialog box to move it on the screen
              </li>
              <li>
                Columns in the table can be hidden using a vertical '...' menu
                on the right side of each column
              </li>
            </ul>
          </>
        ) : null}
        <SourcesGrid
          rows={currLayout}
          onChange={setCurrLayout}
          showTips={showTips}
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          type="submit"
          color="inherit"
          onClick={() => {
            model.clearLayout()
            setCurrLayout(model.sources || [])
          }}
        >
          Clear custom settings
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            handleClose()
            setCurrLayout([...(model.sources || [])])
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          type="submit"
          onClick={() => {
            model.setLayout(currLayout)
            handleClose()
          }}
        >
          Submit
        </Button>
      </DialogActions>
    </DraggableDialog>
  )
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
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [selected, setSelected] = useState([] as string[])

  // @ts-expect-error
  const { name: _name, color: _color, baseUri: _baseUri, ...rest } = rows[0]

  // similar to BaseFeatureDetail data-grid for auto-measuring columns
  const columns = [
    {
      field: 'color',
      headerName: 'Color',
      renderCell: (params: GridCellParams) => {
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
      sortingOrder: [null],
      headerName: 'Name',
      width: measureGridWidth(rows.map(r => r.name)),
    },
    ...Object.keys(rest).map(val => ({
      field: val,
      sortingOrder: [null],
      renderCell: (params: GridCellParams) => {
        const { value } = params
        return isUriLocation(value) ? <UriLink value={value} /> : getStr(value)
      },
      // @ts-expect-error
      width: measureGridWidth(rows.map(r => r[val])),
    })),
  ]

  // this helps keep track of the selection, even though it is not used
  // anywhere except inside the picker
  const [widgetColor, setWidgetColor] = useState('blue')
  const [currSort, setCurrSort] = useState<{
    idx: number
    field: string | null
  }>({ idx: 0, field: null })

  return (
    <div>
      <Button
        disabled={!selected.length}
        onClick={event => setAnchorEl(event.currentTarget)}
      >
        Change color of selected items
      </Button>
      <Button
        onClick={() => onChange(moveUp([...rows], selected))}
        disabled={!selected.length}
      >
        <KeyboardArrowUpIcon />
        {showTips ? 'Move selected items up' : null}
      </Button>
      <Button
        onClick={() => onChange(moveDown([...rows], selected))}
        disabled={!selected.length}
      >
        <KeyboardArrowDownIcon />
        {showTips ? 'Move selected items down' : null}
      </Button>
      <Button
        onClick={() => onChange(moveUp([...rows], selected, rows.length))}
        disabled={!selected.length}
      >
        <KeyboardDoubleArrowUpIcon />
        {showTips ? 'Move selected items to top' : null}
      </Button>
      <Button
        onClick={() => onChange(moveDown([...rows], selected, rows.length))}
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
        onClose={() => setAnchorEl(null)}
      />
      <div style={{ height: 400, width: '100%' }}>
        <DataGrid
          getRowId={row => row.name}
          checkboxSelection
          disableSelectionOnClick
          onSelectionModelChange={arg => setSelected(arg as string[])}
          rows={rows}
          rowHeight={25}
          headerHeight={33}
          columns={columns}
          sortModel={
            [
              /* we control the sort as a controlled component using onSortModelChange */
            ]
          }
          onSortModelChange={args => {
            const sort = args[0]
            const idx = (currSort.idx + 1) % 2
            const field = sort?.field || currSort.field
            setCurrSort({ idx, field })
            onChange(
              field
                ? [...rows].sort((a, b) => {
                    // @ts-expect-error
                    const aa = getStr(a[field])
                    // @ts-expect-error
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
