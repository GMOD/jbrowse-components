import { useEffect, useState } from 'react'

import { ErrorBanner, ResizeHandle } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { TrackOverlaySlot } from '@jbrowse/display-ui'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import {
  RESIZE_HANDLE_HEIGHT,
  TRACK_OUTLINE_BORDER,
  TRACK_TOP_GAP,
} from '../consts.ts'
import Gridlines from './Gridlines.tsx'
import PaddingBlocks from './PaddingBlocks.tsx'
import TrackLabel from './TrackLabel.tsx'
import TrackRenderingContainer from './TrackRenderingContainer.tsx'

import type { LinearGenomeViewModel } from '../index.ts'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { LinearDisplayModel } from '@jbrowse/display-kit/types'

const useStyles = makeStyles()({
  // No `overflow`: paint containment already clips to the padding box, and an
  // overflow would only add a scroll container — the spurious second scrollbar
  // described in TrackRenderingContainer. flow-root keeps the block formatting
  // context that `overflow: hidden` used to establish as a side effect (neither
  // `clip` nor no overflow does), so child margins still can't collapse through
  // and shift the track — which would put the pixels off the model's offset
  // arithmetic, which the breakpoint split view draws its connectors from.
  root: {
    marginTop: TRACK_TOP_GAP,
    position: 'relative',
    display: 'flow-root',
    contain: 'layout style paint',
  },
  unpinnedTrack: {
    background: 'none',
  },
  // in flow at the bottom of the Paper, and outside `trackContent` — so a
  // `bottom:0` portaled overlay (the status chips) lands on the track content's
  // bottom edge rather than having to subtract this height back out. The height
  // arrives inline from RESIZE_HANDLE_HEIGHT, which the model's offset
  // arithmetic reads too.
  //
  // No `bar`: a divider drawn at rest under every track read as a band of its
  // own down the whole view. It keeps its RESIZE_HANDLE_HEIGHT of space in flow
  // and reveals itself under the pointer at `action.disabled`, the weight a
  // `bar` rests at.
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

// Measures the in-flow label band, the distance from the Paper's content top to
// the rendering container, into the model. Observes the Paper: it grows and
// shrinks with the label, the label setting, and the display, and each of those
// can move the container. Published after a requestAnimationFrame like
// useWidthSetter, and cleared on unmount so a removed track leaves no band.
function useTrackLabelBand(model: LGV, trackId: string) {
  const [paper, setPaper] = useState<HTMLDivElement | null>(null)
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    if (paper && container && 'ResizeObserver' in window) {
      let token: number | undefined
      const publish = () => {
        token = requestAnimationFrame(() => {
          if (isAlive(model)) {
            const paperRect = paper.getBoundingClientRect()
            const band =
              container.getBoundingClientRect().top -
              paperRect.top -
              paper.clientTop
            model.setTrackLabelBand(trackId, band)
          }
        })
      }
      publish()
      const observer = new ResizeObserver(publish)
      observer.observe(paper)
      return () => {
        observer.disconnect()
        if (token !== undefined) {
          cancelAnimationFrame(token)
        }
        if (isAlive(model)) {
          model.setTrackLabelBand(trackId, 0)
        }
      }
    }
    return undefined
  }, [paper, container, model, trackId])
  return { setPaper, setContainer }
}

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
  const outlineOffset = showTrackOutlines ? TRACK_OUTLINE_BORDER : 0
  const trackLabelStyle =
    model.effectiveTrackLabels !== 'overlapping' || display.prefersOffset
      ? classes.trackLabelOffset
      : classes.trackLabelOverlap
  const { setPaper, setContainer } = useTrackLabelBand(model, track.trackId)

  return (
    <Paper
      ref={setPaper}
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
          <TrackRenderingContainer
            model={model}
            track={track}
            ref={setContainer}
          />
        </ErrorBoundary>
      </TrackOverlaySlot>
      {/* so the separator masks the track content at the same x the data is
          drawn. Painted over by the overlay node above, which is what lifts
          display chrome clear of it. */}
      <PaddingBlocks model={model} offset={outlineOffset} />
      <ResizeHandle
        style={{ height: RESIZE_HANDLE_HEIGHT }}
        onDrag={distance => display.resizeHeight(distance)}
        // the drag's shortcut: grow the track by whatever it is scrolled over,
        // so a pileup showing three rows of forty opens to all forty
        // Optional: only a display that scrolls its own content has anything
        // hidden to expand to.
        onDoubleClick={() => {
          display.expandToContentHeight?.()
        }}
        // Bracket the drag so a display can sit an expensive per-frame layer
        // out of it (see `resizing` on TrackHeightMixin). Causal rather than a
        // per-display debounce: the handle owns both ends of the gesture. On
        // the track, so this holds whatever the active display is.
        onDragStart={() => {
          track.setResizing(true)
        }}
        onDragEnd={() => {
          track.setResizing(false)
        }}
        className={classes.resizeHandle}
      />
    </Paper>
  )
})

export default TrackContainer
