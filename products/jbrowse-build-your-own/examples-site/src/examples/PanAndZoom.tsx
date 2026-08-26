import { Suspense, useSyncExternalStore } from 'react'

import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'
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

const hg38 = {
  name: 'hg38',
  uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
  refNameAliases: {
    uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
  },
}

// An id and a file: `.bw` picks the adapter and the track type. One track, no
// gestures shows the same track written out.
const conservationTrack = {
  trackId: 'hg38_phylop',
  name: 'phyloP 100-way conservation',
  uri: 'https://hgdownload.soe.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
  displayDefaults: {
    defaultRendering: 'xyplot',
    height: 100,
    color: '#3a7ca5',
  },
}

function makeView(scrollZoom: boolean) {
  const state = createViewState({
    assembly: hg38,
    tracks: [conservationTrack],
    init: {
      loc: 'chr17:43,044,295..43,125,364',
      tracks: ['hg38_phylop'],
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

// `view.status` is the view's whole lifecycle as one value, so this switches on
// it rather than re-deriving which non-ready state it is out of `error` and
// `loadingMessage`. Two of the four states are easy to leave out and both fail
// silently: a 404 on a sequence file is `error` -- a state on the model rather
// than a throw, so there is no console error either -- and a view nothing has
// navigated yet is `noRegions`, which the older `view.ready` getter reports as
// ready, so gating on that one draws an empty box that never fills. The Loading
// and error states page draws the long form of this, and has a radio that
// breaks the assembly on purpose.
const ViewStatus = observer(function ViewStatus({
  view,
}: {
  view: BrowserView
}) {
  const { status } = view
  if (status.type === 'ready') {
    return null
  }
  return (
    <div
      role={status.type === 'error' ? 'alert' : 'status'}
      style={{ padding: '10px 12px', fontSize: '0.85rem', opacity: 0.75 }}
    >
      {status.type === 'error'
        ? `Could not load: ${status.error instanceof Error ? status.error.message : String(status.error)}`
        : status.type === 'loading'
          ? status.message
          : 'Nothing to show yet'}
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
  // guard stays -- a ready `view.status` says the view can draw, not that your
  // track is instantiated yet.
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
 * JBrowse's half is one mount, `SessionPaletteProvider` below. It writes the
 * config slot that *both* halves of the rendering derive from -- the palette
 * React draws with, and the theme shipped to the worker that bakes feature
 * labels into the image. `PaletteProvider` on its own is the near miss: it
 * colours React and leaves those baked labels in the old mode.
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
 * three properties onto it.
 *
 * `touchAction: 'none'` is NOT among them, and used to be: the hook writes it
 * onto the element itself. Without it the browser claims a touch drag as a page
 * scroll and the pointer stream never arrives, so a demo that works on a
 * desktop is inert on a phone with nothing in the console -- which is a bad
 * thing to leave to a line of documentation. Name `touchAction` in your own
 * `style` and yours wins, or pass `usePanZoom` a `touchAction` of `'pan-y'` if
 * this sits in a long document that should still scroll.
 *
 * `position: relative` is the frame everything a host draws over the data is
 * placed against: seams, bands, gridlines, a scalebar. `overflow: hidden`
 * because the blocks either side of the viewport really are laid out past its
 * edges. `cursor: grab` is just manners.
 */
const viewport: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
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
  const { containerProps } = usePanZoom(ref, view)
  const mode = useSiteMode()

  return (
    <SessionPaletteProvider session={session} mode={mode}>
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
            minHeight: conservationTrack.displayDefaults.height,
          }}
        >
          {view.status.type === 'ready' ? (
            <TrackRow view={view} trackId="hg38_phylop" />
          ) : (
            <ViewStatus view={view} />
          )}
        </div>
        <Position view={view} />
      </div>
    </SessionPaletteProvider>
  )
})

// Reading position straight off the view, to show it is a live observable and
// not something the chrome (the UI you draw around the data) has to be told
// about.
const Position = observer(function Position({ view }: { view: BrowserView }) {
  // The gate is not optional politeness: `view.width` throws by design before
  // the view has been measured, and the block getters read it, so anything
  // reading position has to check first.
  const block =
    view.status.type === 'ready'
      ? view.dynamicBlocks.contentBlocks[0]
      : undefined
  return (
    <div style={{ fontSize: '0.8rem', opacity: 0.7, paddingTop: 4 }}>
      {block
        ? `${block.refName}:${Math.floor(block.start).toLocaleString()}-${Math.ceil(block.end).toLocaleString()}  ·  ${view.bpPerPx.toFixed(2)} bp/px`
        : 'loading'}
    </div>
  )
})

export default PanAndZoom
