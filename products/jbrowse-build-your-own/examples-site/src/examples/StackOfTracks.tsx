import { Suspense, useEffect, useMemo, useRef, useState } from 'react'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { normalizeWheelDelta } from '@jbrowse/core/util/wheelZoom'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { ThemeProvider } from '@mui/material/styles'
import { observer } from 'mobx-react'

// Three different display types -- a wiggle canvas, a feature layout, and an
// alignments pileup -- stacked in one column.
//
// Nothing here knows which is which. `TrackStack` maps over track ids and
// mounts each one's `activeDisplay.RenderingComponent`, and the differences
// between a BigWig and a BAM are entirely inside the engine. Adding a display
// type to this page means adding a string to `trackIds`.
//
// Self-contained: the parts introduced on the two previous pages are repeated
// here rather than imported, so this file runs on its own.

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

const trackIds = ['volvox_microarray', 'volvox_genes', 'volvox_bam']

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

/**
 * The parts above, composed: a measured, pan/zoomable column of tracks and
 * nothing else. This is the smallest thing that is recognisably a genome
 * browser.
 */
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

// The one piece of Material UI you cannot currently drop, and it is worth being
// precise about why.
//
// JBrowse's stock displays read theme tokens to colour their actual *content*:
// the feature display reads `palette.highlight.main` for its highlight boxes,
// the CDS renderer reads `palette.framesCDS` for reading frames. Those are
// augmented entries that a default MUI theme does not have, so without this
// wrapper a feature or alignments track throws
// `Cannot read properties of undefined (reading 'main')`.
//
// A wiggle track happens not to need it and renders fine bare, which is why the
// two pages before this one mount no ThemeProvider at all. The next page draws
// the line precisely: the status overlays are swappable, the palette is not.
//
// Note this costs you a theme *object*, not a look: nothing here styles the
// chrome, because there is no chrome.
const theme = createJBrowseTheme()

const StackOfTracks = observer(function StackOfTracks() {
  const view = useMemo(() => makeView(), [])
  return (
    <ThemeProvider theme={theme}>
      <TrackStack view={view} />
    </ThemeProvider>
  )
})

export default StackOfTracks
