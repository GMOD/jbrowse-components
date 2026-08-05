import { Suspense, useEffect, useRef, useState } from 'react'

import { normalizeWheelDelta } from '@jbrowse/core/util/wheelZoom'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// Drag to pan, wheel to zoom, shift+wheel to scroll sideways.
//
// The view already clamps to the ends of the assembly and to its own zoom
// limits, and `zoomTo` keeps a chosen pixel anchored, so the handlers below are
// only translating events into calls.
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
  // scroll-to-zoom is a *session* preference, off by default, and the displays
  // read it too -- see the note on `wheelPanZoom`. Set it here, not in a piece
  // of React state of your own.
  view.setScrollZoom(scrollZoom)
  return view
}

type BrowserView = ReturnType<typeof makeView>

function useViewWidth(view: BrowserView) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      if (w > 0) {
        view.setWidth(w)
      }
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
    }
  }, [view])
  return ref
}

// see the One track page for why this is not `view.initialized`
function isViewReady(view: BrowserView) {
  return !view.showLoading && !view.error
}

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
 * The wheel half of `usePanZoom`, as a plain factory so the handler closes over
 * the element rather than reaching for a ref.
 *
 * Two gestures, and which one a bare wheel means is the `scrollZoom` decision:
 *
 *   scrollZoom on   -- wheel zooms, the way a map does. Direct, and the right
 *                      default when the browser owns its area of the page.
 *   scrollZoom off  -- wheel scrolls the page and only ctrl/cmd+wheel zooms.
 *                      Right when the browser is one element in a long
 *                      document, where a wheel that silently swallowed the
 *                      page scroll would trap the reader.
 *
 * The second mode has a well-known failure: the user wheels, nothing zooms, and
 * there is no way to discover why. `onNeedsCtrl` is the fix Google Maps uses --
 * say so, on the element, at the moment it happens.
 *
 * **Read `scrollZoom` off the view, don't invent your own copy.** Some displays
 * scroll vertically inside themselves -- an alignments pileup is the one you
 * will hit first -- and their own wheel handler consults the very same
 * `view.scrollZoom` to decide whether the plain wheel is already spoken for. A
 * private `useState` here that disagrees with the session gets you both at once:
 * the pileup scrolls its reads *and* the view zooms under the cursor.
 *
 * That handoff is also what the shift bail below is for. With scrolling-zoom on,
 * the plain wheel is taken, so shift+wheel is what those inner panels scroll
 * with, and this handler has to keep its hands off it. With scrolling-zoom off
 * the plain wheel is free, and shift+wheel falls through to the pan branch --
 * browsers report it as a horizontal delta. JBrowse's own view draws the line in
 * exactly the same place.
 */
function wheelPanZoom(
  view: BrowserView,
  el: HTMLElement,
  { scrollZoom, onNeedsCtrl }: { scrollZoom: boolean; onNeedsCtrl: () => void },
) {
  return (event: WheelEvent) => {
    if (event.shiftKey && scrollZoom) {
      return
    }
    // deltas arrive in pixels, lines or pages depending on browser and device;
    // without this a Firefox notch pans a fraction of a Chrome one
    const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode)
    const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode)
    const ctrlZoom = event.ctrlKey || event.metaKey
    if (ctrlZoom || (scrollZoom && Math.abs(deltaY) >= Math.abs(deltaX))) {
      event.preventDefault()
      if (deltaY !== 0) {
        const rect = el.getBoundingClientRect()
        view.zoomTo(
          view.bpPerPx * (deltaY > 0 ? 1.1 : 1 / 1.1),
          event.clientX - rect.left,
        )
      }
    } else if (Math.abs(deltaX) > Math.abs(deltaY)) {
      event.preventDefault()
      view.horizontalScroll(deltaX)
    } else if (deltaY !== 0) {
      // scrollZoom is off and ctrl wasn't held. Deliberately no
      // preventDefault -- the page scroll is the point of this mode -- but the
      // user just tried to do something, so tell them what it would have taken.
      onNeedsCtrl()
    }
  }
}

// How long the ctrl hint stays up after the last wheel event. Long enough to
// read four words, short enough that it is gone before the next gesture.
const HINT_LINGER_MS = 1200

// How far the pointer has to travel before a press counts as a pan rather than
// a click. See `onPointerMove`: under this, the gesture is still a click and
// the track underneath gets to keep it.
const DRAG_THRESHOLD_PX = 4

/**
 * Navigation. Zoom anchors on the cursor rather than the centre, which is what
 * makes it feel like a map instead of a slider: pass the pixel offset of the
 * pointer within the container as `zoomTo`'s second argument and the bp under
 * the cursor stays put.
 *
 * Takes the same `ref` you gave the container, because the wheel half has to be
 * bound to the element directly -- see below. Returns the pointer handlers to
 * spread on that container, plus `hint`: pass it to `ZoomHint` to render the
 * ctrl prompt, which never fires while `scrollZoom` is on.
 */
function usePanZoom(
  view: BrowserView,
  ref: React.RefObject<HTMLDivElement | null>,
) {
  // `x` is the last position the pan was applied from; `panning` is whether the
  // press has travelled far enough to be a drag at all
  const draggingRef = useRef<{ x: number; panning: boolean } | undefined>(
    undefined,
  )
  const [hint, setHint] = useState(false)
  // observable, so flipping the preference re-runs the effect below and every
  // display picks up the same flip in the same render
  const { scrollZoom } = view

  // Wheel is a native listener rather than React's `onWheel` prop, and that is
  // not a style preference. React registers `wheel` at the root as a *passive*
  // listener, so a handler installed through the prop cannot call
  // `preventDefault`, and the gesture would drive the browser page out from
  // under you at the same time as it drove the view. `{ passive: false }` on
  // the element is the only way to claim it. JBrowse's own view does the same
  // thing, via `createWheelZoomController`.
  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const onWheel = wheelPanZoom(view, el, {
      scrollZoom,
      onNeedsCtrl() {
        setHint(true)
        clearTimeout(timer)
        timer = setTimeout(() => {
          setHint(false)
        }, HINT_LINGER_MS)
      },
    })
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      clearTimeout(timer)
    }
  }, [view, ref, scrollZoom])

  return {
    hint,
    // spread onto the same element `ref` is on
    props: {
      onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
        // Leave the press alone when it lands on a control: a control that
        // claimed the press (`[data-gesture-owner]`, JBrowse's marker on the
        // parts that drag on their own -- a display's vertical scrollbar,
        // resize handles) or a button, such as the track-sizing button a
        // display draws in its own corner. `closest` because the press usually
        // lands on an icon inside the control. JBrowse's own click-drag pan
        // skips exactly these.
        if (
          event.target instanceof Element &&
          event.target.closest('button, [data-gesture-owner]')
        ) {
          return
        }
        // primary button only, so a right-click or a context menu doesn't pan.
        // Note what this does *not* do: capture the pointer. See below.
        if (event.button === 0) {
          draggingRef.current = { x: event.clientX, panning: false }
        }
      },
      onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
        const drag = draggingRef.current
        if (!drag) {
          return
        }
        if (!drag.panning) {
          if (Math.abs(event.clientX - drag.x) < DRAG_THRESHOLD_PX) {
            return
          }
          // Past the threshold this is a pan, so take the pointer: the gesture
          // has to keep panning when the cursor leaves the container, and end
          // even if it is released outside the window.
          //
          // Capturing is deferred to here because it retargets the whole rest
          // of the gesture -- including the `click` that ends it -- at this
          // element. Capture on `pointerdown` instead and every click inside
          // the browser lands on this div, so nothing underneath ever sees one:
          // a display's click-to-select-a-feature stops selecting. A press that
          // never moves never captures, and stays the click it looks like.
          drag.panning = true
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        view.horizontalScroll(drag.x - event.clientX)
        drag.x = event.clientX
      },
      // pointercancel as well as pointerup: a touch drag interrupted by the
      // browser never fires `up`, and the drag would stay latched
      onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
        draggingRef.current = undefined
        // release only what the move handler took -- a press that stayed under
        // the threshold never captured anything
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      },
      onPointerCancel(event: React.PointerEvent<HTMLDivElement>) {
        draggingRef.current = undefined
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      },
    },
  }
}

/**
 * The prompt that makes ctrl-to-zoom discoverable, and the reason the mode is
 * usable at all: without it a wheel over the browser just does nothing visible.
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
  // On by default, because a browser that owns its area of the page should zoom
  // the way a map does. Pass `false` when it sits partway down a longer
  // document, where a wheel that swallowed the page scroll would trap the
  // reader -- see the note on `wheelPanZoom`.
  scrollZoom?: boolean
}) {
  const [view] = useState(() => makeView(scrollZoom))
  const ref = useViewWidth(view)
  const { hint, props } = usePanZoom(view, ref)

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
        {...props}
        style={{
          position: 'relative',
          overflow: 'hidden',
          touchAction: 'none',
          cursor: 'grab',
        }}
      >
        <ZoomHint show={hint} />
        {isViewReady(view) ? (
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
  const block = isViewReady(view)
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
