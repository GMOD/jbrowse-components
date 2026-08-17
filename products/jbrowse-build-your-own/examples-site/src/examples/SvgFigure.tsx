import { Suspense, memo, useSyncExternalStore } from 'react'

import { exportMargin } from '@jbrowse/core/svg/constants'
import { svgTrackName } from '@jbrowse/core/svg/trackNames'
import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { useCreateOnce, useWidthSetter } from '@jbrowse/core/util/hooks'
import { useFetch } from '@jbrowse/core/util/useFetch'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { DisplayUIProvider, TrackOverlaySlot } from '@jbrowse/display-ui'
import {
  SVGRowHeader,
  SVGView,
  defaultTextHeight,
  getRowHeaderLayout,
  renderViewTracks,
  totalHeight,
} from '@jbrowse/plugin-linear-genome-view'
import { createViewState } from '@jbrowse/react-linear-genome-view2'
import { ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'

// The same components JBrowse's "Export SVG" is built from, mounted in the page
// as ordinary React rather than serialized to a file. The canvas browser is on
// top; below it is a figure of the same view, in SVG, in the same document --
// every glyph a DOM node, every gene name selectable text.
//
// Two things make that possible and are worth knowing before you copy this:
//
// - a display's `renderSvg` is **async and returns a ReactNode**. It waits for
//   the display's data, then hands back an element -- so the only thing standing
//   between the export path and your JSX is somewhere to await it and somewhere
//   to keep the result. That is `useSvgFigure` below.
// - it draws from data the display has already fetched for the screen, so this
//   figure costs no requests. What it costs is DOM: a few thousand nodes per
//   redraw, which is why the redraw is on a settle rather than per frame.
//
// Self-contained, like every page here: the engine, mounting and dark-mode parts
// introduced on earlier pages are repeated rather than imported.

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

function makeView() {
  const state = createViewState({
    assembly: volvox,
    tracks: [wiggleTrack, featureTrack],
    init: {
      loc: 'ctgA:5,000..25,000',
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
type BrowserSession = ReturnType<typeof makeView>['session']

// Everything about the figure's shape that is yours rather than JBrowse's. The
// export dialog collects these as options; here they are just constants.
//
// Two of them should not be numbers of your own. `defaultTextHeight` is the band
// an 'offset' track label needs at this font size, descenders included, and
// guessing it is how a label lands on the first pixel row of the track under it.
// `exportMargin` is the 50px gutter every JBrowse image export leaves on each
// side, and it is not decoration: a wiggle draws its y-axis *left* of zero and a
// ruler tick label at the edge overhangs, so a smaller gutter cuts the axis
// numbers off -- which is exactly what a hand-picked 12 did here.
const fontSize = 12
const rulerHeight = 30
const trackLabels = 'offset'
const textHeight = defaultTextHeight(fontSize)

// What the figure will come out at, reserved by the box that holds it so the
// prose below stays put while a redraw is in flight. Both tracks are
// fixed-height, so this is arithmetic rather than a measurement -- and it is
// `totalHeight`, the same helper the render uses, rather than a second opinion
// about what a stack of tracks is tall.
const figureBoxHeight =
  getRowHeaderLayout({ fontSize, showScalebar: true }).bandHeight +
  rulerHeight +
  totalHeight(
    [wiggleTrack, featureTrack].map(track => ({
      displays: [{ height: track.displayDefaults.height }],
    })),
    textHeight,
    trackLabels,
  ) +
  exportMargin

/**
 * One figure: every visible track rendered to SVG elements, plus the geometry
 * that lays them out.
 *
 * `renderViewTracks` is the published half of a view's `renderToSvg`, and using
 * it rather than a loop over `display.renderSvg` is not a convenience. It owns
 * two orderings whose absence is invisible at a call site that merely lists the
 * same statements: the legend gutter is measured *before* the renders, because a
 * display decides whether to draw its key beside the plot or floating over it by
 * whether the container reserved room; the stack height is measured *after*
 * them, because a display whose height follows its data only reaches its final
 * height once its readiness wait resolves. Measure up front and the taller
 * bodies run off the bottom of the figure.
 *
 * The geometry below is read after the awaits for the same reason.
 *
 * `rasterizeLayers` is the one option worth stating rather than defaulting: off,
 * a display's heavy draw path emits vector elements; on, it paints to a canvas
 * and embeds a PNG. The whole point of this page is off, and a figure of a
 * hundred-thousand-read pileup is the case for on.
 */
async function renderFigure(view: BrowserView, session: BrowserSession) {
  const { displayResults, tracksHeight, legendWidth, skippedTracks } =
    await renderViewTracks({
      view,
      opts: { fontSize, trackLabels, rasterizeLayers: false },
      // The theme each display bakes its *own* colours from -- the alignments and
      // MAF bodies rebuild a palette from it rather than reading the provider, so
      // an export can be a different theme from the screen. `themeOptions` is the
      // session's serializable theme description and `configTheme` is the half
      // that means "what the host asked for", which is the same slot
      // `SessionPaletteProvider` writes below: pass it and the figure follows the
      // page's light/dark mode with nothing here to keep in sync.
      theme: session.themeOptions.configTheme,
      textHeight,
      trackLabels,
      reserveLegendWidth: true,
    })
  // `bandHeight` is the room the row header needs *above* its own origin: it
  // draws the assembly name and the scalebar at negative y, so the caller
  // reserves the space and translates the view down into it.
  const { bandHeight } = getRowHeaderLayout({ fontSize, showScalebar: true })
  return {
    displayResults,
    tracksHeight,
    legendWidth,
    bandHeight,
    width: view.width + exportMargin * 2 + legendWidth,
    height: bandHeight + rulerHeight + tracksHeight + exportMargin,
    // What the figure is a picture of, kept beside it: the caption reads these
    // rather than the live view, so it always describes the pixels on screen.
    locstring: view.visibleLocStrings,
    // The other half of the render's answer, and the half it is easy to drop.
    // SVG export is a substantial extra implementation per display type, so a
    // display that has none is left out of the figure rather than failing it --
    // which means a figure can be quietly short a track, and afterwards nothing
    // in the file says so. Every one of JBrowse's own view exports reports these
    // (`notifySkippedSvgTracks`, into `session.snackbarMessages`); a page that
    // draws its own chrome renders no snackbar, so this one says it in the
    // caption instead. Nothing is skipped with the two tracks below -- it is
    // wired up for the day you add a third.
    skipped: skippedTracks.map(track => svgTrackName(track, session)),
  }
}

type Figure = Awaited<ReturnType<typeof renderFigure>>

/**
 * The figure, redrawn whenever the view settles somewhere new.
 *
 * `useFetch` rather than an effect of your own, and the awaiting is the small
 * half of what that saves. A redraw in flight is abandoned when the key changes,
 * so a slow one that lands after the pan which overtook it cannot put a figure of
 * the wrong locus on screen; `error` and `isLoading` are states of one fetch
 * rather than two more `useState`s to keep in step with it; and the whole of the
 * hook's contract is a key, which is where the interesting decisions go.
 *
 * **Every part of the key is one of those decisions.**
 *
 * `coarseVisibleLocStrings` and `coarseBpPerPx` are the view's *settled* frame: a
 * 500ms-delayed copy of `dynamicBlocks`, and the same signal the wiggle and
 * alignments displays refetch on. Keying on the live `offsetPx` instead would
 * redraw per frame, walking every feature and building a few thousand DOM nodes
 * each time, which is the trade the canvas browser above exists for.
 *
 * The **mode** is in there because the track bodies carry the colours they were
 * baked with, and a key change clears `data` where a same-key `mutate()` would
 * leave it up. That asymmetry is what you want here: a figure the reader panned
 * away from is still a legible picture of somewhere, while one baked in the other
 * mode is light-grey feature labels on a white page -- 2.89:1, which this site's
 * contrast check measures and failed on before the mode was part of the key.
 *
 * The **track list** is in there because `ready` answers a question about
 * regions, not about tracks: at first paint the view is ready with `tracks` still
 * empty, and the figure that draws is a header over nothing. Nothing else in the
 * key changes when the tracks arrive, so without this it stays that way -- which
 * is what a key is for. An app that lets the reader resize a track wants
 * `display.height` here for the same reason.
 *
 * Strings and numbers only. A `false` (or null, or undefined) anywhere in a key
 * means "don't fetch", so a boolean in one is a redraw that silently never
 * happens.
 */
function useSvgFigure(
  view: BrowserView,
  session: BrowserSession,
  mode: 'light' | 'dark',
) {
  return useFetch(
    // `view.width`, which renderFigure reads, throws by design before the view
    // has been measured -- `ready` is the gate that says it has been, and that
    // there are regions to draw, which is the second async step `initialized`
    // does not cover. A null key is `useFetch`'s own "not yet".
    view.ready
      ? ([
          'svg-figure',
          mode,
          view.coarseVisibleLocStrings,
          view.coarseBpPerPx,
          view.tracks.map(track => track.configuration.trackId).join(','),
        ] as const)
      : null,
    () => renderFigure(view, session),
  )
}

/**
 * The figure itself: a plain `<svg>`, JBrowse's own view chrome inside it, and
 * the track bodies the render pass produced.
 *
 * **`memo`, and it is load-bearing rather than an optimisation.** Half of what
 * is drawn here is frozen -- `displayResults` are elements built at a moment in
 * the past -- and the other half is live: `SVGView` and `SVGRowHeader` re-derive
 * the ruler, the scalebar and the region seams from the model on every React
 * render they get. Let the parent re-render this mid-pan and the ruler slides
 * while the features stay put, which reads as a rendering bug and is really two
 * clocks. In an export they cannot disagree, because `wrapSvgExport` renders the
 * whole document in one synchronous pass; inline, freezing them together is your
 * job, and `figure` changing identity is the moment they agree again.
 *
 * No background rect, unlike an exported file: a file has nothing behind it, so
 * the export paints the theme's background. A figure in a page has the page.
 */
const FrozenFigure = memo(function FrozenFigure({
  view,
  figure,
}: {
  view: BrowserView
  figure: Figure
}) {
  return (
    <svg
      width={figure.width}
      height={figure.height}
      viewBox={`0 0 ${figure.width} ${figure.height}`}
      // It is a vector, so a container narrower than the drawing scales it down
      // instead of clipping or scrolling it. The height attribute stays, so the
      // box the page reserved does not change size when it does.
      style={{ display: 'block', maxWidth: '100%' }}
    >
      <g transform={`translate(${exportMargin} ${figure.bandHeight})`}>
        <SVGView
          view={view}
          displayResults={figure.displayResults}
          // What sits above the tracks is a slot, not a flag, and this is the
          // compact one JBrowse's stacked exports use: assembly name, a capped
          // bar labelled with the span, then the ruler. Draw your own here if a
          // figure of yours wants a title instead.
          header={
            <SVGRowHeader
              view={view}
              fontSize={fontSize}
              rulerHeight={rulerHeight}
              showScalebar
            />
          }
          fontSize={fontSize}
          textHeight={textHeight}
          trackLabels={trackLabels}
          trackLabelOffset={0}
          contentTop={rulerHeight}
          tracksHeight={figure.tracksHeight}
          showGridlines
          // the left gutter the per-track clip may bleed into, so content drawn
          // left of zero -- a wiggle's y-axis at whole-genome zoom -- survives
          leftBuffer={exportMargin}
          legendWidth={figure.legendWidth}
        />
      </g>
    </svg>
  )
})

/**
 * The figure plus its caption, and the two states a redraw has.
 *
 * `ThemeProvider` because JBrowse's SVG chrome is JBrowse's *chrome*: the ruler,
 * the scalebar and the track labels take their colours from Material UI's theme,
 * the way their on-screen counterparts do. `wrapSvgExport` mounts one for you on
 * the export path; inline, this is that line, and `session.theme` is the theme
 * the session already resolved from the mode set below. Leave it out and the
 * chrome renders from Material UI's *default* (light) theme -- black-on-black
 * text on a dark page, with nothing in the console. It costs no Material UI
 * element: everything under it is `<text>` and `<path>`.
 */
const SvgFigurePanel = observer(function SvgFigurePanel({
  view,
  session,
  mode,
}: {
  view: BrowserView
  session: BrowserSession
  mode: 'light' | 'dark'
}) {
  const { data: figure, error, isLoading } = useSvgFigure(view, session, mode)
  return (
    <ThemeProvider theme={session.theme}>
      <div style={{ fontSize: '0.8rem', opacity: 0.7, padding: '6px 0' }}>
        {error
          ? `Could not draw the figure: ${error instanceof Error ? error.message : String(error)}`
          : figure
            ? [
                `SVG of ${figure.locstring}`,
                figure.skipped.length > 0
                  ? `no SVG renderer for ${figure.skipped.join(', ')}`
                  : undefined,
              ]
                .filter(Boolean)
                .join(' — ')
            : isLoading
              ? 'Drawing'
              : 'Nothing to draw'}
      </div>
      {/* the box keeps the height of the figure it is drawing, so the prose
       * below does not walk up the page between one redraw and the next */}
      <div style={{ minHeight: figureBoxHeight }}>
        {figure ? <FrozenFigure view={view} figure={figure} /> : null}
      </div>
    </ThemeProvider>
  )
})

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

// The box `usePanZoom`'s handlers go on -- see the Pan and zoom page for what
// each property is doing, and for the one the hook writes itself.
const viewport: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  cursor: 'grab',
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
  const ref = useWidthSetter(view)
  const { containerProps } = usePanZoom(ref, view)
  return (
    <div ref={ref} {...containerProps} style={viewport}>
      {view.ready ? (
        trackIds.map(trackId => (
          <TrackRow key={trackId} view={view} trackId={trackId} />
        ))
      ) : (
        <ViewStatus view={view} />
      )}
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
 * JBrowse's half is one mount, `SessionPaletteProvider` below. It writes the
 * config slot that *both* halves of the rendering derive from -- the palette
 * React draws with, and the theme shipped to the worker that bakes feature
 * labels into the image. `PaletteProvider` on its own is the near miss: it
 * colours React and leaves those baked labels in the old mode.
 */
function useSiteMode() {
  return useSyncExternalStore(
    watchSiteMode,
    readSiteMode,
    () => 'light' as const,
  )
}

const SvgFigure = observer(function SvgFigure() {
  const { view, session } = useCreateOnce(makeView)
  const mode = useSiteMode()
  return (
    <SessionPaletteProvider session={session} mode={mode}>
      {/* both bring-your-own seams at once, defaulting to the plain sets: no
       * argument means no Material UI in the canvas browser's status states or
       * corner controls. The Removing Material UI page writes them by hand. The
       * figure below needs no equivalent -- an SVG body draws no chrome, and the
       * one thing it does draw that a display would (a colour key) is vector. */}
      <DisplayUIProvider>
        <TrackStack view={view} />
      </DisplayUIProvider>
      <SvgFigurePanel view={view} session={session} mode={mode} />
    </SessionPaletteProvider>
  )
})

export default SvgFigure
