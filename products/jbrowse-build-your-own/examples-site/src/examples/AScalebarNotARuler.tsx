import { Suspense, useEffect, useRef, useState } from 'react'

import { setConf } from '@jbrowse/core/configuration'
import { PaletteProvider, usePalette } from '@jbrowse/core/ui/PaletteContext'
import { normalizeWheelDelta } from '@jbrowse/core/util/wheelZoom'
import {
  DisplayChromeOverlayProvider,
  TrackControlProvider,
  plainChromeOverlays,
  plainTrackControl,
} from '@jbrowse/plugin-linear-genome-view'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// The ruler on the Add the chrome you want page is a loop over one tick pitch
// and knows nothing about regions. This is the rest of it: gridlines behind the
// data, coordinate labels that don't collide, the region name kept on screen
// while you pan past its start, and drag-to-zoom. Four getters on the view do
// the work -- `gridlineTicks`, `scalebarLabels`, `scalebarRegionEndPx` and
// `staticBlocks` -- so none of it is tick maths you have to get right.
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

const trackIds = ['volvox_microarray', 'volvox_genes']

const SCALEBAR_HEIGHT = 20

function makeView(scrollZoom: boolean) {
  const state = createViewState({
    assembly: volvox,
    tracks: [wiggleTrack, featureTrack],
  })
  const { view } = state.session
  view.setInit({
    assembly: volvox.name,
    // Two regions, so there is a name to keep on screen at each one and a seam
    // between them. Both are on ctgA because this assembly's bigWig covers only
    // that contig -- see the Drive it from your app page.
    loc: 'ctgA:1..15,000 ctgA:17,400..23,000',
    tracks: trackIds,
  })
  // see the Pan and zoom page: scroll-to-zoom is a session preference, shared
  // with any display that scrolls vertically inside itself
  view.setScrollZoom(scrollZoom)
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
        // control (here, the scalebar, which owns its own drag) must not start
        // a pan, and why the pointer is captured on move rather than here
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
 * Background gridlines, drawn once for the whole stack -- scalebar included, so
 * a label sits on its own line.
 *
 * `view.gridlineTicks` is the tick list the view computed for the zoom it is
 * at, `{x, major}` each. Two `<path>`s rather than a div per tick: a zoom frame
 * then patches two `d` strings instead of reconciling a hundred nodes, and the
 * lines stay crisp at any device pixel ratio. They run to y=100000 and are
 * clipped by the svg's own box, so nothing has to measure the height.
 *
 * The x values are in the **staticBlocks frame**: a pixel space that spans
 * every displayed region rather than the viewport, with its origin at
 * `staticBlocks.offsetPx`. So one element translated by
 * `staticBlocks.offsetPx - view.offsetPx` puts every tick in the right place at
 * once, and a pan moves that one transform rather than each tick. The
 * coordinate labels below use the same frame for the same reason.
 *
 * `usePalette()` is how a component asks JBrowse for a color without Material
 * UI -- the same hook its own displays use, reading the same theme, so chrome
 * you write follows the app's light/dark switch along with the data. Note what
 * it is *not*: the CSS system colors (`Canvas`, `CanvasText`) follow the
 * browser's colour scheme rather than the app's, so a dark app that hasn't set
 * `color-scheme` gets a white label box for its trouble.
 */
const Gridlines = observer(function Gridlines({ view }: { view: BrowserView }) {
  const { gridlineTicks, staticBlocks, offsetPx } = view
  const palette = usePalette()
  let minorD = ''
  let majorD = ''
  for (const tick of gridlineTicks) {
    // +0.5 centers a 1px stroke on a pixel column
    const segment = `M${tick.x + 0.5} 0V100000`
    if (tick.major) {
      majorD += segment
    } else {
      minorD += segment
    }
  }
  return (
    <svg
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        width: staticBlocks.totalWidthPx,
        transform: `translateX(${Math.round(staticBlocks.offsetPx - offsetPx)}px)`,
        pointerEvents: 'none',
      }}
    >
      <path
        d={minorD}
        strokeWidth={1}
        style={{ stroke: palette.gridlineMinor }}
      />
      <path
        d={majorD}
        strokeWidth={1}
        style={{ stroke: palette.gridlineMajor }}
      />
    </svg>
  )
})

/**
 * The coordinate labels.
 *
 * `view.scalebarLabels` is already the answer: `{x, label, key}` per label, in
 * the same staticBlocks frame and off the same tick formula as the gridlines,
 * so a number always sits on a line. The view drops the ones that would not fit
 * -- against a region edge, against the region's own name, against each other
 * -- rather than leaving you to notice them overlapping at some zoom you did
 * not test, and it formats them for the zoom (`1,000` up close, `10.5kb` out).
 *
 * The opaque background is not decoration: the label straddles the gridline it
 * belongs to, and needs to mask it to stay readable.
 */
const ScalebarLabels = observer(function ScalebarLabels({
  view,
}: {
  view: BrowserView
}) {
  const { scalebarLabels, staticBlocks, offsetPx } = view
  const palette = usePalette()
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        width: staticBlocks.totalWidthPx,
        transform: `translateX(${Math.round(staticBlocks.offsetPx - offsetPx)}px)`,
      }}
    >
      {scalebarLabels.map(({ x, label, key }) => (
        <span
          key={key}
          style={{
            position: 'absolute',
            top: 0,
            left: x,
            transform: 'translateX(-50%)',
            padding: '0 3px',
            background: palette.background.paper,
            color: palette.text.primary,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      ))}
    </div>
  )
})

/**
 * The name of each region, kept on screen.
 *
 * A name drawn at the region's start scrolls away the moment you pan into the
 * region, which is when you most want it. So it slides: `max(blockStartPx, 0)`
 * pins it to the viewport's left edge once the block it belongs to has scrolled
 * past, and `view.scalebarRegionEndPx` -- displayed-region index to right edge,
 * which the view keeps for its own scalebar -- takes it away again with the
 * region's own right edge.
 *
 * Which block carries it is the part worth copying rather than deriving. Not
 * the region's first: `staticBlocks` only covers what is on screen, so once you
 * zoom in past the start of a region that block is gone from the set entirely,
 * and a label hung on it takes the chromosome name off the screen at exactly
 * the zoom where nothing else on the page says which chromosome this is. It
 * rides the rightmost block that has scrolled off the left edge instead, which
 * is the same rule JBrowse's own scalebar uses. The others draw a name only if
 * they start a region.
 *
 * `maxWidth` rather than truncation: a region narrower than its name clips the
 * name to the region instead of letting it run over the next one.
 */
const RegionNames = observer(function RegionNames({
  view,
}: {
  view: BrowserView
}) {
  const { staticBlocks, scalebarRegionEndPx, offsetPx } = view
  const palette = usePalette()
  const blocks = staticBlocks.contentBlocks
  const stickyIndex = Math.max(
    blocks.findLastIndex(block => block.offsetPx < offsetPx),
    0,
  )
  return blocks.map((block, i) => {
    if (i !== stickyIndex && !block.isLeftEndOfDisplayedRegion) {
      return null
    }
    // a content block always has an index, though the block type leaves it
    // optional; -1 simply misses the map
    const regionEndPx = scalebarRegionEndPx.get(
      block.displayedRegionIndex ?? -1,
    )
    const left = Math.max(block.offsetPx - offsetPx, 0)
    const maxWidth = (regionEndPx ?? 0) - offsetPx - left
    return maxWidth > 0 ? (
      <span
        key={block.key}
        style={{
          position: 'absolute',
          top: 0,
          left,
          maxWidth,
          padding: '0 3px',
          background: palette.background.paper,
          color: palette.text.primary,
          fontWeight: 'bold',
          overflow: 'clip',
          whiteSpace: 'nowrap',
        }}
      >
        {block.refName}
      </span>
    ) : null
  })
})

/**
 * Drag across the scalebar to zoom to what you dragged over.
 *
 * Two model calls. `view.pxToBp(px)` turns a pixel offset in the view into an
 * anchor -- which displayed region, and how far into it -- and
 * `view.moveTo(start, end)` frames the span between two of them, working out
 * the zoom itself. Both are the same calls JBrowse's own rubberband makes.
 *
 * The container's left edge is measured once at the press rather than per move:
 * it cannot move during the drag, and `getBoundingClientRect` in a pointermove
 * handler forces layout on every frame of one.
 *
 * A drag shorter than a few pixels is a click, and zooming to it would land the
 * user somewhere absurd, so it is dropped.
 */
const RUBBERBAND_MIN_PX = 4

function useRubberband(view: BrowserView) {
  const [range, setRange] = useState<
    { left: number; right: number } | undefined
  >(undefined)
  const dragRef = useRef<{ anchor: number; originX: number } | undefined>(
    undefined,
  )

  function clampToView(clientX: number, originX: number) {
    return Math.min(Math.max(clientX - originX, 0), view.width)
  }

  return {
    range,
    props: {
      onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
        if (event.button !== 0) {
          return
        }
        const { left } = event.currentTarget.getBoundingClientRect()
        const anchor = clampToView(event.clientX, left)
        dragRef.current = { anchor, originX: left }
        event.currentTarget.setPointerCapture(event.pointerId)
      },
      onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
        const drag = dragRef.current
        if (!drag) {
          return
        }
        const x = clampToView(event.clientX, drag.originX)
        setRange({
          left: Math.min(drag.anchor, x),
          right: Math.max(drag.anchor, x),
        })
      },
      onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
        const drag = dragRef.current
        dragRef.current = undefined
        setRange(undefined)
        event.currentTarget.releasePointerCapture(event.pointerId)
        if (!drag) {
          return
        }
        const x = clampToView(event.clientX, drag.originX)
        const left = Math.min(drag.anchor, x)
        const right = Math.max(drag.anchor, x)
        if (right - left >= RUBBERBAND_MIN_PX) {
          view.moveTo(view.pxToBp(left), view.pxToBp(right))
        }
      },
      onPointerCancel() {
        dragRef.current = undefined
        setRange(undefined)
      },
    },
  }
}

function RangeSelection({ range }: { range: { left: number; right: number } }) {
  const palette = usePalette()
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: range.left,
        width: range.right - range.left,
        zIndex: 4,
        pointerEvents: 'none',
        background: `color-mix(in srgb, ${palette.primary.main} 20%, transparent)`,
        borderLeft: `1px solid ${palette.primary.main}`,
        borderRight: `1px solid ${palette.primary.main}`,
      }}
    />
  )
}

/**
 * The row itself. `data-gesture-owner` is the marker the page's pan handler
 * tests before starting a drag -- without it, dragging out a range here would
 * pan the view sideways at the same time. JBrowse's own scalebar carries the
 * same attribute for the same reason.
 */
const Scalebar = observer(function Scalebar({
  view,
  ...handlers
}: { view: BrowserView } & React.ComponentProps<'div'>) {
  const palette = usePalette()
  return (
    <div
      data-gesture-owner="true"
      style={{
        position: 'relative',
        height: SCALEBAR_HEIGHT,
        overflow: 'clip',
        fontSize: '0.7rem',
        lineHeight: `${SCALEBAR_HEIGHT}px`,
        cursor: 'crosshair',
        userSelect: 'none',
        touchAction: 'none',
        borderBottom: `1px solid ${palette.divider}`,
      }}
      {...handlers}
    >
      <ScalebarLabels view={view} />
      <RegionNames view={view} />
    </div>
  )
})

/**
 * The line between two displayed regions, which you have to draw. See the Drive
 * it from your app page for why it is opaque, why the last region's right end
 * is skipped, and where the geometry comes from.
 */
const RegionBoundaries = observer(function RegionBoundaries({
  view,
}: {
  view: BrowserView
}) {
  const { staticBlocks, offsetPx, displayedRegions } = view
  const lastRegionIndex = displayedRegions.length - 1
  return staticBlocks.blocks
    .filter(
      block =>
        block.isRightEndOfDisplayedRegion &&
        block.displayedRegionIndex !== lastRegionIndex,
    )
    .map(block => (
      <div
        key={block.key}
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: block.offsetPx + block.widthPx - offsetPx - 1,
          width: 3,
          zIndex: 2,
          pointerEvents: 'none',
          background: 'color-mix(in srgb, CanvasText 45%, Canvas)',
        }}
      />
    ))
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

const AScalebarNotARuler = observer(function AScalebarNotARuler({
  scrollZoom = true,
}: {
  // Which gesture a bare wheel is. On by default, because a browser that owns
  // its area of the page should zoom the way a map does. The landing page
  // passes `false`, since it sits above a long document where a wheel that
  // swallowed the page scroll would trap the reader -- see the Pan and zoom
  // page, which is about that decision.
  scrollZoom?: boolean
}) {
  const [{ view, session }] = useState(() => makeView(scrollZoom))
  const ref = useViewWidth(view)
  const { hint, props } = usePanZoom(view, ref)
  const rubberband = useRubberband(view)
  const palette = useSitePalette(session)

  return (
    <PaletteProvider palette={palette}>
      <DisplayChromeOverlayProvider value={plainChromeOverlays}>
        <TrackControlProvider value={plainTrackControl}>
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
            {/* every piece below reads block geometry, and `staticBlocks`
             * *throws* until the ResizeObserver has reported a width -- so all
             * of it sits inside one gate rather than each guarding itself. See
             * the Drive it from your app page. */}
            {isViewReady(view) ? (
              <>
                <Gridlines view={view} />
                <Scalebar view={view} {...rubberband.props} />
                {trackIds.map(id => (
                  <TrackRow key={id} view={view} trackId={id} />
                ))}
                <RegionBoundaries view={view} />
                {rubberband.range ? (
                  <RangeSelection range={rubberband.range} />
                ) : null}
              </>
            ) : null}
          </div>
        </TrackControlProvider>
      </DisplayChromeOverlayProvider>
    </PaletteProvider>
  )
})

export default AScalebarNotARuler
