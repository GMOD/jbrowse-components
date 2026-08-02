import { Suspense, useEffect, useRef, useState } from 'react'

import { normalizeWheelDelta } from '@jbrowse/core/util/wheelZoom'
import { observer } from 'mobx-react'

import type { BrowserView } from './engine.ts'

// The four parts a linear genome browser needs above the engine. Each is small
// on purpose: the point of these examples is that you can read all of them, and
// then keep the ones you want.
//
//   useViewWidth  -- tell the view how many pixels it has
//   isViewReady   -- don't draw before there is anything to draw
//   TrackRow      -- mount one track's display
//   usePanZoom    -- turn wheel and drag into navigation
//   ZoomHint      -- the ctrl-to-zoom prompt, for the non-default wheel mode
//   TrackStack    -- the parts above, composed
//
// Everything JBrowse's own linear-genome-view adds on top of this (the search
// box, the ruler, the overview scalebar, track labels, drag-to-reorder, the
// rubberband, highlights) is chrome. Useful chrome, but chrome, and none of it
// is required to put genomic data on screen.

/**
 * A view renders nothing until it knows its width in pixels, and it needs to be
 * told again whenever that changes. This is the one piece of wiring with no
 * alternative: everything downstream (block layout, what to fetch, bpPerPx on a
 * zoom-to-fit) is derived from it.
 */
export function useViewWidth(view: BrowserView) {
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

/**
 * Is there anything to draw yet?
 *
 * The obvious gate is `view.initialized`, and on its own it is the wrong one.
 * That getter answers "have the assembly's regions loaded", which is only the
 * first of two async steps: navigating (what `setInit` in engine.ts asks for)
 * then populates `displayedRegions`, and in the window between the two
 * `initialized` is already true while there is still nothing on screen. Mount a
 * display into that window and its `pxToBp`/block reads run against no regions.
 *
 * `showLoading` is the view's own composite of both halves -- it folds in
 * `initPending`, the getter that exists for exactly that gap -- and it is what
 * JBrowse's own `LinearGenomeView` component branches on. Read it rather than
 * reassembling the condition, and it stays correct if the sequencing changes.
 *
 * `error` is the third outcome: a failed assembly load also ends the loading
 * state, so a bare `!showLoading` would mount over the wreckage. These examples
 * just draw nothing; a real app renders `view.error` here.
 */
export function isViewReady(view: BrowserView) {
  return !view.showLoading && !view.error
}

/**
 * One track. `activeDisplay` is the model that actually draws, and
 * `RenderingComponent` is its React component -- for a wiggle track that is the
 * canvas plus its y-axis, for alignments the pileup plus its scrollbar.
 *
 * The wrapper only supplies height and a positioning context. `contain: strict`
 * clips the display to its box, which matters because displays draw overlays
 * absolutely and would otherwise paint over their neighbours.
 *
 * Suspense because `RenderingComponent` is lazy in every plugin.
 */
export const TrackRow = observer(function TrackRow({
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
 * Navigation. The view already owns the maths -- `horizontalScroll` clamps to
 * the ends of the displayed regions, `zoomTo` clamps to the assembly's limits
 * and keeps a chosen pixel anchored -- so this only has to turn events into
 * calls.
 *
 * Zoom anchors on the cursor rather than the centre, which is what makes it
 * feel like a map instead of a slider. Pass the pixel offset of the pointer
 * within the container as `zoomTo`'s second argument and the bp under the
 * cursor stays put.
 *
 * Takes the same `ref` you gave the container, because the wheel half has to be
 * bound to the element directly -- see below. Returns the pointer handlers to
 * spread on that container, plus `hint`: pass it to `ZoomHint` to render the
 * ctrl prompt, which never fires while `scrollZoom` is on.
 */
export function usePanZoom(
  view: BrowserView,
  ref: React.RefObject<HTMLDivElement | null>,
  { scrollZoom = true }: { scrollZoom?: boolean } = {},
) {
  const dragging = useRef<number | undefined>(undefined)
  const [hint, setHint] = useState(false)

  // Wheel is a native listener rather than React's `onWheel` prop, and that is
  // not a style preference. React registers `wheel` at the root as a *passive*
  // listener, so a handler installed through the prop cannot call
  // `preventDefault`, and the gesture would scroll or zoom the browser page out
  // from under you at the same time as it drove the view. `{ passive: false }`
  // on the element is the only way to claim it. JBrowse's own view does the
  // same thing, via `createWheelZoomController`.
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
export function ZoomHint({ show }: { show: boolean }) {
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

/**
 * The three parts above, composed: a measured, pan/zoomable column of tracks
 * and nothing else. This is the smallest thing that is recognisably a genome
 * browser.
 */
const TrackStack = observer(function TrackStack({
  view,
  trackIds,
  scrollZoom,
  style,
}: {
  view: BrowserView
  trackIds: string[]
  scrollZoom?: boolean
  style?: React.CSSProperties
}) {
  const ref = useViewWidth(view)
  const { hint, props } = usePanZoom(view, ref, { scrollZoom })
  return (
    <div
      ref={ref}
      {...props}
      style={{
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'none',
        ...style,
      }}
    >
      <ZoomHint show={hint} />
      {isViewReady(view)
        ? trackIds.map(trackId => (
            <TrackRow key={trackId} view={view} trackId={trackId} />
          ))
        : null}
    </div>
  )
})

export default TrackStack
