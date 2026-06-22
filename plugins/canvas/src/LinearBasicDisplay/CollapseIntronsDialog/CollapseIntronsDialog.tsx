import { useState } from 'react'

import { Dialog, NumberTextField } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'
import { isObservableArray } from 'mobx'
import { observer } from 'mobx-react'

import TranscriptTable from './TranscriptTable.tsx'
import { collapseIntrons, replaceIntrons, runIntronAction } from './util.ts'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const DEFAULT_WINDOW_SIZE = 100

const useStyles = makeStyles()({
  windowSizeField: {
    marginBottom: 16,
    width: 250,
  },
  showAllButton: {
    float: 'right',
  },
})

const CollapseIntronsDialog = observer(function CollapseIntronsDialog({
  view,
  transcripts,
  assembly,
  handleClose,
}: {
  view: LinearGenomeViewModel
  transcripts: Feature[]
  assembly: Assembly
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [showAll, setShowAll] = useState(false)
  const [windowSize, setWindowSize] = useState<number | undefined>(
    DEFAULT_WINDOW_SIZE,
  )
  const validWindowSize = windowSize !== undefined
  const canLaunchView = isObservableArray(getSession(view).views)

  return (
    <Dialog
      open
      maxWidth="md"
      onClose={() => {
        handleClose()
      }}
      title="Select transcript to collapse"
    >
      <DialogContent>
        <DialogContentText component="div">
          <p>
            Select the 'window size' which will be the extra space surrounding
            splice boundary to include. 10bp will only include a small 10bp
            region around splice boundary
          </p>
          <p>
            By default the union of exons from all transcripts will be used. To
            use a specific transcript, click "Show all transcripts" and then
            "Replace" (or "Launch") on the desired row.
          </p>
        </DialogContentText>
        <NumberTextField
          label="Number of bp around splice site to include"
          defaultValue={DEFAULT_WINDOW_SIZE}
          onValueChange={setWindowSize}
          min={0}
          errorText="Must be a non-negative number"
          className={classes.windowSizeField}
        />
        {transcripts.length > 1 ? (
          <Button
            className={classes.showAllButton}
            onClick={() => {
              setShowAll(s => !s)
            }}
          >
            {!showAll ? 'Show' : 'Hide'} all transcripts ({transcripts.length})
          </Button>
        ) : null}
        {showAll ? (
          <TranscriptTable
            transcripts={transcripts}
            view={view}
            assembly={assembly}
            windowSize={windowSize}
            canLaunchView={canLaunchView}
            handleClose={handleClose}
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          size="small"
          variant="contained"
          color="primary"
          disabled={!validWindowSize}
          onClick={() => {
            if (windowSize !== undefined) {
              void runIntronAction(
                view,
                () => {
                  replaceIntrons({
                    view,
                    transcripts,
                    assembly,
                    padding: windowSize,
                  })
                },
                handleClose,
              )
            }
          }}
        >
          Replace current view
        </Button>
        {canLaunchView ? (
          <Button
            size="small"
            variant="contained"
            color="primary"
            disabled={!validWindowSize}
            onClick={() => {
              if (windowSize !== undefined) {
                void runIntronAction(
                  view,
                  () =>
                    collapseIntrons({
                      view,
                      transcripts,
                      assembly,
                      padding: windowSize,
                    }),
                  handleClose,
                )
              }
            }}
          >
            Open in new view
          </Button>
        ) : null}
        <Button
          onClick={() => {
            handleClose()
          }}
          variant="contained"
          color="secondary"
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default CollapseIntronsDialog
