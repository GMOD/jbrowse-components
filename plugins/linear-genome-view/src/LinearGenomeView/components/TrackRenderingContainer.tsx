import { Suspense, useCallback } from 'react'

import { LoadingOverlay } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { MINIMIZED_TRACK_HEIGHT } from '../consts.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { LinearDisplayModel } from '@jbrowse/display-kit/types'

const useStyles = makeStyles()({
  // aligns with block boundaries. check for example the breakpoint split view
  // demo to see if features align if wanting to change things. the -1 left
  // offset (cancels the Paper's 1px border) is applied inline since it's
  // conditional on showTrackOutlines, the same condition the border is gated on
  renderingComponentContainer: {
    position: 'absolute',
    height: '100%',
    width: '100%',
  },

  // Tracks never scroll natively on this outer container — every display owns
  // its own vertical scroll: canvas displays scroll an inner sticky-canvas
  // container (FeatureComponent), while alignments and variants draw a custom
  // VerticalScrollbar overlay and redraw the canvas at `scrollTop`. A native
  // scroll port here only produced a *second*, spurious scrollbar whenever a
  // display's absolutely-positioned overlays extended a pixel past `height`
  // (the reported double/flickering/full-height scrollbars). So there is
  // deliberately no `overflow` here: `contain: strict` includes paint
  // containment, which clips to the padding box on its own, and adding an
  // `overflow` would reintroduce the scroll container — one the browser can
  // still scroll silently (focus, scrollIntoView, scroll anchoring) even with
  // no scrollbar shown, desyncing track content from the scalebar.
  //
  // `contain: strict` is also what makes every piece of display chrome reach the
  // track's overlay layer through `TrackOverlayPortal` — containment creates a
  // stacking context, so nothing in here can paint above `PaddingBlocks`, which
  // is a later sibling. That looks like a tax worth removing (swap for a bare
  // `overflow: clip`, which clips without a scroll container AND without a
  // stacking context, and the portals become plain z-indexes). It was measured:
  // `browser-tests/probe-containment.ts`. Under DOM load that swap costs 2.6x
  // paint time on a track height change and 4.0x on a pan, at identical paint
  // counts. The stacking context IS the paint isolation — the two can't be
  // separated, so the portal is the price of the isolation, not a workaround
  // for it. Layout containment measured free; the paint half is the load-bearing
  // one. ADR-058.
  trackRenderingContainer: {
    whiteSpace: 'nowrap',
    position: 'relative',
    background: 'none',
    contain: 'strict',
  },
})

type LGV = LinearGenomeViewModel

// The box every LGV display is mounted in, and the ONLY place in the tree where
// a track's pixels get a name and a role — one component rather than an
// `aria-label` per display type, the same way `TrackOverlaySlot` is one paint
// order rather than one per display.
//
// Its own observer for a measured reason. The "what is on screen" half of the
// name is the settled locstring, which changes whenever navigation settles; read
// from `TrackRenderingContainer` below, that would re-render every track's
// container (and re-run its `useStyles`) on every settle. Here the re-render is
// this one `<div>`: `children` is the same React element object the parent
// already handed it, so React bails out of the display's whole subtree.
//
// **`role="figure"`, not `role="img"`.** `img` is the textbook role for a canvas
// and would be right if the box held only pixels — but it makes every descendant
// presentational, and a display's chrome does not all portal out of the sandbox:
// alignments draws its group collapse/expand `<button>`s inline
// (`GroupLabelsOverlay`), which under `img` would be focusable and announced as
// nothing. `figure` names the box and keeps what is inside it reachable. Revisit
// if inline interactive chrome ever goes away.
const TrackDisplayRegion = observer(function TrackDisplayRegion({
  model,
  track,
  children,
  ...divProps
}: {
  model: LGV
  track: BaseTrackModel
  children: React.ReactNode
} & React.ComponentPropsWithRef<'div'>) {
  const trackName = getTrackName(track.configuration, getSession(track))
  const loc = model.coarseVisibleLocStrings
  return (
    <div
      {...divProps}
      role="figure"
      aria-label={
        loc ? `${trackName} track, showing ${loc}` : `${trackName} track`
      }
    >
      {children}
    </div>
  )
})

const TrackRenderingContainer = observer(function TrackRenderingContainer({
  model,
  track,
}: {
  model: LGV
  track: BaseTrackModel
}) {
  const { classes } = useStyles()
  // an LGV track always holds at least one linear display (activeDisplay =
  // displays[0]); narrow to the linear shape for height/RenderingComponent
  const display = track.activeDisplay as LinearDisplayModel
  const { height, RenderingComponent, DisplayBlurb } = display
  const { trackRefs, showTrackOutlines } = model
  const trackId = track.trackId
  const minimized = track.minimized

  // callback ref keeps trackRefs in sync as the rendering div mounts/unmounts
  // (e.g. on minimize/restore), unlike a useEffect that misses the toggle
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) {
        trackRefs[trackId] = el
      } else {
        delete trackRefs[trackId]
      }
    },
    [trackRefs, trackId],
  )

  return (
    <div
      className={classes.trackRenderingContainer}
      style={{
        height: minimized ? MINIMIZED_TRACK_HEIGHT : height,
      }}
      data-testid={`trackRenderingContainer-${model.id}-${trackId}`}
    >
      {!minimized ? (
        <>
          <TrackDisplayRegion
            model={model}
            track={track}
            ref={setRef}
            className={classes.renderingComponentContainer}
            style={{ left: showTrackOutlines ? -1 : 0 }}
          >
            <Suspense fallback={<LoadingOverlay isVisible immediate />}>
              <RenderingComponent
                model={display}
                onHorizontalScroll={model.horizontalScroll}
              />
            </Suspense>
          </TrackDisplayRegion>

          {DisplayBlurb ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: display.height - 20,
              }}
            >
              <DisplayBlurb model={display} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
})

export default TrackRenderingContainer
