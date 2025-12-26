import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  TextField,
} from '@mui/material'

import TranscriptTable from './TranscriptTable'
import { collapseIntrons } from './util'

import type { LinearGenomeViewModel } from '../../../LinearGenomeView'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'

export default function CollapseIntronsDialog({
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
  const [showAll, setShowAll] = useState(false)
  const [windowSize, setWindowSize] = useState('100')
  const windowSizeNum = +windowSize
  const validWindowSize = !Number.isNaN(windowSizeNum) && windowSizeNum >= 0

  return (
    <Dialog
      open
      maxWidth="md"
      onClose={handleClose}
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
            By default the union of exons from all transcripts will be used to
            create the collapsed intron view, but you can optionally use the
            exons of only a specific transcript by clicking "Show all
            transcripts" and then "Select"
          </p>
        </DialogContentText>
        <TextField
          label="Number of bp around splice site to include"
          value={windowSize}
          onChange={event => {
            setWindowSize(event.target.value)
          }}
          error={windowSize !== '' && !validWindowSize}
          helperText={
            windowSize !== '' && !validWindowSize
              ? 'Must be a non-negative number'
              : ''
          }
          type="number"
          slotProps={{
            htmlInput: {
              min: 0,
              step: 10,
            },
          }}
          style={{ marginBottom: 16, width: 250 }}
        />
        <Button
          style={{ float: 'right' }}
          onClick={() => {
            setShowAll(s => !s)
          }}
        >
          {!showAll ? 'Show' : 'Hide'} all transcripts ({transcripts.length})
        </Button>
        {showAll ? (
          <TranscriptTable
            transcripts={transcripts}
            view={view}
            assembly={assembly}
            padding={windowSizeNum}
            validPadding={validWindowSize}
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
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ;(async () => {
              try {
                await collapseIntrons({
                  view,
                  transcripts,
                  assembly,
                  padding: windowSizeNum,
                })
                handleClose()
              } catch (e) {
                getSession(view).notifyError(`${e}`, e)
                console.error(e)
              }
            })()
          }}
        >
          Submit
        </Button>
        <Button onClick={handleClose} variant="contained" color="secondary">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
