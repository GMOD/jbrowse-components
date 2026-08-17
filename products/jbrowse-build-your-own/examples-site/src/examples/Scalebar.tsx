import { Suspense, useRef, useState, useSyncExternalStore } from 'react'

import {
  PaletteProvider,
  usePalette,
  useSessionPalette,
} from '@jbrowse/core/ui/PaletteContext'
import { useCreateOnce, useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { usePointerDrag } from '@jbrowse/core/util/usePointerDrag'
import { DisplayUIProvider, TrackOverlaySlot } from '@jbrowse/display-ui'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

// A coordinate row is easy to start and hard to finish: a loop over one tick
// pitch gets you ticks, and then labels collide, a second region arrives with
// no name on it, and the chromosome scrolls off the moment you pan into it.
// This is the finished one -- gridlines behind the data, coordinate labels that
// don't collide, the region name kept on screen while you pan past its start,
// and drag-to-zoom. Four getters on the view do the work --
// `gridlineTicks`, `scalebarLabels`, `scalebarRefNameLabels` and `paddingSpans`
// -- so none of it is tick maths you have to get right.
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

function makeView() {
  const state = createViewState({
    assembly: volvox,
    tracks: [wiggleTrack, featureTrack],
    init: {
      // Two regions, so there is a name to keep on screen at each one and a seam
      // between them. Both are on ctgA because this assembly's bigWig covers only
      // that contig -- see the Drive it from your app page.
      loc: 'ctgA:1..15,000 ctgA:17,400..23,000',
      tracks: trackIds,
    },
  })
  const { view } = state.session
  // see the Pan and zoom example: scroll-to-zoom is a session preference, shared
  // with any display that scrolls vertically inside itself
  view.setScrollZoom(true)
  return { view, session: state.session }
}

type BrowserView = ReturnType<typeof makeView>['view']

// `view.ready` is false in TWO states, not one: while the assembly loads, and
// when it failed to load. Returning `null` for both -- the gate that looks
// obviously right -- turns a 404 on a sequence file into an empty box that
// never fills, with nothing anywhere saying why; the failure is a state on the
// model rather than a throw, so there is no console error either. `error` is
// read first because `loadingMessage` goes undefined once the load stops,
// however it stopped. The Loading and error states page draws the long form of
// this, and has a radio that breaks the assembly on purpose.
const ViewStatus = observer(function ViewStatus({
  view,
}: {
  view: BrowserView
}) {
  const { error, loadingMessage } = view
  return (
    <div
      role={error ? 'alert' : 'status'}
      style={{ padding: '10px 12px', fontSize: '0.85rem', opacity: 0.75 }}
    >
      {error
        ? `Could not load: ${error instanceof Error ? error.message : String(error)}`
        : (loadingMessage ?? 'Loading')}
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
  // guard stays -- `view.ready` says the view can draw, not that your track is
  // instantiated yet.
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
 * every displayed region rather than the viewport. So one element translated by
 * `view.staticBlocksTranslateX` puts every tick in the right place at once, and
 * a pan moves that one transform rather than each tick. The coordinate labels
 * below use the same frame for the same reason.
 *
 * Laying the overlay out in absolute genome pixels and translating by
 * `-view.offsetPx` is the shape that looks equivalent and is not. `offsetPx` is
 * a whole-genome coordinate -- hg38 chr1 at base resolution is past 1e10 -- and
 * a CSS length that size is float32 by the time it reaches the compositor,
 * where neighbouring representable values are ~1000px apart. The getter does
 * the subtraction in JS, so only its small difference reaches CSS.
 *
 * `usePalette()` is how a component asks JBrowse for a color without Material
 * UI -- the same hook its own displays use, reading the same theme, so chrome
 * you write follows the app's light/dark switch along with the data. Note what
 * it is *not*: the CSS system colors (`Canvas`, `CanvasText`) follow the
 * browser's colour scheme rather than the app's, so a dark app that hasn't set
 * `color-scheme` gets a white label box for its trouble.
 */
const Gridlines = observer(function Gridlines({ view }: { view: BrowserView }) {
  const { gridlineTicks, staticBlocks, staticBlocksTranslateX } = view
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
        // unrounded, unlike the labels below: these are paths, and there is no
        // glyph to blur. JBrowse's own Gridlines makes the same call, through
        // `ZoomTransform`
        transform: `translateX(${staticBlocksTranslateX}px)`,
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
  const { scalebarLabels, staticBlocks, staticBlocksTranslateX } = view
  const palette = usePalette()
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        width: staticBlocks.totalWidthPx,
        // rounded, unlike the gridlines above: these are text, and a fractional
        // offset blurs every number in the row. Same split JBrowse's own
        // ScalebarCoordinateLabels makes
        transform: `translateX(${Math.round(staticBlocksTranslateX)}px)`,
      }}
    >
      {/* keyed by position rather than by each label's `key`, which makes this
      a pool: a zoom moves the whole tick set, so identity keys would unmount
      and remount every node instead of relabelling it */}
      {scalebarLabels.map(({ x, label }, i) => (
        <span
          // eslint-disable-next-line @eslint-react/no-array-index-key -- position IS the identity here; keying by label is what the pooling above removes
          key={i}
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
 * region, which is when you most want it. So one label slides, pinned to the
 * viewport's left edge until its region's right edge takes it away again.
 *
 * `view.scalebarRefNameLabels` is that already decided -- `{text, transform,
 * maxWidth, paddingLeft}` per label, the same set JBrowse's own scalebar draws.
 * Three rules are inside it, and each is a bug you would otherwise ship once:
 *
 * - **which block carries the sliding label.** Not the region's first:
 *   `staticBlocks` only covers what is on screen, so once you zoom past a
 *   region's start that block is gone from the set entirely, and a label hung
 *   on it takes the chromosome name off screen at exactly the zoom where
 *   nothing else on the page names it.
 * - **one label per run of a refName**, so a view of collapsed introns doesn't
 *   repeat the same chromosome down the row.
 * - **whole name or none.** `chr16` clipped to its own width reads as `chr1`,
 *   which is a different chromosome rather than a shortened name -- so a name
 *   that doesn't fit its region is dropped rather than abbreviated. The Every
 *   chromosome page is where that is visible, on its narrowest bands.
 *
 * `transform` is a screen x, already net of `offsetPx`, unlike `gridlineTicks`
 * and `scalebarLabels` above -- the sliding label's position is a function of
 * the scroll rather than of block geometry, so it has no fixed place in the
 * staticBlocks frame. These labels go in a plain container, not the translated
 * one.
 */
const RegionNames = observer(function RegionNames({
  view,
}: {
  view: BrowserView
}) {
  const palette = usePalette()
  return view.scalebarRefNameLabels.labels.map(
    ({ key, text, transform, maxWidth, paddingLeft }) => (
      <span
        key={key}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translateX(${transform}px)`,
          maxWidth,
          paddingLeft,
          // maxWidth is the label's whole box, paddingLeft included -- the fit
          // test above measured it that way. Under content-box the padding
          // comes off the text twice and every name wide enough to need the
          // space is clipped mid-glyph.
          boxSizing: 'border-box',
          background: palette.background.paper,
          color: palette.text.primary,
          fontWeight: 'bold',
          // clip, not ellipsis: a name that would not fit whole was already
          // dropped, so there is nothing left to abbreviate
          overflow: 'clip',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
    ),
  )
})

const RUBBERBAND_MIN_PX = 4

/**
 * Drag across the scalebar to zoom to what you dragged over.
 *
 * Two model calls. `view.pxToBp(px)` turns a pixel offset in the view into an
 * anchor -- which displayed region, and how far into it -- and
 * `view.moveTo(start, end)` frames the span between two of them, working out
 * the zoom itself. Both are the same calls JBrowse's own rubberband makes.
 *
 * `usePointerDrag` is the lifecycle around them, and it is core's -- the same
 * one every JBrowse resize handle runs. Written by hand this is the block that
 * looks finished and is not: it owns the pointer capture (so the drag survives
 * the cursor leaving the row and ends even if the button comes up outside the
 * window), it starts only on a primary press, and it keeps the whole gesture to
 * the pointer that began it, so a second finger neither hijacks a drag nor
 * re-anchors one.
 *
 * The row's left edge is measured once at the press rather than per move: it
 * cannot move during the drag, and `getBoundingClientRect` in a pointermove
 * handler forces layout on every frame of one.
 *
 * A drag shorter than a few pixels is a click, and zooming to it would land the
 * user somewhere absurd, so it is dropped.
 */
function useRubberband(view: BrowserView) {
  const [range, setRange] = useState<
    { left: number; right: number } | undefined
  >(undefined)
  // written by `onDragStart`, which the hook guarantees runs first
  const originRef = useRef({ anchor: 0, originX: 0 })

  function clampToView(clientX: number, originX: number) {
    return Math.min(Math.max(clientX - originX, 0), view.width)
  }

  function spanTo(clientX: number) {
    const { anchor, originX } = originRef.current
    const x = clampToView(clientX, originX)
    return { left: Math.min(anchor, x), right: Math.max(anchor, x) }
  }

  return {
    range,
    props: usePointerDrag({
      onDragStart(event) {
        const { left } = event.currentTarget.getBoundingClientRect()
        originRef.current = {
          anchor: clampToView(event.clientX, left),
          originX: left,
        }
      },
      onDrag(event) {
        setRange(spanTo(event.clientX))
      },
      onDragEnd(event) {
        const { left, right } = spanTo(event.clientX)
        setRange(undefined)
        if (right - left >= RUBBERBAND_MIN_PX) {
          view.moveTo(view.pxToBp(left), view.pxToBp(right))
        }
      },
    }),
  }
}

function RangeSelection({ range }: { range: { left: number; right: number } }) {
  const palette = usePalette()
  return (
    <div
      aria-hidden
      // this site's smoke test drags across the scalebar and measures this
      // band, because a gesture is invisible to a census of a page at rest.
      // Keep or drop it in your own app -- the demo needs it, the technique
      // does not
      data-testid="rubberband"
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
 * The row itself. `data-gesture-owner` is the marker `usePanZoom` tests before
 * starting a drag of its own -- without it, dragging out a range here would pan
 * the view sideways at the same time. JBrowse's own scalebar carries the same
 * attribute for the same reason.
 */
const ScalebarRow = observer(function ScalebarRow({
  view,
  ...handlers
}: { view: BrowserView } & React.ComponentProps<'div'>) {
  const palette = usePalette()
  return (
    <div
      data-gesture-owner="true"
      // this site's smoke test drags across this row to prove the rubberband
      // still reaches the model. Keep or drop it in your own app -- the check
      // needs it, the technique does not
      data-testid="scalebar"
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

// What each kind of span looks like is yours; that there are three is not. A
// seam must be opaque -- regions are laid out contiguously, so both sides are
// drawn right up to it and a see-through line tints two regions' features
// instead of separating them.
const SPAN_FILL = {
  seam: 'color-mix(in srgb, CanvasText 45%, Canvas)',
  boundary: 'color-mix(in srgb, CanvasText 12%, Canvas)',
  elided: 'color-mix(in srgb, CanvasText 30%, Canvas)',
}

/**
 * The spans along the row that are not track data -- region seams, the greyed
 * ends of the genome, and regions too narrow to draw. `view.paddingSpans` is
 * the geometry; see the Drive it from your app page for the frame it is in and
 * for why deriving it yourself misses two cases.
 */
const RegionBoundaries = observer(function RegionBoundaries({
  view,
}: {
  view: BrowserView
}) {
  const { paddingSpans, staticBlocksTranslateX } = view
  return (
    <div
      aria-hidden
      // this site's smoke test checks that a display's own chrome paints above
      // this layer rather than under it, and needs to be able to find the layer.
      // Keep or drop it in your own app -- the check needs it, the technique
      // does not
      data-region-seams
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 2,
        pointerEvents: 'none',
        // boxes, so unrounded -- see Gridlines above for the split
        transform: `translateX(${staticBlocksTranslateX}px)`,
      }}
    >
      {paddingSpans.map(({ key, x, width, kind }) => (
        <div
          key={key}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: x,
            width,
            background: SPAN_FILL[kind],
          }}
        />
      ))}
    </div>
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
 * JBrowse's half is one call, `useSessionPalette` below. It writes the config
 * slot that *both* halves of the rendering derive from -- the palette React
 * draws with, and the theme shipped to the worker that bakes feature labels
 * into the image -- and hands back the palette. Mounting `PaletteProvider`
 * alone would leave those baked labels in the old mode.
 */
function useSiteMode() {
  return useSyncExternalStore(
    watchSiteMode,
    readSiteMode,
    () => 'light' as const,
  )
}

// The box `usePanZoom`'s handlers go on -- see the Pan and zoom page for what
// each property is doing and which half of it the hook cannot do for you.
const viewport: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  touchAction: 'none',
  cursor: 'grab',
}

const Scalebar = observer(function Scalebar() {
  const { view, session } = useCreateOnce(makeView)
  const ref = useWidthSetter(view)
  // `usePanZoom` also returns `showZoomHint`, unused here: it is raised only
  // when a wheel was ignored for want of ctrl, which cannot happen with
  // scroll-to-zoom on. The Pan and zoom example has the toggle, and draws it.
  const { containerProps } = usePanZoom(ref, view)
  const rubberband = useRubberband(view)
  const palette = useSessionPalette(session, useSiteMode())

  return (
    <PaletteProvider palette={palette}>
      <DisplayUIProvider>
        <div ref={ref} {...containerProps} style={viewport}>
          {/* every piece below reads block geometry, and `staticBlocks`
           * *throws* until the ResizeObserver has reported a width -- so all
           * of it sits inside one gate rather than each guarding itself. See
           * the Drive it from your app page. */}
          {view.ready ? (
            <>
              <Gridlines view={view} />
              <ScalebarRow view={view} {...rubberband.props} />
              {trackIds.map(id => (
                <TrackRow key={id} view={view} trackId={id} />
              ))}
              <RegionBoundaries view={view} />
              {rubberband.range ? (
                <RangeSelection range={rubberband.range} />
              ) : null}
            </>
          ) : (
            <ViewStatus view={view} />
          )}
        </div>
      </DisplayUIProvider>
    </PaletteProvider>
  )
})

export default Scalebar
