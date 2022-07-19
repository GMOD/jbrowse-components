import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  IconButton,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { useLocalStorage } from '@jbrowse/core/util'
import { DataGrid, GridCellParams } from '@mui/x-data-grid'

// locals
import ColorPicker, { ColorPopover } from './ColorPicker'
import { moveUp, moveDown } from './util'
import { Source } from '../../util'

// icons
import CloseIcon from '@mui/icons-material/Close'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import ArrowDownward from '@mui/icons-material/ArrowDownward'

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  content: {
    minWidth: 800,
  },
}))

export default function SetColorDialog({
  model,
  handleClose,
}: {
  model: {
    color: number
    setColor: (arg?: string) => void
    setPosColor: (arg?: string) => void
    setNegColor: (arg?: string) => void
    sources: Source[]
    setLayout: (s: Source[]) => void
    clearLayout: () => void
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const { sources } = model
  const [currLayout, setCurrLayout] = useState(sources || [])
  const [showTips, setShowTips] = useLocalStorage(
    'multiwiggle-showTips',
    'true',
  )
  return (
    <Dialog open onClose={handleClose} maxWidth="xl">
      <DialogTitle>
        Multi-wiggle color/arrangement editor{' '}
        <IconButton className={classes.closeButton} onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent className={classes.content}>
        <Button
          variant="contained"
          style={{ float: 'right' }}
          onClick={() => setShowTips(showTips === 'true' ? 'false' : 'true')}
        >
          {showTips === 'true' ? 'Hide tips' : 'Show tips'}
        </Button>
        <br />
        {showTips === 'true' ? (
          <>
            Helpful tips
            <ul>
              <li>You can select rows in the table with the checkboxes</li>
              <li>Multi-select is enabled with shift-click</li>
              <li>
                The "Move selected items up/down" can re-arrange subtracks
              </li>
              <li>
                Sorting the data grid itself can also re-arrange subtracks
              </li>
              <li>Changes are applied when you hit Submit</li>
            </ul>
          </>
        ) : null}
        <SourcesGrid rows={currLayout} onChange={setCurrLayout} />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          type="submit"
          color="inherit"
          onClick={() => {
            model.clearLayout()
            setCurrLayout(model.sources)
          }}
        >
          Clear custom colors
        </Button>
        <Button
          variant="contained"
          color="secondary"
          type="submit"
          onClick={() => handleClose()}
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
    </Dialog>
  )
}

function SourcesGrid({
  rows,
  onChange,
}: {
  rows: Source[]
  onChange: (arg: Source[]) => void
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [selected, setSelected] = useState([] as string[])

  const entries = Object.fromEntries(rows.map(s => [s.name, s]))
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
              entries[id].color = c
              onChange(Object.values(entries))
            }}
          />
        )
      },
    },
    {
      field: 'name',
      headerName: 'Name',
      flex: 0.7,
    },
  ]

  // this helps keep track of the selection, even though it is not used
  // anywhere except inside the picker
  const [widgetColor, setWidgetColor] = useState('blue')

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
        <ArrowUpward />
        Move selected items up
      </Button>
      <Button
        onClick={() => onChange(moveDown([...rows], selected))}
        disabled={!selected.length}
      >
        <ArrowDownward />
        Move selected items down
      </Button>
      <ColorPopover
        anchorEl={anchorEl}
        color={widgetColor}
        onChange={c => {
          setWidgetColor(c)
          selected.forEach(s => {
            entries[s].color = c
          })
          onChange(Object.values(entries))
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
          onSortModelChange={args => {
            const sort = args[0]
            onChange(
              sort
                ? [...rows].sort((a, b) => {
                    // @ts-ignore
                    const aa = a[sort.field]
                    // @ts-ignore
                    const bb = b[sort.field]
                    return sort.sort === 'asc'
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
