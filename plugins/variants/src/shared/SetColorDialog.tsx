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

// locals
import DraggableDialog from './DraggableDialog'
import SourcesGrid from './SourcesGrid'

import type { Source } from '../util'

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
  const [bulkEdit, setBulkEdit] = useState(false)
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
              setBulkEdit(true)
            }}
          >
            Bulk edit rows
          </Button>
        </div>
        <br />
        {showTips ? <HelpfulTips /> : null}

        {bulkEdit ? (
          <BulkEditPanel
            currLayout={currLayout}
            setCurrLayout={setCurrLayout}
          />
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
        Paste csv or tab separated text with a header line like "sample
        population color". If the header contains a tab, assumed to be tsv,
        otherwise csv. Then rows corresponding to all the samples below. Sample
        column required, any other column names can be custom
      </Typography>
      <TextField
        variant="outlined"
        multiline
        minRows={5}
        placeholder={
          'Paste csv or tab separated text with a header line like "name population color". Name column required, any other column names can be custom'
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
        onClick={() => {
          const lines = val.split('\n')
          const fields = lines[0]!.split(/[,\t]/gm)
          const newData = Object.fromEntries(
            lines.slice(1).map(line => {
              const record = Object.fromEntries(
                line.split(/[,\t]/gm).map((col, idx) => [fields[idx], col]),
              )
              return [record.name, record]
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
