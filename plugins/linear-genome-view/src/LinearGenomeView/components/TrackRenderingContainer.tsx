import { Suspense, useCallback } from 'react'

import { LoadingOverlay } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { MINIMIZED_TRACK_HEIGHT } from '../consts.ts'

import type { LinearDisplayModel } from '../../BaseLinearDisplay/types.ts'
import type { LinearGenomeViewModel } from '../index.ts'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

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
  // (the reported double/flickering/full-height scrollbars). `contain: strict`
  // already clips the paint, so overflow stays hidden with no scrollbar.
  trackRenderingContainer: {
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    position: 'relative',
    background: 'none',
    contain: 'strict',
  },
})

type LGV = LinearGenomeViewModel

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
          <div
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
          </div>

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
