import { useState } from 'react'

import { Dialog, NumberTextField } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'

import TranscriptTable from './TranscriptTable.tsx'
import { collapseIntrons } from './util.ts'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
  const [windowSize, setWindowSize] = useState<number | undefined>(100)
  const validWindowSize = windowSize !== undefined

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
        <NumberTextField
          label="Number of bp around splice site to include"
          defaultValue={100}
          onValueChange={setWindowSize}
          min={0}
          errorText="Must be a non-negative number"
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
            padding={windowSize ?? 0}
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
          onClick={async () => {
            try {
              await collapseIntrons({
                view,
                transcripts,
                assembly,
                padding: windowSize ?? 0,
              })
              handleClose()
            } catch (e) {
              getSession(view).notifyError(`${e}`, e)
              console.error(e)
            }
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
