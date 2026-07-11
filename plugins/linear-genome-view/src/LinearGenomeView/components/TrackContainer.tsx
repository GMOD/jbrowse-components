import { useState } from 'react'

import { ErrorBanner, ResizeHandle } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import Gridlines from './Gridlines.tsx'
import PaddingBlocks from './PaddingBlocks.tsx'
import TrackLabel from './TrackLabel.tsx'
import TrackRenderingContainer from './TrackRenderingContainer.tsx'
import { TrackOverlayContext } from '../TrackOverlayContext.ts'

import type { LinearDisplayModel } from '../../BaseLinearDisplay/types.ts'
import type { LinearGenomeViewModel } from '../index.ts'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()({
  root: {
    marginTop: 2,
    overflow: 'hidden',
    position: 'relative',
    contain: 'layout style paint',
  },
  unpinnedTrack: {
    background: 'none',
  },
  resizeHandle: {
    position: 'relative',
    height: 4,
  },
  trackLabelOffset: {
    position: 'relative',
    display: 'inline-block',
  },
  trackLabelOverlap: {
    position: 'absolute',
  },
  // Portal target for display-provided floating chrome (e.g. the multi-wiggle
  // legend). Rendered after PaddingBlocks so it paints above the inter-region
  // masks; shares their box so a `top:0` overlay lands at the same origin. Below
  // TrackLabel (zIndex 200); pointer-events pass through to the canvas.
  trackOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 100,
  },
})

type LGV = LinearGenomeViewModel

const TrackContainer = observer(function TrackContainer({
  model,
  track,
}: {
  model: LGV
  track: BaseTrackModel
}) {
  const { classes } = useStyles()
  // an LGV track always holds at least one linear display (activeDisplay =
  // displays[0]); narrow to the linear shape for prefersOffset/resizeHeight
  const display = track.activeDisplay as LinearDisplayModel
  const { showTrackOutlines } = model
  // element state (not a ref) so consumers re-render once the portal target
  // mounts and the context value flips from null to the node
  const [overlayEl, setOverlayEl] = useState<HTMLDivElement | null>(null)
  const trackLabelStyle =
    model.effectiveTrackLabels !== 'overlapping' || display.prefersOffset
      ? classes.trackLabelOffset
      : classes.trackLabelOverlap

  return (
    <Paper
      className={cx(classes.root, track.pinned ? null : classes.unpinnedTrack)}
      variant={showTrackOutlines ? 'outlined' : undefined}
      elevation={showTrackOutlines ? undefined : 0}
      onDragOver={event => {
        model.onTrackDragOver(track.id, event.clientY)
      }}
    >
      {/* offset cancels the Paper's 1px left border (present iff outlines on) */}
      {track.pinned ? (
        <Gridlines model={model} offset={showTrackOutlines ? 1 : 0} />
      ) : null}
      {model.effectiveTrackLabels !== 'hidden' ? (
        <TrackLabel track={track} className={trackLabelStyle} />
      ) : null}
      <ErrorBoundary FallbackComponent={e => <ErrorBanner error={e.error} />}>
        <TrackOverlayContext value={overlayEl}>
          <TrackRenderingContainer model={model} track={track} />
        </TrackOverlayContext>
      </ErrorBoundary>
      {/* mirrors the rendering container's left offset (both sit inside the
          Paper's 1px border, present iff outlines on), so the separator masks
          the track content at the same x the data is drawn */}
      <PaddingBlocks model={model} offset={showTrackOutlines ? 1 : 0} />
      {/* mounted after PaddingBlocks so display chrome portaled here paints
          above the inter-region masks (see TrackOverlayContext) */}
      <div ref={setOverlayEl} className={classes.trackOverlay} />
      <ResizeHandle
        onDrag={distance => display.resizeHeight(distance)}
        className={classes.resizeHandle}
      />
    </Paper>
  )
})

export default TrackContainer
