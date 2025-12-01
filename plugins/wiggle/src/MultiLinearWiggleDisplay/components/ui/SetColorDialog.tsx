import { useState } from 'react'

import DraggableDialog from '@jbrowse/core/ui/DraggableDialog'
import { useLocalStorage } from '@jbrowse/core/util'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import SetColorDialogBulkEditPanel from './SetColorDialogBulkEditPanel'
import SetColorDialogHelpfulTips from './SetColorDialogHelpfulTips'
import SetColorDialogRowPalettizer from './SetColorDialogRowPalettizer'

const useStyles = makeStyles()({
  content: {
    minWidth: 800,
  },
  fr: {
    float: 'right',
    display: 'flex',
    gap: 8,
  },
})

interface SetColorDialogProps {
  model: {
    sources?: {
      name: string
      [key: string]: unknown
    }[]
    setLayout: (s: { name: string; [key: string]: unknown }[]) => void
    clearLayout: () => void
  }
  handleClose: () => void
  title?: string
  enableBulkEdit?: boolean
  enableRowPalettizer?: boolean
  showTipsStorageKey?: string
  SourcesGridComponent: React.ComponentType<{
    rows: { name: string; [key: string]: unknown }[]
    onChange: (rows: { name: string; [key: string]: unknown }[]) => void
    showTips: boolean
  }>
}

export default function SetColorDialog({
  model,
  handleClose,
  title = 'Color/arrangement editor',
  enableBulkEdit = false,
  enableRowPalettizer = false,
  showTipsStorageKey = 'setColorDialog-showTips',
  SourcesGridComponent,
}: SetColorDialogProps) {
  const { classes } = useStyles()
  const { sources } = model
  const [showBulkEditor, setShowBulkEditor] = useState(false)
  const [currLayout, setCurrLayout] = useState(structuredClone(sources || []))
  const [showTips, setShowTips] = useLocalStorage(showTipsStorageKey, false)

  return (
    <DraggableDialog open onClose={handleClose} maxWidth="xl" title={title}>
      {showBulkEditor && enableBulkEdit ? (
        <SetColorDialogBulkEditPanel
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
              {enableBulkEdit ? (
                <Button
                  color="secondary"
                  variant="contained"
                  onClick={() => {
                    setShowBulkEditor(!showBulkEditor)
                  }}
                >
                  Show Bulk row editor
                </Button>
              ) : null}
            </div>

            {showTips ? <SetColorDialogHelpfulTips /> : null}
            {enableRowPalettizer ? (
              <>
                <br />
                <SetColorDialogRowPalettizer
                  currLayout={currLayout}
                  setCurrLayout={setCurrLayout}
                />
              </>
            ) : null}

            <SourcesGridComponent
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
