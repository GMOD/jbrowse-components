import { Suspense, useEffect, useMemo, useRef, useState } from 'react'

import { normalizeWheelDelta } from '@jbrowse/core/util/wheelZoom'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// Drag to pan, wheel to zoom, shift+wheel to scroll sideways.
//
// The view already clamps to the ends of the assembly and to its own zoom
// limits, and `zoomTo` keeps a chosen pixel anchored, so the handlers below are
// only translating events into calls.
//
// Self-contained, like every page here: the engine and the mounting parts from
// the previous example are repeated rather than imported, so this file runs on
// its own.

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

function makeView() {
  const state = createViewState({
    assembly: volvox,
    tracks: [wiggleTrack] as never,
  })
  const { view } = state.session
  view.setInit({
    assembly: volvox.name,
    loc: 'ctgA:1..50,000',
    tracks: ['volvox_microarray'],
  })
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
      style={{ position: 'relative', height: display.height, contain: 'strict' }}
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
 * shift+wheel stays an escape hatch in both modes: browsers report it as a
 * horizontal delta, so it falls through to the pan branch.
 */
function wheelPanZoom(
  view: BrowserView,
  el: HTMLElement,
  { scrollZoom, onNeedsCtrl }: { scrollZoom: boolean; onNeedsCtrl: () => void },
) {
  return (event: WheelEvent) => {
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
  { scrollZoom = true }: { scrollZoom?: boolean } = {},
) {
  const dragging = useRef<number | undefined>(undefined)
  const [hint, setHint] = useState(false)

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
        // primary button only, so a right-click or a context menu doesn't pan
        if (event.button === 0) {
          dragging.current = event.clientX
          event.currentTarget.setPointerCapture(event.pointerId)
        }
      },
      onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
        const from = dragging.current
        if (from !== undefined) {
          view.horizontalScroll(from - event.clientX)
          dragging.current = event.clientX
        }
      },
      // pointercancel as well as pointerup: a touch drag interrupted by the
      // browser never fires `up`, and the drag would stay latched
      onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
        dragging.current = undefined
        event.currentTarget.releasePointerCapture(event.pointerId)
      },
      onPointerCancel(event: React.PointerEvent<HTMLDivElement>) {
        dragging.current = undefined
        event.currentTarget.releasePointerCapture(event.pointerId)
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

const PanAndZoom = observer(function PanAndZoom() {
  const view = useMemo(() => makeView(), [])
  // `scrollZoom` is on by default, because a browser that owns its area of the
  // page should zoom the way a map does. Uncheck to see the other mode.
  const [scrollZoom, setScrollZoom] = useState(true)
  const ref = useViewWidth(view)
  const { hint, props } = usePanZoom(view, ref, { scrollZoom })

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
          checked={scrollZoom}
          onChange={event => {
            setScrollZoom(event.target.checked)
          }}
        />
        Wheel zooms directly (uncheck to require ctrl, and see the prompt)
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
// not something the chrome has to be told about.
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
