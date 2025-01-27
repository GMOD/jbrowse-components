import { useState } from 'react'

import DraggableDialog from '@jbrowse/core/ui/DraggableDialog'
import { useLocalStorage } from '@jbrowse/core/util'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import BulkEditPanel from './BulkEditPanel'
import HelpfulTips from './HelpfulTips'
import RowPalettizer from './RowPalettizer'
import SourcesGrid from './SourcesGrid'

import type { Source } from '../types'

const useStyles = makeStyles()({
  content: {
    minWidth: 800,
  },
  fr: {
    float: 'right',
    display: 'flex',
    gap: 8,
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
      {showBulkEditor ? (
        <BulkEditPanel
          currLayout={currLayout}
          onClose={arg => {
            if (arg) {
              setCurrLayout(arg)
            }

            setShowBulkEditor(false)
          }}
        />
      ) : (
        <>
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
                Show Bulk row editor
              </Button>
            </div>

            {showTips ? <HelpfulTips /> : null}
            <br />
            <RowPalettizer
              currLayout={currLayout}
              setCurrLayout={setCurrLayout}
            />

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
        </>
      )}
    </DraggableDialog>
  )
}
