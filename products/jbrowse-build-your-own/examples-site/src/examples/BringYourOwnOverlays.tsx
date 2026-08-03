import { Suspense, useEffect, useMemo, useRef, useState } from 'react'

import { setConf } from '@jbrowse/core/configuration'
import { PaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { normalizeWheelDelta } from '@jbrowse/core/util/wheelZoom'
import {
  DisplayChromeOverlayProvider,
  plainChromeOverlays,
} from '@jbrowse/plugin-linear-genome-view'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// Every display draws its loading scrim, error bar, too-large banner and render
// error through five swappable components. By default those are JBrowse's own,
// which are Material UI. `DisplayChromeOverlayProvider` replaces the set for
// everything below it, so JBrowse's stock wiggle and feature displays render
// their status states with your markup instead.
//
// The third track points at a URL that does not exist. That is deliberate: the
// error state is the easiest one to hold still and look at. Toggle the switch
// and watch it change from a Material `<Alert>` to plain markup you could
// restyle with your own CSS.
//
// Two seams, for two different problems:
//
//   this provider     -- reach.  Redirects JBrowse's own displays, which import
//                        DisplayChrome directly and so cannot be redirected at
//                        the import level. MUI still ends up in the bundle, it
//                        just never renders.
//   DisplayChromeBase -- weight. Takes `overlays` as a prop and imports no
//                        toolkit at all, so MUI never enters the graph.
//                        Available when you write your own display component.
//
// Self-contained: the parts from the earlier pages are repeated here rather
// than imported, so this file runs on its own.

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

const featureTrack = {
  type: 'FeatureTrack',
  trackId: 'volvox_genes',
  name: 'Genes',
  assemblyNames: ['volvox'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
  },
  displayDefaults: { height: 120 },
}

const brokenTrack = {
  type: 'QuantitativeTrack',
  trackId: 'volvox_broken',
  name: 'A track that fails to load',
  assemblyNames: ['volvox'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/does-not-exist.bw',
  },
  displayDefaults: { height: 80 },
}

const trackIds = ['volvox_microarray', 'volvox_genes', 'volvox_broken']

function makeView() {
  const state = createViewState({
    assembly: volvox,
    tracks: [wiggleTrack, featureTrack, brokenTrack],
  })
  const { view } = state.session
  view.setInit({
    assembly: volvox.name,
    loc: 'ctgA:1..20,000',
    tracks: trackIds,
  })
  // see the Pan and zoom page: scroll-to-zoom is a session preference, shared
  // with any display that scrolls vertically inside itself
  view.setScrollZoom(true)
  return { view, session: state.session }
}

type BrowserView = ReturnType<typeof makeView>['view']
type BrowserSession = ReturnType<typeof makeView>['session']

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

// see the Pan and zoom page for why the wheel listener is native and
// non-passive, for what `scrollZoom` decides, and for why shift+wheel is left
// to whatever is under the cursor
function wheelPanZoom(
  view: BrowserView,
  el: HTMLElement,
  { scrollZoom, onNeedsCtrl }: { scrollZoom: boolean; onNeedsCtrl: () => void },
) {
  return (event: WheelEvent) => {
    if (event.shiftKey && scrollZoom) {
      return
    }
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
      onNeedsCtrl()
    }
  }
}

const HINT_LINGER_MS = 1200

// how far a press has to travel before it counts as a pan rather than a click;
// see the Pan and zoom page
const DRAG_THRESHOLD_PX = 4

function usePanZoom(
  view: BrowserView,
  ref: React.RefObject<HTMLDivElement | null>,
) {
  const dragging = useRef<{ x: number; panning: boolean } | undefined>(
    undefined,
  )
  const [hint, setHint] = useState(false)
  const { scrollZoom } = view

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
    props: {
      onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
        // see the Pan and zoom page for both halves of this: why a press on a
        // control (here, the track-sizing button each display draws in its
        // corner) must not start a drag, and why the pointer is captured on
        // move rather than here
        if (
          event.target instanceof Element &&
          event.target.closest('button, [data-gesture-owner]')
        ) {
          return
        }
        if (event.button === 0) {
          dragging.current = { x: event.clientX, panning: false }
        }
      },
      onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
        const drag = dragging.current
        if (!drag) {
          return
        }
        if (!drag.panning) {
          if (Math.abs(event.clientX - drag.x) < DRAG_THRESHOLD_PX) {
            return
          }
          drag.panning = true
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        view.horizontalScroll(drag.x - event.clientX)
        drag.x = event.clientX
      },
      onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
        dragging.current = undefined
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      },
      onPointerCancel(event: React.PointerEvent<HTMLDivElement>) {
        dragging.current = undefined
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      },
    },
  }
}

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

const TrackStack = observer(function TrackStack({
  view,
}: {
  view: BrowserView
}) {
  const ref = useViewWidth(view)
  const { hint, props } = usePanZoom(view, ref)
  return (
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
      {isViewReady(view)
        ? trackIds.map(trackId => (
            <TrackRow key={trackId} view={view} trackId={trackId} />
          ))
        : null}
    </div>
  )
})

/**
 * The page around this demo has a light/dark toggle. JBrowse needs to be told,
 * because a display paints no background of its own: its labels are drawn
 * straight onto whatever is behind them, so light-theme text on a dark page is
 * near-black on near-black.
 *
 * The toggle writes an attribute on <html>, and the OS preference arrives as a
 * media query. Either can move without the other, so watch both.
 */
function readSiteMode(): 'light' | 'dark' {
  const chosen = document.documentElement.dataset.theme
  if (chosen === 'light' || chosen === 'dark') {
    return chosen
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function useSiteMode() {
  const [mode, setMode] = useState(readSiteMode)
  useEffect(() => {
    const update = () => {
      setMode(readSiteMode())
    }
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', update)
    return () => {
      observer.disconnect()
      media.removeEventListener('change', update)
    }
  }, [])
  return mode
}

/**
 * Write the mode onto the session's config theme, and read the resolved colors
 * back off the session.
 *
 * One write rather than two. The config theme is what the display ships to the
 * renderer, so the feature labels baked there follow it, and `session.palette`
 * is derived from the same slot, so what React draws follows it too. Setting
 * only a React-side palette would leave the labels behind.
 */
function useSitePalette(session: BrowserSession) {
  const mode = useSiteMode()
  useEffect(() => {
    setConf(session, 'theme', { palette: { mode } })
  }, [session, mode])
  return session.palette
}

// The palette is NOT what the checkbox swaps. JBrowse's stock displays read it
// for their own content colours (the feature display wants a highlight colour),
// so a feature track needs it whatever the overlays are. See the previous page.

const BringYourOwnOverlays = observer(function BringYourOwnOverlays() {
  const [plain, setPlain] = useState(true)
  const { view, session } = useMemo(() => makeView(), [])
  const palette = useSitePalette(session)

  const stack = (
    <PaletteProvider palette={palette}>
      <TrackStack view={view} />
    </PaletteProvider>
  )

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
          checked={plain}
          onChange={event => {
            setPlain(event.target.checked)
          }}
        />
        Use my own overlays instead of JBrowse&rsquo;s Material UI ones
      </label>
      {plain ? (
        <DisplayChromeOverlayProvider value={plainChromeOverlays}>
          {stack}
        </DisplayChromeOverlayProvider>
      ) : (
        stack
      )}
    </div>
  )
})

export default BringYourOwnOverlays
