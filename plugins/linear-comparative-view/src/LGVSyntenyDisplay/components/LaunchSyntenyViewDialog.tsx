import { useState } from 'react'

import { Dialog, NumberTextField } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
} from '@mui/material'

import { navToSynteny } from './util.ts'

import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  padding: {
    margin: 10,
    border: '1px solid #ccc',
  },
})

export default function LaunchSyntenyViewDialog({
  session,
  visibleRegion,
  feature,
  trackId,
  handleClose,
}: {
  session: AbstractSessionModel
  visibleRegion?: { refName: string; start: number; end: number }
  feature: Feature
  trackId: string
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const inverted = feature.get('strand') === -1
  const hasCIGAR = !!feature.get('CIGAR')
  const [horizontallyFlip, setHorizontallyFlip] = useState(inverted)
  const [windowSize, setWindowSize] = useState<number | undefined>(1000)
  const [useRegionOfInterest, setUseRegionOfInterest] = useState(true)
  return (
    <Dialog
      open
      title="Launch synteny view"
      onClose={() => {
        handleClose()
      }}
    >
      <DialogContent>
        {visibleRegion && hasCIGAR ? (
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
            label="Use CIGAR to map the current visible region to the target"
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
            label="Horizontally flip target (feature is inverted on the target — without flipping, the lower panel's coordinates will decrease left to right)"
          />
        ) : null}
        <NumberTextField
          label="Add window size in bp"
          defaultValue={1000}
          onValueChange={setWindowSize}
          min={0}
          errorText="Must be a non-negative number"
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          disabled={windowSize === undefined}
          onClick={() => {
            if (windowSize !== undefined) {
              navToSynteny({
                feature,
                windowSize,
                horizontallyFlip,
                trackId,
                session,
                region: useRegionOfInterest ? visibleRegion : undefined,
              })
              handleClose()
            }
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
