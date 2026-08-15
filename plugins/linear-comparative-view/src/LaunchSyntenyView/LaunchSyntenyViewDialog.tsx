import { useState } from 'react'

import { getCigar } from '../syntenyMate.ts'
import SyntenyLaunchDialog from './SyntenyLaunchDialog.tsx'
import { launchSyntenyViewForFeatures } from './buildSyntenyViewSpec.ts'
import {
  ClipToRegionCheckbox,
  CopySourceTracksCheckbox,
  DEFAULT_WINDOW_SIZE,
  FlipInvertedTargetsCheckbox,
  WindowSizeField,
} from './launchOptionFields.tsx'

import type { RegionOfInterest } from './resolvePanel.ts'
import type {
  AbstractSessionModel,
  AbstractViewModel,
  Feature,
} from '@jbrowse/core/util'
import type { TrackInit } from '@jbrowse/core/util/tracks'

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
  // place of
  sourceView?: AbstractViewModel
  trackId: string
  handleClose: () => void
}) {
  const inverted = feature.get('strand') === -1
  const [flipReversedMates, setFlipReversedMates] = useState(inverted)
  const [copySourceTracks, setCopySourceTracks] = useState(true)
  const [windowSize, setWindowSize] = useState<number | undefined>(
    DEFAULT_WINDOW_SIZE,
  )
  const [useRegionOfInterest, setUseRegionOfInterest] = useState(true)
  return (
    <SyntenyLaunchDialog
      session={session}
      sourceView={sourceView}
      title="Launch synteny view"
      ready={windowSize === undefined ? undefined : { windowSize }}
      handleClose={handleClose}
      onLaunch={({ windowSize }, replacing) => {
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
      }}
    >
      {region ? (
        <ClipToRegionCheckbox
          hasCigar={!!getCigar(feature)}
          checked={useRegionOfInterest}
          onChange={setUseRegionOfInterest}
        />
      ) : null}
      {inverted ? (
        <FlipInvertedTargetsCheckbox
          checked={flipReversedMates}
          onChange={setFlipReversedMates}
        />
      ) : null}
      {anchorTracks.length ? (
        <CopySourceTracksCheckbox
          checked={copySourceTracks}
          onChange={setCopySourceTracks}
        />
      ) : null}
      <WindowSizeField onChange={setWindowSize} />
    </SyntenyLaunchDialog>
  )
}
