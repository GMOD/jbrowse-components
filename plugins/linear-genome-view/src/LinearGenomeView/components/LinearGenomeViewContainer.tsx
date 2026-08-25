import { Suspense, lazy, useEffect, useRef } from 'react'

import { VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import {
  LGV_HEADER_HEIGHT_VAR,
  SCROLL_PORT_HEIGHT_VAR,
  VIEW_HEADER_HEIGHT_VAR,
  useChromeHeightVar,
  useFocusOnInteraction,
} from '@jbrowse/core/util/hooks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useWheelZoom } from '@jbrowse/core/util/usePanZoom'
import Paper from '@mui/material/Paper'
import { observer } from 'mobx-react'

import { SCALE_BAR_HEIGHT } from '../consts.ts'
import { stickyChromeTops } from '../stickyChrome.ts'
import Header from './Header.tsx'
import MiniControls from './MiniControls.tsx'
import NavigationAnnouncer from './NavigationAnnouncer.tsx'
import Scalebar from './Scalebar.tsx'
import TrackContainer from './TrackContainer.tsx'
import TracksContainer from './TracksContainer.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

// lazies
const NoTracksActiveButton = lazy(() => import('./NoTracksActiveButton.tsx'))

const useStyles = makeStyles()(theme => ({
  header: {
    background: theme.palette.background.paper,
    // measured, with the constant as the fallback: the view header above is a
    // minimum-height box that grows with its content, so summing constants
    // here put this over the bottom of it at a larger root font size
    top: `var(${VIEW_HEADER_HEIGHT_VAR}, ${VIEW_HEADER_HEIGHT}px)`,
    zIndex: 850,
  },
  pinnedTracks: {
    position: 'sticky',
    zIndex: 3,
    // cap the sticky block at the space below its top offset so pinning
    // many/tall tracks scrolls within the block instead of burying the
    // unpinned tracks underneath it — see the maxHeight below for which space
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
    headerHeight,
    tracks,
    unpinnedTracks,
    hideHeader,
  } = model
  const stickyTops = stickyChromeTops({ stickyViewHeaders, headerHeight })
  const headerRef = useRef<HTMLDivElement>(null)
  useChromeHeightVar(headerRef, LGV_HEADER_HEIGHT_VAR)
  const { classes } = useStyles()
  const session = getSession(model)
  const ref = useRef<HTMLDivElement>(null)
  // cached left edge of the view, refreshed on resize, so the mousemove hover
  // handler doesn't call getBoundingClientRect() (a layout reflow) every move
  const rectLeftRef = useRef(0)
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
  // a point that shows none of it. `wheelBinding.test.tsx` is the pin — which
  // element the listener is on is a DOM fact, so jsdom sees it exactly;
  // `browser-tests/probe-scroll-gutter.ts` measures how many pixels wide the
  // resulting band is, which is the part that needs a real layout and runs by
  // hand.
  const tracksRef = useRef<HTMLDivElement>(null)
  useWheelZoom(tracksRef, model)
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
      {/* The only handle a NESTED view has. App-core's ViewContainer stamps
      `view-container-<id>` around each of the session's own views and nothing
      wraps a row of a synteny stack or a panel of a breakpoint split view, so
      the chrome of one — its ruler, its scalebar — could not be reached by
      anything holding the view: every `rubberband_controls` on the page is
      indistinguishable, and a figure or a tour picking the second of them is
      pinned to the row order it was written at. */}
      <div
        data-testid={`linear-genome-view-${model.id}`}
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
          ref={headerRef}
          className={classes.header}
          style={{ position: stickyViewHeaders ? 'sticky' : undefined }}
        >
          <Header model={model} />
          {hideHeader ? <MiniControls model={model} /> : null}
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
                        top: stickyTops.pinnedTracks,
                        // the scroll port this sticks in, not the window: it is
                        // under the app bar in the classic stack, a dockview
                        // cell in a workspace, and the host's box when embedded.
                        // The fallback is what an unbounded embed gets, where
                        // the page itself is the scroller
                        maxHeight: `calc(var(${SCROLL_PORT_HEIGHT_VAR}, 100vh) - ${stickyTops.pinnedTracks})`,
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
    </>
  )
})

export default LinearGenomeViewContainer
