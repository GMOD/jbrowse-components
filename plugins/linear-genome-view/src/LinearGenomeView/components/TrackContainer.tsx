import { useState } from 'react'

import { ErrorBanner, ResizeHandle } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import { TrackOverlayContext } from '../TrackOverlayContext.ts'
import Gridlines from './Gridlines.tsx'
import PaddingBlocks from './PaddingBlocks.tsx'
import TrackLabel from './TrackLabel.tsx'
import TrackRenderingContainer from './TrackRenderingContainer.tsx'

import type { LinearDisplayModel } from '../../BaseLinearDisplay/types.ts'
import type { LinearGenomeViewModel } from '../index.ts'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()({
  // No `overflow`: paint containment already clips to the padding box, and an
  // overflow would only add a scroll container — the spurious second scrollbar
  // described in TrackRenderingContainer. flow-root keeps the block formatting
  // context that `overflow: hidden` used to establish as a side effect (neither
  // `clip` nor no overflow does), so child margins still can't collapse through
  // and shift the track — which the breakpoint split view would pick up, since
  // its connector overlay measures trackRefs' getBoundingClientRect().top.
  root: {
    marginTop: 2,
    position: 'relative',
    display: 'flow-root',
    contain: 'layout style paint',
  },
  unpinnedTrack: {
    background: 'none',
  },
  // in flow at the bottom of the Paper, and outside `trackContent` — so a
  // `bottom:0` portaled overlay (the status chips) lands on the track content's
  // bottom edge rather than having to subtract this height back out.
  resizeHandle: {
    position: 'relative',
    height: 4,
  },
  // in-flow, so the label pushes the track body down by its own height. The
  // margin is that push plus a gap: without it the body starts on the label's
  // border-box edge, and the Paper's drop shadow (which reaches ~4px past it)
  // lands on the first rows of features. Vertical margins count on an atomic
  // inline-level box, so this grows the line box rather than collapsing away.
  trackLabelOffset: {
    position: 'relative',
    display: 'inline-block',
    marginBottom: 4,
  },
  trackLabelOverlap: {
    position: 'absolute',
  },
  // Wraps the rendering container so the overlay node below can be the display's
  // own box rather than the Paper's. Anchored on the Paper, a portaled `top:0`
  // overlay sat a track label's height above the canvas it was meant to be drawn
  // on — which is every display with a tree sidebar, since they all set
  // `prefersOffset` — and a `bottom:0` one only lined up via a hardcoded
  // resize-handle subtraction. Position only: no z-index, so the overlay's own
  // still competes in the Paper's stacking context against PaddingBlocks.
  trackContent: {
    position: 'relative',
  },
  // Portal target for display-provided floating chrome (the multi-wiggle legend,
  // the tree sidebar's painted half and its row labels, the bottom-right status
  // chips). zIndex 100 paints it above the inter-region masks and below
  // TrackLabel (200); pointer-events pass through to the canvas.
  //
  // Its box is the *display's*, so chrome portaled here keeps the coordinates it
  // would have had inline: same origin, same height, and — via the inline `left`
  // — the same outline offset the rendering container takes, so an opaque
  // overlay covers the canvas edge-to-edge instead of leaving a sliver.
  trackOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '100%',
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
  // The Paper's 1px border, present iff outlines are on. Everything laid out in
  // the *display's* coordinates has to cancel it — the rendering container
  // shifts left by it (see renderingComponentContainer), so the overlay node and
  // the masks over it have to move by the same amount or they land a pixel off
  // the data. One binding rather than three copies of the ternary, because the
  // three agreeing is the whole point.
  const outlineOffset = showTrackOutlines ? 1 : 0
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
      {track.pinned ? <Gridlines model={model} offset={outlineOffset} /> : null}
      {model.effectiveTrackLabels !== 'hidden' ? (
        <TrackLabel track={track} className={trackLabelStyle} />
      ) : null}
      <div className={classes.trackContent}>
        <ErrorBoundary FallbackComponent={e => <ErrorBanner error={e.error} />}>
          <TrackOverlayContext value={overlayEl}>
            <TrackRenderingContainer model={model} track={track} />
          </TrackOverlayContext>
        </ErrorBoundary>
        {/* the display's own box, outside its `contain:strict` sandbox — see
            TrackOverlayContext */}
        <div
          ref={setOverlayEl}
          className={classes.trackOverlay}
          style={{ left: -outlineOffset }}
        />
      </div>
      {/* so the separator masks the track content at the same x the data is
          drawn. Painted over by the overlay node above, which is what lifts
          display chrome clear of it. */}
      <PaddingBlocks model={model} offset={outlineOffset} />
      <ResizeHandle
        onDrag={distance => display.resizeHeight(distance)}
        // Bracket the drag so a display can sit an expensive per-frame layer
        // out of it (see `resizing` on TrackHeightMixin). Causal rather than a
        // per-display debounce: the handle owns both ends of the gesture.
        onDragStart={() => {
          display.setResizing(true)
        }}
        onDragEnd={() => {
          display.setResizing(false)
        }}
        className={classes.resizeHandle}
      />
    </Paper>
  )
})

export default TrackContainer
