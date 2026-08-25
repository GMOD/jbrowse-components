import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'

import { getCigar } from '../syntenyMate.ts'
import { SpanLocus } from './PanelList.tsx'
import SyntenyLaunchDialog from './SyntenyLaunchDialog.tsx'
import { launchSyntenyViewForFeatures } from './buildSyntenyViewSpec.ts'
import { DEFAULT_WINDOW_SIZE } from './launchDefaults.ts'
import {
  ClipToRegionCheckbox,
  CopySourceTracksCheckbox,
  FlipInvertedTargetsCheckbox,
  WindowSizeField,
} from './launchOptionFields.tsx'
import { resolveFeaturePanels } from './resolvePanel.ts'

import type { RegionOfInterest } from './resolvePanel.ts'
import type {
  AbstractViewContainer,
  AbstractViewModel,
  NotificationSink,
  Feature,
} from '@jbrowse/core/util'
import type { TrackInit } from '@jbrowse/core/util/tracks'

const useStyles = makeStyles()(theme => ({
  panels: {
    margin: theme.spacing(1, 0),
  },
  panelRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(1),
  },
  panelLocus: {
    color: theme.palette.text.secondary,
  },
}))

/**
 * Where the two panels will open, unpadded, resolved the way the launch
 * resolves them — the region dialog prints the same line per panel, and here
 * it is what makes the clip checkbox's effect visible: a liftOver chain
 * clipped to the window is a few tens of kb, and unclipped it is the
 * chromosome. The flip checkbox is spelled out as `(-)` on the mate rather
 * than folded into the locstring, since it decides orientation, not position.
 */
function LaunchPreview({
  feature,
  region,
  anchorAssembly,
}: {
  feature: Feature
  region: RegionOfInterest | undefined
  anchorAssembly: string
}) {
  const { classes } = useStyles()
  const [panel] = resolveFeaturePanels([feature], region)
  if (!panel) {
    return null
  }
  return (
    <div className={classes.panels}>
      <div className={classes.panelRow}>
        <Typography>{anchorAssembly}</Typography>
        <SpanLocus
          className={classes.panelLocus}
          span={{
            refName: feature.get('refName'),
            start: panel.anchorStart,
            end: panel.anchorEnd,
            reversed: false,
          }}
        />
      </div>
      <div className={classes.panelRow}>
        <Typography>{panel.assemblyName}</Typography>
        <SpanLocus
          className={classes.panelLocus}
          span={{
            refName: panel.refName,
            start: panel.mateStart,
            end: panel.mateEnd,
            reversed: panel.reversed,
          }}
        />
      </div>
    </div>
  )
}

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
  session: AbstractViewContainer & NotificationSink
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
  const clipTo = useRegionOfInterest ? region : undefined
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
          region: clipTo,
          replacing,
        })
      }}
    >
      <LaunchPreview
        feature={feature}
        region={clipTo}
        anchorAssembly={anchorAssembly}
      />
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
