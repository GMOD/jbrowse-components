import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Checkbox, FormControlLabel } from '@mui/material'

import { launchSyntenyViewForFeatures } from './buildSyntenyViewSpec.ts'

import type { RegionOfInterest } from './buildSyntenyViewSpec.ts'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'

const DEFAULT_WINDOW_SIZE = 1000

const useStyles = makeStyles()({
  formControl: {
    margin: 10,
    border: '1px solid #ccc',
  },
})

// The pairwise launch: one clicked alignment, one target panel. Launching every
// assembly a locus aligns to is the region-anchored flow instead — see
// LaunchSyntenyViewForRegionDialog, reached from the rubberband — because that
// one is about a locus rather than about the alignment under the cursor.
export default function LaunchSyntenyViewDialog({
  session,
  region,
  feature,
  anchorAssembly,
  trackId,
  handleClose,
}: {
  session: AbstractSessionModel
  region?: RegionOfInterest
  feature: Feature
  anchorAssembly: string
  trackId: string
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const inverted = feature.get('strand') === -1
  const hasCIGAR = !!feature.get('CIGAR')
  const [flipReversedMates, setFlipReversedMates] = useState(inverted)
  const [windowSize, setWindowSize] = useState<number | undefined>(
    DEFAULT_WINDOW_SIZE,
  )
  const [useRegionOfInterest, setUseRegionOfInterest] = useState(true)
  return (
    <SubmitDialog
      open
      title="Launch synteny view"
      submitDisabled={windowSize === undefined}
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        if (windowSize !== undefined) {
          launchSyntenyViewForFeatures({
            features: [feature],
            anchorAssembly,
            windowSize,
            flipReversedMates,
            trackId,
            session,
            region: useRegionOfInterest ? region : undefined,
          })
          handleClose()
        }
      }}
    >
      {region && hasCIGAR ? (
        <FormControlLabel
          className={classes.formControl}
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
          className={classes.formControl}
          control={
            <Checkbox
              checked={flipReversedMates}
              onChange={event => {
                setFlipReversedMates(event.target.checked)
              }}
            />
          }
          label="Horizontally flip targets that are inverted (without flipping, an inverted panel's coordinates decrease left to right)"
        />
      ) : null}
      <NumberTextField
        label="Add window size in bp"
        defaultValue={DEFAULT_WINDOW_SIZE}
        onValueChange={val => {
          setWindowSize(val)
        }}
        min={0}
        errorText="Must be a non-negative number"
      />
    </SubmitDialog>
  )
}
