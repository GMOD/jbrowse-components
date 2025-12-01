import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  TextField,
} from '@mui/material'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import { navToSynteny } from './util'

import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  padding: {
    margin: 10,
    border: '1px solid #ccc',
  },
})

export default function LaunchSyntenyViewDialog({
  session,
  view,
  feature,
  trackId,
  handleClose,
}: {
  session: AbstractSessionModel
  view?: LinearGenomeViewModel
  feature: Feature
  trackId: string
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const inverted = feature.get('strand') === -1
  const hasCIGAR = !!feature.get('CIGAR')
  const [horizontallyFlip, setHorizontallyFlip] = useState(inverted)
  const [windowSize, setWindowSize] = useState('1000')
  const [useRegionOfInterest, setUseRegionOfInterest] = useState(true)
  return (
    <Dialog open title="Launch synteny view" onClose={handleClose}>
      <DialogContent>
        {view && hasCIGAR ? (
          <FormControlLabel
            className={classes.padding}
            control={
              <Checkbox
                checked={useRegionOfInterest}
                onChange={event => {
                  setUseRegionOfInterest(event.target.checked)
                }}
              />
            }
            label="Use CIGAR string to navigate the current visible to the target"
          />
        ) : null}
        {inverted ? (
          <FormControlLabel
            className={classes.padding}
            control={
              <Checkbox
                checked={horizontallyFlip}
                onChange={event => {
                  setHorizontallyFlip(event.target.checked)
                }}
              />
            }
            label="Note: The feature is inverted in orientation on the target
            sequence. This will result in the lower panel having genomic
            coordinates decreasing left to right. Horizontally flip?"
          />
        ) : null}
        <TextField
          label="Add window size in bp"
          value={windowSize}
          onChange={event => {
            setWindowSize(event.target.value)
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ;(async () => {
              try {
                await navToSynteny({
                  feature,
                  windowSize: +windowSize,
                  horizontallyFlip,
                  trackId,
                  session,
                  region: useRegionOfInterest
                    ? view?.dynamicBlocks.contentBlocks[0]
                    : undefined,
                })
              } catch (e) {
                console.error(e)
                session.notifyError(`${e}`, e)
              }
            })()
            handleClose()
          }}
        >
          Submit
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            handleClose()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
