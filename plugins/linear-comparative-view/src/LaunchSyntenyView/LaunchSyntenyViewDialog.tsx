import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { isSessionWithViewReplacement } from '@jbrowse/core/util'

import { launchSyntenyViewForFeatures } from './buildSyntenyViewSpec.ts'
import {
  ClipToRegionCheckbox,
  CopySourceTracksCheckbox,
  DEFAULT_WINDOW_SIZE,
  FlipInvertedTargetsCheckbox,
  ReplaceCurrentViewButton,
  WindowSizeField,
} from './launchOptionFields.tsx'

import type { RegionOfInterest } from './buildSyntenyViewSpec.ts'
import type {
  AbstractSessionModel,
  AbstractViewModel,
  Feature,
} from '@jbrowse/core/util'
import type { TrackInit } from '@jbrowse/plugin-linear-genome-view'

// The pairwise launch: one clicked alignment, one target panel. Launching every
// assembly a locus aligns to is the region-anchored flow instead — see
// LaunchSyntenyViewForRegionDialog, reached from the rubberband — because that
// one is about a locus rather than about the alignment under the cursor.
export default function LaunchSyntenyViewDialog({
  session,
  region,
  feature,
  anchorAssembly,
  anchorTracks = [],
  sourceView,
  trackId,
  handleClose,
}: {
  session: AbstractSessionModel
  region?: RegionOfInterest
  feature: Feature
  anchorAssembly: string
  // the launching view's own tracks, for the panel that opens on its assembly
  anchorTracks?: TrackInit[]
  // the launching view itself, which the dialog offers to put the result in
  // place of. Omitted by callers that have no single view to name — the synteny
  // feature-details widget, whose link can be opened from a view the launched
  // one would not be a replacement for
  sourceView?: AbstractViewModel
  trackId: string
  handleClose: () => void
}) {
  const inverted = feature.get('strand') === -1
  const hasCIGAR = !!feature.get('CIGAR')
  const [flipReversedMates, setFlipReversedMates] = useState(inverted)
  const [copySourceTracks, setCopySourceTracks] = useState(true)
  const [windowSize, setWindowSize] = useState<number | undefined>(
    DEFAULT_WINDOW_SIZE,
  )
  const [useRegionOfInterest, setUseRegionOfInterest] = useState(true)
  const canReplace = !!sourceView && isSessionWithViewReplacement(session)
  const launch = (replacing?: AbstractViewModel) => {
    if (windowSize !== undefined) {
      launchSyntenyViewForFeatures({
        features: [feature],
        anchorAssembly,
        anchorTracks: copySourceTracks ? anchorTracks : undefined,
        windowSize,
        flipReversedMates,
        trackId,
        session,
        region: useRegionOfInterest ? region : undefined,
        replacing,
      })
      handleClose()
    }
  }
  return (
    <SubmitDialog
      open
      title="Launch synteny view"
      submitDisabled={windowSize === undefined}
      // named only when there is a second way out to tell it apart from —
      // otherwise Submit is the only button and "Submit" is what it has always
      // said
      submitText={canReplace ? 'Open in new view' : undefined}
      actions={
        canReplace ? (
          <ReplaceCurrentViewButton
            disabled={windowSize === undefined}
            onClick={() => {
              launch(sourceView)
            }}
          />
        ) : null
      }
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        launch()
      }}
    >
      {region ? (
        <ClipToRegionCheckbox
          hasCigar={hasCIGAR}
          checked={useRegionOfInterest}
          onChange={val => {
            setUseRegionOfInterest(val)
          }}
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
      {anchorTracks.length ? (
        <CopySourceTracksCheckbox
          checked={copySourceTracks}
          onChange={val => {
            setCopySourceTracks(val)
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
