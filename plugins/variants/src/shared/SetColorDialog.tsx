import { useState } from 'react'

import DraggableDialog from '@jbrowse/core/ui/DraggableDialog'
import { useLocalStorage } from '@jbrowse/core/util'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import SourcesGrid from './SourcesGrid'
import { type Source } from '../util'
import BulkEditPanel from './BulkEditPanel'
import RowPalettizer from './RowPalettizer'

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
        <RowPalettizer currLayout={currLayout} setCurrLayout={setCurrLayout} />

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
