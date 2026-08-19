import { Suspense, lazy, useEffect, useRef } from 'react'

import { VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { useFocusOnInteraction } from '@jbrowse/core/util/hooks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useScrollZoomHint } from '@jbrowse/core/util/usePanZoom'
import Paper from '@mui/material/Paper'
import { observer } from 'mobx-react'

import { SCALE_BAR_HEIGHT } from '../consts.ts'
import NavigationAnnouncer from './NavigationAnnouncer.tsx'
import Scalebar from './Scalebar.tsx'
import TrackContainer from './TrackContainer.tsx'
import TracksContainer from './TracksContainer.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

// lazies
const NoTracksActiveButton = lazy(() => import('./NoTracksActiveButton.tsx'))
const ScrollZoomHint = lazy(() => import('@jbrowse/core/ui/ScrollZoomHint'))

// Core's default is sized for the bare caption an embedder draws. This prompt
// carries a button, so it has to outlast the trip from "I read it" to "my
// cursor is on it".
const HINT_LINGER_MS = 5000

const useStyles = makeStyles()(theme => ({
  header: {
    background: theme.palette.background.paper,
    top: VIEW_HEADER_HEIGHT,
    zIndex: 850,
  },
  pinnedTracks: {
    position: 'sticky',
    zIndex: 3,
    // cap the sticky block at the viewport space below its top offset so
    // pinning many/tall tracks scrolls within the block instead of burying
    // the unpinned tracks underneath it
    overflowY: 'auto',
  },
  rel: {
    position: 'relative',
  },
}))

const LinearGenomeViewContainer = observer(function LinearGenomeViewContainer({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const {
    pinnedTracks,
    stickyViewHeaders,
    pinnedTracksTop,
    tracks,
    unpinnedTracks,
    hideHeader,
  } = model
  const { classes } = useStyles()
  const session = getSession(model)
  const ref = useRef<HTMLDivElement>(null)
  // cached left edge of the view, refreshed on resize, so the mousemove hover
  // handler doesn't call getBoundingClientRect() (a layout reflow) every move
  const rectLeftRef = useRef(0)
  const MiniControlsComponent = model.MiniControlsComponent()
  const HeaderComponent = model.HeaderComponent()
  // The tracks area, and not the whole view — the same rule the click-drag half
  // already follows (see TracksContainer's useSideScroll), for a bigger payoff.
  // The chrome above the tracks is the only surface left where a wheel still
  // means "move down the page": the view header is `position: sticky`, so
  // binding the gesture below it leaves ~100px of always-visible gutter that
  // scrolls, instead of the ~26px of view title bar that is all a full-view
  // binding leaves. That gutter is the whole answer for scroll-to-zoom users,
  // because there is no modifier to fall back on — the browser turns shift into
  // horizontal scroll, ctrl/meta is pinch-zoom, and Firefox binds alt to
  // history navigation.
  //
  // Nothing is lost by it: a wheel over the toolbar used to zoom the view from
  // a point that shows none of it. `browser-tests/probe-scroll-gutter.ts`
  // measures the band.
  const tracksRef = useRef<HTMLDivElement>(null)
  // Binds the gestures and reports the wheel that meant "zoom" and moved
  // nothing, which is what the hint below is for.
  const {
    showZoomHint,
    zoomHintAt,
    zoomHintMounted,
    dismissZoomHint,
    setZoomHintHeld,
  } = useScrollZoomHint(tracksRef, model, {
    lingerMs: HINT_LINGER_MS,
    // one budget for the whole session, not one per view: a synteny view is
    // three of these side by side
    enabled: session.canShowScrollZoomHint,
    onShow: () => {
      session.setScrollZoomHintCount(session.scrollZoomHintCount + 1)
    },
    // they replied, so the budget's remaining raises would be asking a question
    // that has been answered
    onAnswered: () => {
      session.endScrollZoomHints()
    },
  })
  useEffect(() => {
    const curr = ref.current
    if (!curr) {
      return
    }
    rectLeftRef.current = curr.getBoundingClientRect().left
    const observer =
      'ResizeObserver' in window
        ? new ResizeObserver(() => {
            rectLeftRef.current = curr.getBoundingClientRect().left
          })
        : undefined
    observer?.observe(curr)
    return () => {
      observer?.disconnect()
    }
  }, [])
  // sets the focused view id based on a click within the LGV; necessary for
  // subviews to be focused properly
  useFocusOnInteraction(ref, () => {
    session.setFocusedViewId?.(model.id)
  })

  return (
    <>
      <div
        className={classes.rel}
        ref={ref}
        onMouseLeave={() => {
          session.setHovered(undefined)
        }}
        onMouseMove={event => {
          const leftPx = event.clientX - rectLeftRef.current
          const hoverPosition = model.pxToBp(leftPx)
          // `hoveredFeature` is BaseDisplay's hook, so every display type
          // answers it — this used to read `featureUnderMouse`, a name only the
          // wiggle, alignments and Manhattan families used, off `displays[0]`
          // alone. At most one display can be under the pointer, so the first
          // non-empty answer is the answer.
          const hoverFeature = tracks
            .flatMap(t => t.displays)
            .map(d => d.hoveredFeature)
            .find(Boolean)
          session.setHovered({ hoverPosition, hoverFeature })
        }}
      >
        {/* Where the view says out loud that it moved. Its own observer, so a
        settled locus re-renders a text node instead of the track stack — see
        NavigationAnnouncer for why it reads the coarse locstring and not the
        live one. */}
        <NavigationAnnouncer model={model} />
        <div
          className={classes.header}
          style={{ position: stickyViewHeaders ? 'sticky' : undefined }}
        >
          <HeaderComponent model={model} />
          {hideHeader ? <MiniControlsComponent model={model} /> : null}
        </div>
        {/* Everything the wheel may zoom, in both modes — see tracksRef. */}
        <div ref={tracksRef}>
          {model.scalebarOnly ? (
            <Scalebar
              model={model}
              style={{ height: SCALE_BAR_HEIGHT, boxSizing: 'border-box' }}
            />
          ) : (
            <TracksContainer model={model}>
              {!tracks.length ? (
                <Suspense fallback={null}>
                  <NoTracksActiveButton model={model} />
                </Suspense>
              ) : (
                <>
                  {pinnedTracks.length ? (
                    <Paper
                      elevation={6}
                      className={classes.pinnedTracks}
                      style={{
                        top: pinnedTracksTop,
                        maxHeight: `calc(100vh - ${pinnedTracksTop}px)`,
                      }}
                    >
                      {pinnedTracks.map(track => (
                        <TrackContainer
                          key={track.id}
                          model={model}
                          track={track}
                        />
                      ))}
                    </Paper>
                  ) : null}
                  {unpinnedTracks.map(track => (
                    <TrackContainer
                      key={track.id}
                      model={model}
                      track={track}
                    />
                  ))}
                </>
              )}
            </TracksContainer>
          )}
        </div>
      </div>
      {/* Portals itself to the body and positions in viewport coordinates, so
      it sits outside the tracks rather than inside them — see ScrollZoomHint.
      Kept a sibling of the view rather than a child: a portal's events still
      bubble along the *React* tree, so nested here it would drive the hover
      handler above from wherever on screen it happens to be drawn. */}
      {zoomHintMounted ? (
        <Suspense fallback={null}>
          <ScrollZoomHint
            show={showZoomHint}
            at={zoomHintAt}
            onEnable={() => {
              model.setScrollZoom(true)
              dismissZoomHint()
            }}
            onHeldChange={setZoomHintHeld}
          />
        </Suspense>
      ) : null}
    </>
  )
})

export default LinearGenomeViewContainer
