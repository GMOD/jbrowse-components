import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react'

import { exportMargin } from '@jbrowse/core/svg/constants'
import { svgTrackName } from '@jbrowse/core/svg/trackNames'
import { StyleThemeProvider } from '@jbrowse/core/ui/PaletteContext'
import { resolveStyleTheme } from '@jbrowse/core/ui/styleTheme'
import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { getSession } from '@jbrowse/core/util'
import { useFetch } from '@jbrowse/core/util/useFetch'
import { ThemeProvider } from '@mui/material'
import { reaction } from 'mobx'

import SVGRowHeader from './SVGRowHeader.tsx'
import SVGView from './SVGView.tsx'
import { renderViewTracks } from './renderViewTracks.ts'
import {
  defaultTextHeight,
  getRowHeaderLayout,
  trackLabelLeftOffset,
} from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { TrackLabelMode } from '../types.ts'
import type { SvgDisplayResult } from './util.ts'
import type { ThemeOptions } from '@mui/material'
import type React from 'react'

// Mounting the SVG export in a page, rather than serializing it to a file.
//
// `renderToSvg` builds a React tree and ends in `renderToStaticMarkup`; nothing
// about the tree needs that last step, so a host can render the same components
// inline and get a figure made of DOM nodes — selectable text, styleable marks,
// a screen reader that can reach the labels. What stands between the two is
// entirely mechanical, and all three pieces of it are the kind that fail
// quietly, which is why this is published rather than described:
//
// - **the await.** A display's `renderSvg` is async and returns a ReactNode, so
//   an inline caller has to park a rendered tree somewhere and keep it in step
//   with a view that moves.
// - **the freeze.** Half of what a figure draws is frozen (the display bodies,
//   built at a moment in the past) and half is live: SVGView and SVGRowHeader
//   re-derive the ruler, the scalebar and the region seams from the model on any
//   React render they get. Re-render the figure between snapshots and the ruler
//   slides while the features stay put — two clocks, reading as a rendering bug.
//   An export cannot hit it, because `wrapSvgExport` renders the whole document
//   in one synchronous pass.
// - **the geometry.** The header band, the label gutter, the legend gutter and
//   the 50px `exportMargin` are all the caller's to reserve, and getting the
//   last one wrong clips a wiggle's y-axis labels, which are drawn left of zero.
//
// The file export stays one call (`view.exportSvg`), and the markup string stays
// one call (`renderToSvg`). This is the third form.

/** What a figure's shape is, where JBrowse has no opinion of its own. */
export interface ViewSvgFigureOptions {
  fontSize?: number
  rulerHeight?: number
  trackLabels?: TrackLabelMode
  showGridlines?: boolean
  /** the capped bar labelled with the span, above the ruler */
  showScalebar?: boolean
  /**
   * Paint each display's heavy layer to a canvas and embed a PNG instead of
   * emitting vector elements. The point of an inline figure is usually the
   * opposite, but a hundred-thousand-read pileup is a lot of DOM.
   */
  rasterizeLayers?: boolean
  /** gutter on each side, for content drawn outside the genome area */
  margin?: number
  /** a named theme, as the export dialog's picker passes */
  themeName?: string
}

export interface ViewSvgFigureResult {
  /**
   * The figure, ready to render. Frozen against the snapshot it was built from
   * (see the note above), so re-rendering the component that holds it cannot
   * make its chrome disagree with its track bodies.
   */
  figure: React.ReactNode
  /**
   * Dimensions of the figure, for a host reserving its space — of the *last*
   * one drawn while a redraw is in flight, since a reservation that went
   * undefined between figures would collapse the box and walk the page.
   */
  width: number | undefined
  height: number | undefined
  /** the locus it is a picture of, for a caption */
  locstring: string | undefined
  /**
   * Names of visible tracks left out, because their display type implements no
   * `renderSvg`. Not an error — a third-party display that has skipped a
   * substantial extra implementation should cost its own track a place in the
   * figure rather than cost the whole export — but not nothing either, since a
   * figure quietly one track short is indistinguishable afterwards from a figure
   * of a view that had one fewer. Say it somewhere.
   */
  skipped: string[]
  error: unknown
  isLoading: boolean
}

interface FigureSnapshot {
  displayResults: SvgDisplayResult[]
  theme: ThemeOptions | undefined
  width: number
  height: number
  bandHeight: number
  contentTop: number
  tracksHeight: number
  legendWidth: number
  trackLabelOffset: number
  textHeight: number
  fontSize: number
  rulerHeight: number
  trackLabels: TrackLabelMode
  showGridlines: boolean
  showScalebar: boolean
  margin: number
  locstring: string
  skipped: string[]
}

type ResolvedOptions = Required<Omit<ViewSvgFigureOptions, 'themeName'>> & {
  themeName: string | undefined
}

/**
 * One figure: every visible track rendered to SVG elements, and the geometry
 * that lays them out.
 *
 * `renderViewTracks` owns the two orderings this cannot state for itself — the
 * legend gutter measured before the renders (a display draws its key beside the
 * plot or floating over it depending on whether the container reserved room),
 * the stack height after them (a display whose height follows its data only
 * reaches its final height once its readiness wait resolves). Everything read
 * below is read after the awaits for the same reason.
 */
async function renderFigure(
  view: LinearGenomeViewModel,
  opts: ResolvedOptions,
): Promise<FigureSnapshot> {
  const {
    fontSize,
    rulerHeight,
    trackLabels,
    showGridlines,
    showScalebar,
    rasterizeLayers,
    margin,
    themeName,
  } = opts
  const session = getSession(view)
  const theme = session.getActiveThemeOptions?.(themeName)
  const textHeight = defaultTextHeight(fontSize)
  const { tracks, displayResults, tracksHeight, legendWidth, skippedTracks } =
    await renderViewTracks({
      view,
      opts: { fontSize, trackLabels, rasterizeLayers, themeName },
      theme,
      textHeight,
      trackLabels,
      // an inline figure has room to give: a legend sits beside the plot rather
      // than over it
      reserveLegendWidth: true,
    })
  // the room the row header needs *above* its own origin — it draws the assembly
  // name and the scalebar at negative y, so the caller reserves the band and
  // translates the view down into it
  const { bandHeight } = getRowHeaderLayout({ fontSize, showScalebar })
  const trackLabelOffset = trackLabelLeftOffset({
    tracks,
    trackLabels,
    fontSize,
    session,
  })
  return {
    displayResults,
    theme,
    width: view.width + margin * 2 + legendWidth + trackLabelOffset,
    height: bandHeight + rulerHeight + tracksHeight + margin,
    bandHeight,
    contentTop: rulerHeight,
    tracksHeight,
    legendWidth,
    trackLabelOffset,
    textHeight,
    fontSize,
    rulerHeight,
    trackLabels,
    showGridlines,
    showScalebar,
    margin,
    locstring: view.visibleLocStrings,
    skipped: skippedTracks.map(track => svgTrackName(track, session)),
  }
}

/**
 * The figure, frozen.
 *
 * `memo` is what keeps the live half of the drawing (the ruler, the scalebar,
 * the seams, all of which re-read the model) from advancing past the frozen half
 * while a redraw is in flight — the snapshot is the only thing that may move it.
 *
 * **It looks redundant in this repo and is not, and the difference is the
 * build.** `babel.config.cjs` runs React Compiler over every component here, so
 * a re-render of this one with an unchanged `snapshot` reuses its whole memoized
 * element tree and the chrome never re-runs — which is why taking the `memo` out
 * fails no test in this repo. What ships is `build:esm`, plain `tsc` with no
 * compiler pass, so a consumer's app re-renders this component on every parent
 * render. Where it matters, this line is the only thing holding the two halves
 * together.
 *
 * Both providers, as `wrapSvgExport` mounts for the file path, and for the same
 * reason: the chrome takes its colors from the Material UI theme and a
 * `makeStyles` component would take its own from the style theme, so a figure
 * mounted in a host that installs neither would otherwise draw itself in
 * JBrowse's *default light* theme whatever the session is set to.
 *
 * No background rect, unlike a file — that has nothing behind it, and a figure
 * in a page has the page. No `resetSvgClipIds` either, and that is the opposite
 * decision from the file path on purpose: the counter is document-global, so
 * resetting it here would renumber ids that a figure already on the page is
 * pointing at. Letting it run is what makes several live figures unique.
 */
const FrozenSvgFigure = memo(function FrozenSvgFigure({
  view,
  snapshot,
}: {
  view: LinearGenomeViewModel
  snapshot: FigureSnapshot
}) {
  const { width, height, margin, theme } = snapshot
  return (
    <ThemeProvider theme={createJBrowseTheme(theme)}>
      <StyleThemeProvider theme={resolveStyleTheme({ configTheme: theme })}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          // It is a vector, so a narrower container scales it rather than
          // clipping it; the height attribute stays, so a box reserved for it
          // does not change size when that happens. Deliberately not a prop:
          // anything passed per-render would have to reach past the memo above,
          // which is the one thing holding the figure's two halves together. A
          // host that wants other sizing wraps this in a box of its own.
          style={{ display: 'block', maxWidth: '100%' }}
        >
          <g transform={`translate(${margin} ${snapshot.bandHeight})`}>
            <SVGView
              view={view}
              displayResults={snapshot.displayResults}
              header={
                <SVGRowHeader
                  view={view}
                  fontSize={snapshot.fontSize}
                  rulerHeight={snapshot.rulerHeight}
                  showScalebar={snapshot.showScalebar}
                />
              }
              fontSize={snapshot.fontSize}
              textHeight={snapshot.textHeight}
              trackLabels={snapshot.trackLabels}
              trackLabelOffset={snapshot.trackLabelOffset}
              contentTop={snapshot.contentTop}
              tracksHeight={snapshot.tracksHeight}
              showGridlines={snapshot.showGridlines}
              // the left gutter the per-track clip may bleed into, so content
              // drawn left of zero — a wiggle's y-axis — survives
              leftBuffer={snapshot.margin}
              legendWidth={snapshot.legendWidth}
            />
          </g>
        </svg>
      </StyleThemeProvider>
    </ThemeProvider>
  )
})

/**
 * What "the figure is out of date" means, as a string.
 *
 * The settled frame rather than the live one: `coarseVisibleLocStrings` and
 * `coarseBpPerPx` are a 500ms-delayed copy of the view's geometry — the same
 * signal the wiggle and alignments displays refetch on — so a figure redraws
 * when the reader stops rather than once a frame. A redraw walks every visible
 * feature and builds a few thousand DOM nodes; that is the trade an inline
 * figure makes, and it is why the canvas rendering still exists.
 *
 * The rest is everything else a figure is a picture of, and each entry is here
 * because leaving it out is silent: **the tracks**, since `ready` answers a
 * question about regions and is true before a track is instantiated (the first
 * figure then draws a header over nothing, and nothing else ever changes to
 * correct it); **their heights and minimized flags**, since the geometry is
 * derived from them; **the width**, since a resize can widen the canvas without
 * moving the locus; and **the theme**, since each display bakes colors into its
 * own bodies, so a figure from the other mode is not stale but unreadable.
 */
function figureKey(view: LinearGenomeViewModel, themeName: string | undefined) {
  // `view.width` throws by design before the view has been measured, and
  // `ready` is the gate that says it has been — and that there are regions to
  // draw, which is the second async step `initialized` does not cover
  if (!view.ready) {
    return ''
  }
  const session = getSession(view)
  return JSON.stringify([
    view.coarseVisibleLocStrings,
    view.coarseBpPerPx,
    view.width,
    view.tracks.map(track => [
      track.configuration.trackId,
      track.minimized,
      track.displays[0]?.height,
    ]),
    session.getActiveThemeOptions?.(themeName),
  ])
}

/**
 * Subscribe to that key from outside MobX.
 *
 * `useSyncExternalStore` rather than reading the model in the caller's render,
 * so this works whether or not the calling component is an `observer` — a hook
 * that silently stops redrawing for hosts who did not wrap their component is
 * not a publishable contract. `reaction` rather than `autorun` for once, and for
 * the reason the usual rule is the other way round: `getSnapshot` already
 * supplies the current value, so the subscription only has to report changes.
 */
function useFigureKey(
  view: LinearGenomeViewModel,
  themeName: string | undefined,
) {
  return useSyncExternalStore(
    useCallback(
      (onChange: () => void) =>
        reaction(() => figureKey(view, themeName), onChange),
      [view, themeName],
    ),
    () => figureKey(view, themeName),
    () => '',
  )
}

/**
 * A live SVG figure of a linear genome view, redrawn as the view settles
 * somewhere new.
 *
 * ```tsx
 * const { figure, isLoading, skipped } = useViewSvgFigure(view)
 * return <div>{figure}</div>
 * ```
 *
 * The data is the display's own — whatever it has already fetched for the
 * screen — so a figure costs no requests.
 *
 * `useFetch` under it, which is what discards a redraw that lands after the pan
 * that overtook it, and what makes a theme change *clear* the figure while a pan
 * only replaces it: a key change drops the stale data, where a refetch under the
 * same key would leave it up. Both are right. A figure the reader panned away
 * from is still a legible picture of somewhere; one baked in the other mode is
 * light-grey feature labels on a white page.
 */
export function useViewSvgFigure(
  view: LinearGenomeViewModel,
  {
    fontSize = 12,
    rulerHeight = 30,
    trackLabels = 'offset',
    showGridlines = true,
    showScalebar = true,
    rasterizeLayers = false,
    margin = exportMargin,
    themeName,
  }: ViewSvgFigureOptions = {},
): ViewSvgFigureResult {
  const key = useFigureKey(view, themeName)
  const {
    data: snapshot,
    error,
    isLoading,
  } = useFetch(
    // Every option is in the key by value, so an inline options object costs
    // nothing and a changed option redraws. A null key is `useFetch`'s own "not
    // yet", which is what an unready view reports.
    key
      ? ([
          'lgv-svg-figure',
          key,
          JSON.stringify([
            fontSize,
            rulerHeight,
            trackLabels,
            showGridlines,
            showScalebar,
            rasterizeLayers,
            margin,
          ]),
        ] as const)
      : null,
    () =>
      renderFigure(view, {
        fontSize,
        rulerHeight,
        trackLabels,
        showGridlines,
        showScalebar,
        rasterizeLayers,
        margin,
        themeName,
      }),
  )
  // Written in an effect and read during render, which is the order that makes
  // it work: a key change clears `data` on the render where the ref still holds
  // the previous commit's size, so the host's box keeps the height it had rather
  // than collapsing to nothing while the next figure draws.
  const lastSize = useRef<{ width: number; height: number }>(undefined)
  useEffect(() => {
    if (snapshot) {
      lastSize.current = { width: snapshot.width, height: snapshot.height }
    }
  }, [snapshot])
  const size = snapshot ?? lastSize.current
  return {
    figure: snapshot ? (
      <FrozenSvgFigure view={view} snapshot={snapshot} />
    ) : undefined,
    width: size?.width,
    height: size?.height,
    locstring: snapshot?.locstring,
    skipped: snapshot?.skipped ?? [],
    error,
    isLoading,
  }
}
