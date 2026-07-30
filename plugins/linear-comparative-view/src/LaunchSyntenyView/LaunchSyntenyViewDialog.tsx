import { useState } from 'react'

import { LabeledCheckbox, SubmitDialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import { launchSyntenyViewForFeatures } from './buildSyntenyViewSpec.ts'
import {
  DEFAULT_WINDOW_SIZE,
  FlipInvertedTargetsCheckbox,
  WindowSizeField,
} from './launchOptionFields.tsx'

import type { RegionOfInterest } from './buildSyntenyViewSpec.ts'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'

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
        <LabeledCheckbox
          className={classes.formControl}
          size="small"
          checked={useRegionOfInterest}
          onChange={val => {
            setUseRegionOfInterest(val)
          }}
          label="Use CIGAR to map the current visible region to the target"
        />
      ) : null}
      {inverted ? (
        <FlipInvertedTargetsCheckbox
          checked={flipReversedMates}
          onChange={val => {
            setFlipReversedMates(val)
          }}
        />
      ) : null}
      <WindowSizeField
        onChange={val => {
          setWindowSize(val)
        }}
      />
    </SubmitDialog>
  )
}
