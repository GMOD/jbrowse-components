import { useState } from 'react'

import { Dialog, NumberTextField } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControlLabel,
} from '@mui/material'
import { isObservableArray } from 'mobx'
import { observer } from 'mobx-react'

import IntronActionButtons from './IntronActionButtons.tsx'
import TranscriptTable from './TranscriptTable.tsx'

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
  // default to flipping for a minus-strand gene so it reads 5'->3'
  const [flip, setFlip] = useState(transcripts[0]?.get('strand') === -1)
  const [windowSize, setWindowSize] = useState<number | undefined>(
    DEFAULT_WINDOW_SIZE,
  )
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
            Select the 'window size', the amount of extra space to include
            around each splice boundary. The default of {DEFAULT_WINDOW_SIZE}bp
            shows
            {DEFAULT_WINDOW_SIZE}bp of context on either side of every exon; 0
            shows only the exons themselves.
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
        <FormControlLabel
          control={
            <Checkbox
              checked={flip}
              onChange={event => {
                setFlip(event.target.checked)
              }}
            />
          }
          label="Reverse region order (read minus-strand gene 5'→3')"
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
            flip={flip}
            canLaunchView={canLaunchView}
            handleClose={handleClose}
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <IntronActionButtons
          view={view}
          transcripts={transcripts}
          assembly={assembly}
          windowSize={windowSize}
          flip={flip}
          canLaunchView={canLaunchView}
          handleClose={handleClose}
        />
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
