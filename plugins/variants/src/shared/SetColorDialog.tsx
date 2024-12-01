import React, { useState } from 'react'

import { useLocalStorage } from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { set1 } from '@jbrowse/core/ui/colors'

import DraggableDialog from './DraggableDialog'
import SourcesGrid from './SourcesGrid'

import { randomColor, type Source } from '../util'

const useStyles = makeStyles()({
  content: {
    minWidth: 800,
  },
  fr: {
    float: 'right',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

interface ReducedModel {
  sources?: Source[]
  setLayout: (s: Source[]) => void
  clearLayout: () => void
}

export default function SetColorDialog({
  model,
  handleClose,
}: {
  model: ReducedModel
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const { sources } = model
  const [showBulkEditor, setShowBulkEditor] = useState(false)
  const [currLayout, setCurrLayout] = useState(sources || [])
  const [showTips, setShowTips] = useLocalStorage(
    'multivariant-showTips',
    false,
  )
  return (
    <DraggableDialog
      open
      onClose={handleClose}
      maxWidth="xl"
      title="Multi-variant color/arrangement editor"
    >
      <DialogContent className={classes.content}>
        <div className={classes.fr}>
          <Button
            variant="contained"
            onClick={() => {
              setShowTips(!showTips)
            }}
          >
            {showTips ? 'Hide tips' : 'Show tips'}
          </Button>
          <Button
            color="secondary"
            variant="contained"
            onClick={() => {
              setShowBulkEditor(!showBulkEditor)
            }}
          >
            {showBulkEditor ? 'Hide bulk row editor' : 'Show Bulk row editor'}
          </Button>
        </div>
        <br />
        {showTips ? <HelpfulTips /> : null}

        {showBulkEditor ? (
          <BulkEditPanel
            currLayout={currLayout}
            setCurrLayout={setCurrLayout}
          />
        ) : null}
        <RowPalletizer currLayout={currLayout} setCurrLayout={setCurrLayout} />

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

function RowPalletizer({
  setCurrLayout,
  currLayout,
}: {
  currLayout: Source[]
  setCurrLayout: (arg: Source[]) => void
}) {
  return (
    <div>
      {Object.keys(currLayout[0] ?? [])
        .filter(f => f !== 'name' && f !== 'color')
        .map(r => {
          return (
            <Button
              key={r}
              onClick={() => {
                const map = new Map<string, number>()
                for (const row of currLayout) {
                  const val = map.get(row[r] as string)
                  if (!val) {
                    map.set(row[r] as string, 1)
                  } else {
                    map.set(row[r] as string, val + 1)
                  }
                }
                const ret = Object.fromEntries(
                  [...map.entries()]
                    .sort((a, b) => a[1] - b[1])
                    .map((r, idx) => [r[0], set1[idx] || randomColor()]),
                )
                console.log([...map.entries()], ret, r)

                setCurrLayout(
                  currLayout.map(row => ({
                    ...row,
                    color: ret[row[r] as string],
                  })),
                )
              }}
            >
              Palettize {r}
            </Button>
          )
        })}
    </div>
  )
}

function BulkEditPanel({
  setCurrLayout,
  currLayout,
}: {
  currLayout: Source[]
  setCurrLayout: (arg: Source[]) => void
}) {
  const { classes } = useStyles()
  const [val, setVal] = useState('')
  return (
    <div>
      <Typography>
        Paste CSV or TSV. If a header column is present. First line is a header.
        If a column called "name" is present, it uses that to connect to IDs in
        the table, otherwise it uses the first column no.
      </Typography>
      <TextField
        variant="outlined"
        multiline
        minRows={5}
        placeholder={
          'name,population\nHG00098,GBR\nHG00101,GBR\nHG00459,CHS\n...'
        }
        maxRows={10}
        fullWidth
        value={val}
        onChange={event => setVal(event.target.value)}
        slotProps={{
          input: {
            classes: {
              input: classes.textAreaFont,
            },
          },
        }}
      />
      <Button
        variant="contained"
        onClick={() => {
          const lines = val.split('\n')
          const fields = lines[0]!.split(/[,\t]/gm)
          const newData = Object.fromEntries(
            lines.slice(1).map(line => {
              const cols = line.split(/[,\t]/gm)
              const record = Object.fromEntries(
                cols.map((col, idx) => [fields[idx], col]),
              )
              return [record.name || cols[0], record]
            }),
          )

          setCurrLayout(
            currLayout.map(record => ({
              ...record,
              ...newData[record.name],
            })),
          )
        }}
      >
        Update rows
      </Button>
    </div>
  )
}

function HelpfulTips() {
  return (
    <>
      Helpful tips
      <ul>
        <li>You can select rows in the table with the checkboxes</li>
        <li>Multi-select is enabled with shift-click and control-click</li>
        <li>The "Move selected items up/down" can re-arrange subtracks</li>
        <li>Sorting the data grid itself can also re-arrange subtracks</li>
        <li>Changes are applied when you hit Submit</li>
        <li>You can click and drag the dialog box to move it on the screen</li>
        <li>
          Columns in the table can be hidden using a vertical '...' menu on the
          right side of each column
        </li>
      </ul>
    </>
  )
}
