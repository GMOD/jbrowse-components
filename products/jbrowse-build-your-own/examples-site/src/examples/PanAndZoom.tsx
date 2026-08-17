import { Suspense, useSyncExternalStore } from 'react'

import {
  PaletteProvider,
  useSessionPalette,
} from '@jbrowse/core/ui/PaletteContext'
import { useCreateOnce, useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { TrackOverlaySlot } from '@jbrowse/display-ui'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// Drag to pan, wheel to zoom, shift+wheel to scroll sideways.
//
// `usePanZoom` is the whole gesture layer, and it is the same one JBrowse's own
// view runs, so a browser you build here feels like the one you didn't. It
// returns handlers to spread on the element you measured, and a flag for the
// prompt below.
//
// What it is doing that a hand-written version usually isn't: batching a burst
// of wheel events into one update per frame, rate-limiting the zoom so an
// inertial trackpad flick doesn't jump decades of scale, ignoring the stray
// sideways delta a trackpad emits mid-pinch, and deferring pointer capture
// until the press has travelled far enough to be a drag -- capture it on the
// press and every click lands on your container, so a display's
// click-to-select-a-feature stops selecting.
//
// The palette at the bottom is the one part of this that looks optional on a
// page with no feature labels on it, and is not. This track draws its own
// y-axis in React, from `usePalette()` -- and with no provider that hook falls
// back to JBrowse's *light* default whatever the page around it is, so the axis
// comes out light-themed on a dark host while the canvas beside it is right.
//
// Self-contained, like every page here: nothing is imported from elsewhere in
// this site, so this file runs on its own. The One track example repeats the
// engine and mounting parts below with the interactivity stripped back out.

const volvox = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
}

const wiggleTrack = {
  type: 'QuantitativeTrack',
  trackId: 'volvox_microarray',
  name: 'Microarray signal',
  assemblyNames: ['volvox'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox_microarray.bw',
  },
  displayDefaults: {
    defaultRendering: 'xyplot',
    height: 100,
    color: '#3a7ca5',
    minScore: 0,
    maxScore: 1000,
  },
}

function makeView(scrollZoom: boolean) {
  const state = createViewState({
    assembly: volvox,
    tracks: [wiggleTrack],
    init: {
      loc: 'ctgA:1..50,000',
      tracks: ['volvox_microarray'],
    },
  })
  const { view } = state.session
  // Which gesture a bare wheel is:
  //
  //   on   -- wheel zooms, the way a map does. Direct, and the right default
  //           when the browser owns its area of the page.
  //   off  -- wheel scrolls the page and only ctrl/cmd+wheel zooms. Right when
  //           the browser is one element in a long document, where a wheel that
  //           silently swallowed the page scroll would trap the reader.
  //
  // A *session* preference, not a piece of React state of your own: displays
  // that scroll vertically inside themselves (an alignments pileup is the one
  // you hit first) read the same flag to decide whether the plain wheel is
  // already spoken for. A private copy that disagrees gets you both at once,
  // the pileup scrolling its reads while the view zooms under the cursor.
  view.setScrollZoom(scrollZoom)
  return { view, session: state.session }
}

type BrowserView = ReturnType<typeof makeView>['view']

// `view.ready` is false in TWO states, not one: while the assembly loads, and
// when it failed to load. Returning `null` for both -- the gate that looks
// obviously right -- turns a 404 on a sequence file into an empty box that
// never fills, with nothing anywhere saying why; the failure is a state on the
// model rather than a throw, so there is no console error either. `error` is
// read first because `loadingMessage` goes undefined once the load stops,
// however it stopped. The Loading and error states page draws the long form of
// this, and has a radio that breaks the assembly on purpose.
const ViewStatus = observer(function ViewStatus({
  view,
}: {
  view: BrowserView
}) {
  const { error, loadingMessage } = view
  return (
    <div
      role={error ? 'alert' : 'status'}
      style={{ padding: '10px 12px', fontSize: '0.85rem', opacity: 0.75 }}
    >
      {error
        ? `Could not load: ${error instanceof Error ? error.message : String(error)}`
        : (loadingMessage ?? 'Loading')}
    </div>
  )
})

const TrackRow = observer(function TrackRow({
  view,
  trackId,
}: {
  view: BrowserView
  trackId: string
}) {
  // `view.getTrack(id)`, not a scan of `view.tracks` comparing
  // `configuration.trackId` by hand: the view keeps a map for exactly this. The
  // guard stays -- `view.ready` says the view can draw, not that your track is
  // instantiated yet.
  const track = view.getTrack(trackId)
  if (!track) {
    return null
  }
  const display = track.activeDisplay
  const { RenderingComponent } = display
  // `TrackOverlaySlot`, not a plain sized div. A display draws floating chrome
  // of its own -- a colour key, a corner control, the loading and error states
  // -- and `contain: strict` seals that into its own stacking context, where
  // nothing you paint over the stack can be out-z-indexed. The slot is the node
  // it portals into, mounted beside the sandbox, and it is what JBrowse's own
  // track container mounts. See the Track settings page.
  return (
    <TrackOverlaySlot zIndex={3} style={{ height: display.height }}>
      <div style={{ position: 'absolute', inset: 0, contain: 'strict' }}>
        <Suspense fallback={null}>
          <RenderingComponent
            model={display}
            onHorizontalScroll={view.horizontalScroll}
          />
        </Suspense>
      </div>
    </TrackOverlaySlot>
  )
})

/**
 * The prompt that makes ctrl-to-zoom discoverable, and the reason that mode is
 * usable at all: without it a wheel over the browser just does nothing visible.
 * `showZoomHint` is raised for exactly that -- a wheel the view ignored for want
 * of the modifier, *and* that the page did not scroll either, so it moved
 * nothing at all -- and clears itself. The scroll half of that gate is why this
 * doesn't flash on every wheel while a reader scrolls down the page.
 *
 * Stays mounted and fades rather than mounting on demand, so it can't flash a
 * layout change into the middle of a gesture. Needs a `position: relative`
 * container, and does not take pointer events -- it is a label, not a shield,
 * and the gesture that summoned it must keep reaching whatever is underneath.
 */
function ZoomHint({ show }: { show: boolean }) {
  return (
    <div
      aria-hidden={!show}
      style={{
        position: 'absolute',
        inset: 0,
        // over the track's own overlay layer, which `TrackRow` mounts at 3 --
        // the prompt is a caption over the whole box, so nothing the display
        // floats in its corner should sit on top of it
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        // CSS system colours, so this reads on whatever the host page is
        background: 'color-mix(in srgb, Canvas 62%, transparent)',
        color: 'CanvasText',
        fontSize: '0.95rem',
        opacity: show ? 1 : 0,
        transition: 'opacity 150ms ease',
      }}
    >
      Use ctrl + scroll to zoom
    </div>
  )
}

// A display paints no background of its own -- its labels are drawn straight
// onto whatever is behind them, so light-theme text on a dark page is near-black
// on near-black. This is the page's own answer to "which mode am I in".
function readSiteMode(): 'light' | 'dark' {
  const chosen = document.documentElement.dataset.theme
  if (chosen === 'light' || chosen === 'dark') {
    return chosen
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

// The two places that answer can change from. The site's toggle writes an
// attribute on <html> and the OS preference arrives as a media query, and
// either can move without the other, so both are watched.
function watchSiteMode(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', onChange)
  return () => {
    observer.disconnect()
    media.removeEventListener('change', onChange)
  }
}

/**
 * Follow whatever the page around this demo is themed as. All of this is the
 * *host's* half, and yours will look nothing like it -- swap it for however
 * your app already knows it is in dark mode.
 *
 * `useSyncExternalStore`, not `useState` + `useEffect`: the mode lives outside
 * React, so this reads it *during* render rather than publishing one value and
 * correcting it a paint later. The third argument is the server snapshot, for
 * a reader pasting this into a framework that prerenders.
 *
 * JBrowse's half is one call, `useSessionPalette` below. It writes the config
 * slot that *both* halves of the rendering derive from -- the palette React
 * draws with, and the theme shipped to the worker that bakes feature labels
 * into the image -- and hands back the palette. Mounting `PaletteProvider`
 * alone would leave those baked labels in the old mode.
 */
function useSiteMode() {
  return useSyncExternalStore(
    watchSiteMode,
    readSiteMode,
    () => 'light' as const,
  )
}

/**
 * The box `usePanZoom`'s handlers go on, and every page here spreads the same
 * four properties onto it.
 *
 * `touchAction: 'none'` is the one thing the hook cannot do for you, because
 * your own `style` would overwrite it. Without it the browser claims a touch
 * drag as a page scroll and the pointer stream never arrives -- so a demo that
 * works on a desktop is inert on a phone, with nothing in the console.
 *
 * `position: relative` is the frame everything a host draws over the data is
 * placed against: seams, bands, gridlines, a scalebar. `overflow: hidden`
 * because the blocks either side of the viewport really are laid out past its
 * edges. `cursor: grab` is just manners.
 */
const viewport: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  touchAction: 'none',
  cursor: 'grab',
}

const PanAndZoom = observer(function PanAndZoom({
  scrollZoom = true,
}: {
  // Which gesture a bare wheel is, to begin with; the checkbox flips it after.
  // See `makeView`.
  scrollZoom?: boolean
}) {
  const { view, session } = useCreateOnce(() => makeView(scrollZoom))
  const ref = useWidthSetter(view)
  const { containerProps, showZoomHint } = usePanZoom(ref, view)
  const palette = useSessionPalette(session, useSiteMode())

  return (
    <PaletteProvider palette={palette}>
      <div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.85rem',
            paddingBottom: 8,
          }}
        >
          <input
            type="checkbox"
            checked={view.scrollZoom}
            onChange={event => {
              view.setScrollZoom(event.target.checked)
            }}
          />
          Wheel zooms directly — off, the page scrolls and ctrl + wheel zooms
        </label>
        <div
          ref={ref}
          {...containerProps}
          style={{
            ...viewport,
            // hold the track's configured height from the first paint, so
            // nothing below it moves when the assembly finishes loading and it
            // appears
            minHeight: wiggleTrack.displayDefaults.height,
          }}
        >
          <ZoomHint show={showZoomHint} />
          {view.ready ? (
            <TrackRow view={view} trackId="volvox_microarray" />
          ) : (
            <ViewStatus view={view} />
          )}
        </div>
        <Position view={view} />
      </div>
    </PaletteProvider>
  )
})

// Reading position straight off the view, to show it is a live observable and
// not something the chrome (the UI you draw around the data) has to be told
// about.
const Position = observer(function Position({ view }: { view: BrowserView }) {
  // The gate is not optional politeness: `view.width` throws by design before
  // the view has been measured, and the block getters read it, so anything
  // reading position has to check first.
  const block = view.ready ? view.dynamicBlocks.contentBlocks[0] : undefined
  return (
    <div style={{ fontSize: '0.8rem', opacity: 0.7, paddingTop: 4 }}>
      {block
        ? `${block.refName}:${Math.floor(block.start).toLocaleString()}-${Math.ceil(block.end).toLocaleString()}  ·  ${view.bpPerPx.toFixed(2)} bp/px`
        : 'loading'}
    </div>
  )
})

export default PanAndZoom
