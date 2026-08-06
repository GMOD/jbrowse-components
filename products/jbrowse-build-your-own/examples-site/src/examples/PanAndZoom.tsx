import { Suspense, useState } from 'react'

import { useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
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
// Self-contained, like every page here: nothing is imported from elsewhere in
// this site, so this file runs on its own. The One track page repeats the
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
  })
  const { view } = state.session
  view.setInit({
    assembly: volvox.name,
    loc: 'ctgA:1..50,000',
    tracks: ['volvox_microarray'],
  })
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
  return view
}

type BrowserView = ReturnType<typeof makeView>

const TrackRow = observer(function TrackRow({
  view,
  trackId,
}: {
  view: BrowserView
  trackId: string
}) {
  const track = view.tracks.find(t => t.configuration.trackId === trackId)
  if (!track) {
    return null
  }
  const display = track.activeDisplay
  const { RenderingComponent } = display
  return (
    <div
      style={{
        position: 'relative',
        height: display.height,
        contain: 'strict',
      }}
    >
      <Suspense fallback={null}>
        <RenderingComponent
          model={display}
          onHorizontalScroll={view.horizontalScroll}
        />
      </Suspense>
    </div>
  )
})

/**
 * The prompt that makes ctrl-to-zoom discoverable, and the reason that mode is
 * usable at all: without it a wheel over the browser just does nothing visible.
 * `showZoomHint` is raised for exactly that -- a wheel the view ignored because
 * the modifier wasn't held -- and clears itself.
 *
 * Stays mounted and fades rather than mounting on demand, so it can't flash a
 * layout change into the middle of a gesture. Needs a `position: relative`
 * container, and does not take pointer events -- it is a label, not a shield,
 * and the wheel that summoned it is still scrolling the page underneath.
 */
function ZoomHint({ show }: { show: boolean }) {
  return (
    <div
      aria-hidden={!show}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 3,
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

const PanAndZoom = observer(function PanAndZoom({
  scrollZoom = true,
}: {
  // Which gesture a bare wheel is, to begin with; the checkbox flips it after.
  // See `makeView`.
  scrollZoom?: boolean
}) {
  const [view] = useState(() => makeView(scrollZoom))
  const ref = useWidthSetter(view)
  const { containerProps, showZoomHint } = usePanZoom(ref, view)

  return (
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
          position: 'relative',
          overflow: 'hidden',
          // your half of the deal: without it the browser claims a touch-drag
          // as a page scroll and the pointer stream never arrives
          touchAction: 'none',
          cursor: 'grab',
          // hold the track's configured height from the first paint, so nothing
          // below it moves when the assembly finishes loading and it appears
          minHeight: wiggleTrack.displayDefaults.height,
        }}
      >
        <ZoomHint show={showZoomHint} />
        {view.ready ? (
          <TrackRow view={view} trackId="volvox_microarray" />
        ) : null}
      </div>
      <Position view={view} />
    </div>
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
