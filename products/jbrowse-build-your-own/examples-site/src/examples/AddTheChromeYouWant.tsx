import { Suspense, useEffect, useMemo, useRef, useState } from 'react'

import { setConf } from '@jbrowse/core/configuration'
import { PaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { chooseGridPitch } from '@jbrowse/core/util/chooseGridPitch'
import { normalizeWheelDelta } from '@jbrowse/core/util/wheelZoom'
import {
  DisplayChromeOverlayProvider,
  plainChromeOverlays,
} from '@jbrowse/plugin-linear-genome-view'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// The end of the arc: pan, zoom, three kinds of track, your own status
// overlays, your own ruler, your own track labels.
//
// The labels are a plain flex row next to each track, which is the cheapest
// thing that works. JBrowse's own label layer does more (drag to reorder, a
// per-track menu, an overlap mode that floats the label over the data) and if
// you want those you should use the full component rather than rebuild them.
// Knowing where that line is for your app is the whole point of starting here.
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

const tracks = [
  { id: 'volvox_microarray', label: 'Microarray' },
  { id: 'volvox_genes', label: 'Genes' },
  { id: 'volvox_bam', label: 'Reads' },
]
const trackIds = tracks.map(t => t.id)

const LABEL_WIDTH = 90
const RULER_HEIGHT = 22

function makeView() {
  const state = createViewState({
    assembly: volvox,
    tracks: [wiggleTrack, featureTrack, alignmentsTrack],
  })
  const { view } = state.session
  view.setInit({
    assembly: volvox.name,
    loc: 'ctgA:1..20,000',
    tracks: trackIds,
  })
  // see the Pan and zoom page: scroll-to-zoom is a session preference, and the
  // pileup below reads the same one to know the plain wheel is spoken for
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
// non-passive, for what `scrollZoom` decides, and for why the shift bail is how
// the pileup on this page gets to scroll its reads
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

// A coordinate ruler, written against the same view model the tracks use. This
// is chrome (UI drawn around the data, as opposed to the engine underneath it):
// nothing needs it, and that is the point of putting it on its own page. You
// add the pieces your app wants and skip the rest.
//
// The maths is two view methods. `dynamicBlocks.contentBlocks` is exactly what
// is on screen right now (one entry per contiguous region, so a discontinuous
// view gives several), and `bpToPx` turns a genomic coordinate into a pixel
// offset. `chooseGridPitch` is a core helper that picks a round tick spacing
// for the current zoom, so labels stay legible instead of colliding.
const Ruler = observer(function Ruler({ view }: { view: BrowserView }) {
  if (!isViewReady(view)) {
    return <div style={{ height: RULER_HEIGHT }} />
  }
  const { majorPitch } = chooseGridPitch(view.bpPerPx, 100, 15)

  return (
    <div
      style={{
        position: 'relative',
        height: RULER_HEIGHT,
        overflow: 'hidden',
        borderBottom: '1px solid',
        borderColor: 'color-mix(in srgb, currentColor 25%, transparent)',
        fontSize: '0.7rem',
        userSelect: 'none',
      }}
    >
      {view.dynamicBlocks.contentBlocks.flatMap(block => {
        const first = Math.ceil(block.start / majorPitch) * majorPitch
        const ticks = []
        for (let bp = first; bp < block.end; bp += majorPitch) {
          const px = view.bpToPx({ refName: block.refName, coord: bp })
          if (px) {
            ticks.push(
              <span
                key={`${block.key}-${bp}`}
                style={{
                  position: 'absolute',
                  left: px.offsetPx - view.offsetPx,
                  top: 0,
                  paddingLeft: 3,
                  borderLeft: '1px solid',
                  borderColor:
                    'color-mix(in srgb, currentColor 35%, transparent)',
                  height: '100%',
                  whiteSpace: 'nowrap',
                }}
              >
                {bp.toLocaleString()}
              </span>,
            )
          }
        }
        return ticks
      })}
    </div>
  )
})

// Reads the display's own height so the label stays aligned when a track is
// resized or a display grows to fit its content.
const TrackLabel = observer(function TrackLabel({
  view,
  trackId,
  label,
}: {
  view: BrowserView
  trackId: string
  label: string
}) {
  const track = view.tracks.find(t => t.configuration.trackId === trackId)
  if (!track) {
    return null
  }
  return (
    <div
      style={{
        height: track.activeDisplay.height,
        fontSize: '0.75rem',
        paddingRight: 8,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
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

// Still needed even with the overlays swapped: the feature and alignments
// displays read the palette for their own content colours. See the previous
// two pages.

const AddTheChromeYouWant = observer(function AddTheChromeYouWant() {
  const { view, session } = useMemo(() => makeView(), [])
  const ref = useViewWidth(view)
  const { hint, props } = usePanZoom(view, ref)
  const palette = useSitePalette(session)

  return (
    <PaletteProvider palette={palette}>
      <DisplayChromeOverlayProvider value={plainChromeOverlays}>
        <div style={{ display: 'flex' }}>
          <div style={{ width: LABEL_WIDTH, flex: 'none' }}>
            <div style={{ height: RULER_HEIGHT }} />
            {tracks.map(t => (
              <TrackLabel
                key={t.id}
                view={view}
                trackId={t.id}
                label={t.label}
              />
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Ruler view={view} />
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
                ? trackIds.map(id => (
                    <TrackRow key={id} view={view} trackId={id} />
                  ))
                : null}
            </div>
          </div>
        </div>
      </DisplayChromeOverlayProvider>
    </PaletteProvider>
  )
})

export default AddTheChromeYouWant
