import { ErrorBanner, ResizeHandle } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { TrackOverlaySlot } from '@jbrowse/display-ui'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

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
  // bottom edge rather than having to subtract this height back out. The 4px
  // height comes with `bar`, so it isn't restated here — two classes setting it
  // land in an injection order neither file controls.
  resizeHandle: {
    position: 'relative',
  },
  // in-flow, so the label pushes the track body down by its own height. The
  // margin is that push plus a gap: without it the body starts on the label's
  // border-box edge, and the Paper's drop shadow (which reaches ~4px past it)
  // lands on the first rows of features. Vertical margins count on an atomic
  // inline-level box, so this grows the line box rather than collapsing away.
  //
  // 8, not 4. At 4 the whole margin went to clearing the shadow and nothing
  // was left over as a gap: measured on desktop-ispcr-results, where the PCR
  // product is a feature on the display's FIRST row, the chip's bottom border
  // and the feature's top border came out ~2px apart and read as one line
  // (reviewer: "the tracklabels:offset is just a little bit overlapping the
  // tracklabel still"). Most tracks hide this because their display adds its
  // own top padding before the first row. 8 keeps the ~4 the shadow needs and
  // spends the other 4 on clearance.
  trackLabelOffset: {
    position: 'relative',
    display: 'inline-block',
    marginBottom: 8,
  },
  trackLabelOverlap: {
    position: 'absolute',
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
      {/* The slot is the display's box plus the overlay node beside it, and the
          same component an embedder mounting `RenderingComponent` directly uses
          — one implementation of the paint order rather than two.

          Anchored on the display rather than on the Paper: a portaled `top:0`
          overlay anchored on the Paper sat a track label's height above the
          canvas it was meant to be drawn on (every display with a tree sidebar,
          since they all set `prefersOffset`), and a `bottom:0` one only lined up
          via a hardcoded resize-handle subtraction.

          zIndex 100 paints it above `PaddingBlocks` below and under `TrackLabel`
          (200). The negative `left` cancels the Paper's border, the same shift
          the rendering container takes, so an opaque overlay covers the canvas
          edge-to-edge instead of leaving a sliver.

          The node takes no pointer events, so the only descendants that can ever
          be an event target are the ones that deliberately took them back —
          which by construction is the interactive chrome (legends, status
          banners, panels), all of which wants the same thing from an ancestor
          gesture: leave my press alone. `TrackOverlaySlot` marks the node
          `data-gesture-owner` once for the whole layer, so a new panel gets it
          by following the `pointer-events:auto` instruction in
          `TrackOverlayPortal` rather than by also knowing about `useSideScroll`.
          Chrome that lives inline (LDColorLegend) or runs its own drag
          (ResizeHandle, VerticalScrollbar) still carries its own marker. */}
      <TrackOverlaySlot zIndex={100} overlayStyle={{ left: -outlineOffset }}>
        {/* Resets on the display, not the track: swapping a track's display
            type (pileup to SNPCoverage, say) replaces the display node, so the
            banner the old one left is about code that is no longer mounted.
            Retry is the same clearing, asked for by hand. */}
        <ErrorBoundary
          resetKeys={[display.id]}
          FallbackComponent={e => (
            <ErrorBanner error={e.error} onReset={e.resetErrorBoundary} />
          )}
        >
          <TrackRenderingContainer model={model} track={track} />
        </ErrorBoundary>
      </TrackOverlaySlot>
      {/* so the separator masks the track content at the same x the data is
          drawn. Painted over by the overlay node above, which is what lifts
          display chrome clear of it. */}
      <PaddingBlocks model={model} offset={outlineOffset} />
      <ResizeHandle
        bar
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
