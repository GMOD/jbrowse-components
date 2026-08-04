import { Suspense, useEffect, useMemo, useRef, useState } from 'react'

import { setConf } from '@jbrowse/core/configuration'
import { PaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { normalizeWheelDelta } from '@jbrowse/core/util/wheelZoom'
import {
  DisplayChromeOverlayProvider,
  TrackControlProvider,
  plainChromeOverlays,
  plainTrackControl,
} from '@jbrowse/plugin-linear-genome-view'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// The other direction from the mouse: your app tells the browser where to go
// and what to show, and reads back where it ended up.
//
// Everything below the toolbar is the previous pages. The toolbar is four calls
// -- `navToLocString`, `zoom`, `showTrack`, `hideTrack` -- and one getter,
// `coarseVisibleLocStrings`. None of it is a JBrowse component; the point of
// the page is that driving the view is a normal API, so a location box in your
// app's own header works exactly as well as one inside a genome browser.
//
// Self-contained, like every page here: nothing below is imported from the rest
// of this site, so you can copy the file and run it.

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

const alignmentsTrack = {
  type: 'AlignmentsTrack',
  trackId: 'volvox_bam',
  name: 'Reads',
  assemblyNames: ['volvox'],
  adapter: {
    type: 'BamAdapter',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-sorted.bam',
  },
  displayDefaults: { height: 150 },
}

// The catalogue the checkboxes render. This is your app's list, not JBrowse's:
// what is *shown* lives on the view (`view.tracks`), and the checkbox state is
// read back off it below rather than kept in React state.
const catalogue = [
  { id: 'volvox_microarray', label: 'Microarray' },
  { id: 'volvox_genes', label: 'Genes' },
  { id: 'volvox_bam', label: 'Reads' },
]

// Somewhere to send the reader that isn't "type a locstring and hope". Real
// apps usually have this list already -- a gene of interest, a saved view, the
// row someone clicked in a table next to the browser.
const bookmarks = [
  { label: 'EDEN', loc: 'ctgA:1,050..9,000' },
  { label: 'A whole contig', loc: 'ctgA' },
  { label: 'Two regions at once', loc: 'ctgA:1..8000 ctgB:1..4000' },
]

function makeView() {
  const state = createViewState({
    assembly: volvox,
    tracks: [wiggleTrack, featureTrack, alignmentsTrack],
  })
  const { view } = state.session
  view.setInit({
    assembly: volvox.name,
    loc: 'ctgA:1..20,000',
    tracks: ['volvox_microarray', 'volvox_genes'],
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
  const draggingRef = useRef<{ x: number; panning: boolean } | undefined>(
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
          drag.panning = true
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        view.horizontalScroll(drag.x - event.clientX)
        drag.x = event.clientX
      },
      onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
        draggingRef.current = undefined
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

/**
 * A location box.
 *
 * `navToLocString` takes what a user would type -- `ctgA`, `ctgA:1,050..9,000`,
 * two regions separated by a space -- and does the rest: it waits for the
 * assembly, resolves the reference name (including aliases, so `chr1` finds a
 * `1`), replaces `displayedRegions` if the new location needs different ones,
 * and clamps the zoom. It is `async` for the assembly wait, and it **throws**
 * on anything it cannot resolve, so a box that does not catch will look like it
 * silently ignored a typo.
 *
 * The interesting part is which way the value flows. The view is the source of
 * truth, and it moves constantly -- every pan frame changes the location -- so
 * the box shows `coarseVisibleLocStrings`, which recomputes on a 500ms tick
 * rather than per frame. (`visibleLocStrings` is the live one. Rendering *that*
 * into an input re-renders the box on every frame of a drag, for a number no
 * one can read mid-gesture.)
 *
 * While the user is typing, that has to stop: a value arriving from a pan would
 * overwrite what they are halfway through. So a keystroke parks a `draft`, and
 * submitting or escaping drops it, which hands the box back to the view. That
 * is the whole trick to a control that is both live and editable.
 */
const LocationBox = observer(function LocationBox({
  view,
}: {
  view: BrowserView
}) {
  const [draft, setDraft] = useState<string | undefined>(undefined)
  const [error, setError] = useState<unknown>(undefined)
  const shown = view.coarseVisibleLocStrings

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <form
        style={{ display: 'flex', gap: 4 }}
        onSubmit={event => {
          event.preventDefault()
          setError(undefined)
          view
            .navToLocString(draft ?? shown)
            .then(() => {
              setDraft(undefined)
            })
            .catch((e: unknown) => {
              setError(e)
            })
        }}
      >
        <input
          aria-label="Location"
          value={draft ?? shown}
          size={26}
          style={{
            fontFamily: 'inherit',
            fontSize: '0.85rem',
            padding: '2px 4px',
          }}
          onChange={event => {
            setDraft(event.target.value)
          }}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              setDraft(undefined)
              setError(undefined)
            }
          }}
        />
        <button type="submit">Go</button>
      </form>
      {error ? (
        <span role="alert" style={{ fontSize: '0.75rem', color: '#d97706' }}>
          {error instanceof Error ? error.message : String(error)}
        </span>
      ) : null}
    </div>
  )
})

/**
 * Zoom buttons.
 *
 * `zoom(targetBpPerPx)` is the animated one, and it is what the buttons in
 * JBrowse's own header call: it eases to the target over a few frames and
 * yields immediately if anything else moves the view, so a click during a
 * wheel-zoom doesn't fight it. `zoomTo` -- what the wheel handler above uses --
 * is the same move without the animation.
 *
 * Neither needs a range check. The view clamps to `minBpPerPx`/`maxBpPerPx`,
 * which it derives from the assembly, so "zoom out" at the whole-genome end is
 * a no-op rather than an error.
 */
const ZoomButtons = observer(function ZoomButtons({
  view,
}: {
  view: BrowserView
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <button
        type="button"
        aria-label="Zoom out"
        onClick={() => {
          view.zoom(view.bpPerPx * 2)
        }}
      >
        −
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        onClick={() => {
          view.zoom(view.bpPerPx / 2)
        }}
      >
        +
      </button>
    </div>
  )
})

/**
 * Show and hide tracks.
 *
 * `showTrack(trackId)` instantiates the track and its display from the config
 * of that id and appends it to `view.tracks`; `hideTrack(trackId)` removes it,
 * which disposes the display and everything it had on the GPU. Adding a track
 * to the *config* is a separate thing -- these two only turn on what is already
 * declared.
 *
 * The checkbox reads `view.tracks` rather than a `useState` next to it. There
 * is no way for the two to disagree that way, which matters as soon as anything
 * else can show a track: a bookmark that arrives with its own track list, a
 * saved session, a second panel in your app.
 */
const TrackToggles = observer(function TrackToggles({
  view,
}: {
  view: BrowserView
}) {
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: '0.85rem' }}>
      {catalogue.map(({ id, label }) => {
        const shown = view.tracks.some(t => t.configuration.trackId === id)
        return (
          <label
            key={id}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <input
              type="checkbox"
              checked={shown}
              onChange={() => {
                if (shown) {
                  view.hideTrack(id)
                } else {
                  view.showTrack(id)
                }
              }}
            />
            {label}
          </label>
        )
      })}
    </div>
  )
})

/**
 * Jump somewhere, and bring a track list with you.
 *
 * Two calls in one handler, and the order matters only in that `showTrack` is
 * synchronous while `navToLocString` is not -- so the tracks are up before the
 * navigation resolves, and they fetch once, for the destination, rather than
 * once for here and again for there.
 */
const Bookmarks = observer(function Bookmarks({ view }: { view: BrowserView }) {
  return (
    <div style={{ display: 'flex', gap: 4, fontSize: '0.85rem' }}>
      {bookmarks.map(({ label, loc }) => (
        <button
          key={label}
          type="button"
          onClick={() => {
            if (
              !view.tracks.some(t => t.configuration.trackId === 'volvox_genes')
            ) {
              view.showTrack('volvox_genes')
            }
            view.navToLocString(loc).catch((e: unknown) => {
              console.error(e)
            })
          }}
        >
          {label}
        </button>
      ))}
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
 * back off the session. See the Bring your own overlays page for why this is
 * one write rather than two.
 */
function useSitePalette(session: BrowserSession) {
  const mode = useSiteMode()
  useEffect(() => {
    setConf(session, 'theme', { palette: { mode } })
  }, [session, mode])
  return session.palette
}

const DriveItFromYourApp = observer(function DriveItFromYourApp() {
  const { view, session } = useMemo(() => makeView(), [])
  const ref = useViewWidth(view)
  const { hint, props } = usePanZoom(view, ref)
  const palette = useSitePalette(session)

  return (
    <PaletteProvider palette={palette}>
      <DisplayChromeOverlayProvider value={plainChromeOverlays}>
        <TrackControlProvider value={plainTrackControl}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              gap: 12,
              paddingBottom: 8,
            }}
          >
            <LocationBox view={view} />
            <ZoomButtons view={view} />
            <Bookmarks view={view} />
            <TrackToggles view={view} />
          </div>
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
              ? view.tracks.map(track => (
                  <TrackRow
                    key={track.configuration.trackId}
                    view={view}
                    trackId={track.configuration.trackId}
                  />
                ))
              : null}
          </div>
        </TrackControlProvider>
      </DisplayChromeOverlayProvider>
    </PaletteProvider>
  )
})

export default DriveItFromYourApp
