import { exportMargin } from '@jbrowse/core/svg/constants'
import {
  awaitSvgRenders,
  awaitViewInitialized,
} from '@jbrowse/core/svg/svgReady'
import { notifySkippedSvgTracks } from '@jbrowse/core/svg/trackNames'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { getSession } from '@jbrowse/core/util'

import OverviewScalebarPolygon from '../components/OverviewScalebarPolygon.tsx'
import SVGHeader from './SVGHeader.tsx'
import SVGRowHeader from './SVGRowHeader.tsx'
import SVGView from './SVGView.tsx'
import { renderViewTracks } from './renderViewTracks.ts'
import {
  defaultTextHeight,
  getHeaderLayout,
  getRowHeaderLayout,
  trackLabelLeftOffset,
} from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ExportSvgOptions } from '../types.ts'

type LGV = LinearGenomeViewModel

export async function renderToSvg(model: LGV, opts: ExportSvgOptions) {
  await awaitViewInitialized(model)
  // `initialized` only answers "have the assemblies loaded" — navigating is the
  // second async step, so an initialized view can still hold no regions: one
  // sitting on its import form, or one a `clearView` emptied. There is no
  // ruler, no scalebar and no track content to draw there, and the export used
  // to save the header's reserved height as a blank themed rectangle. Say why
  // instead, which the dialog shows as an error banner and a headless caller
  // (jbrowse-img) gets as a nonzero exit rather than a blank image. Same guard,
  // and the same reason, as the circular view's import-form export.
  if (!model.hasDisplayedRegions) {
    throw new Error('Cannot export: no regions are displayed')
  }
  const {
    fontSize = 13,
    // the label band scales with the font it holds; destructured after
    // fontSize so the default can read it
    textHeight = defaultTextHeight(fontSize),
    rulerHeight = 34,
    trackLabels = 'offset',
    themeName,
    fontFamily,
    showGridlines = false,
    Wrapper,
  } = opts
  const session = getSession(model)
  const theme = session.getActiveThemeOptions?.(themeName)

  // owns the two orderings this used to spell out by hand: legendWidth before
  // the awaits, tracksHeight after them. Every display's `renderSvg` owns its
  // own readiness wait — an LGV display through `renderDisplaySvg`'s
  // `awaitSvgReady`, a non-LGV one (dotplot, synteny, circular) by calling that
  // itself.
  const levels = model.contextLevelViews as LGV[]
  const [
    { tracks, displayResults, tracksHeight, legendWidth, skippedTracks },
    levelTracks,
  ] = await awaitSvgRenders([
    renderViewTracks({
      view: model,
      opts,
      theme,
      textHeight,
      trackLabels,
      // the standalone export is the one with room to give: it widens its
      // canvas below so a legend sits beside the plot rather than over it
      reserveLegendWidth: true,
    }),
    // a level is a stacked row, like a synteny row: no room for a legend
    awaitSvgRenders(
      levels.map(level =>
        renderViewTracks({ view: level, opts, theme, textHeight, trackLabels }),
      ),
    ),
  ])
  notifySkippedSvgTracks(session, [
    ...skippedTracks,
    ...levelTracks.flatMap(r => r.skippedTracks),
  ])

  // The view geometry is read *after* the displays' waits, never before —
  // SVGHeader re-reads both of these when it renders (later still, inside
  // wrapSvgExport) and lays itself out with the same getHeaderLayout call, so a
  // value that moved during the awaits would leave the reserved `tracksTop` and
  // the drawn header describing different rows. Same rule the dotplot, circular
  // and synteny exports each shipped a violation of.
  const { width, effectiveShowCytobands } = model
  const { tracksTop } = getHeaderLayout({
    fontSize,
    showCytobands: effectiveShowCytobands,
    rulerHeight,
  })
  // one gutter for the whole export, wide enough for the widest label in any
  // level, so the levels stay aligned with the view
  const trackLabelOffset = trackLabelLeftOffset({
    tracks: [...tracks, ...levelTracks.flatMap(r => r.tracks)],
    trackLabels,
    fontSize,
    fontFamily,
    session,
  })
  const w = width + trackLabelOffset + legendWidth

  // Each context level, widest first, then the trapezoid joining it to the
  // level below, then the view itself under its full header.
  //
  // A level's row header is a scalebar and no assembly name — the opposite of a
  // synteny row's. Every level is the host's own assembly, named once in the
  // host's header below, while the span each level covers is the whole point of
  // the stack and is the one thing a ruler at figure size cannot be read for.
  const rowTopGap = 6
  const { bandHeight } = getRowHeaderLayout({
    fontSize,
    showScalebar: true,
    reserveAssemblyName: false,
  })
  const rows = levels.flatMap((level, i) => {
    const rowTop = (i === 0 ? 0 : rowTopGap) + bandHeight
    return [
      {
        key: level.id,
        height: rowTop + rulerHeight + levelTracks[i]!.tracksHeight,
        node: (
          <g transform={`translate(${exportMargin} ${rowTop})`}>
            <SVGView
              view={level}
              displayResults={levelTracks[i]!.displayResults}
              header={
                <SVGRowHeader
                  view={level}
                  fontSize={fontSize}
                  rulerHeight={rulerHeight}
                  showAssemblyName={false}
                  showScalebar
                />
              }
              fontSize={fontSize}
              textHeight={textHeight}
              trackLabels={trackLabels}
              trackLabelOffset={trackLabelOffset}
              contentTop={rulerHeight}
              tracksHeight={levelTracks[i]!.tracksHeight}
              showGridlines={showGridlines}
              leftBuffer={exportMargin}
            />
          </g>
        ),
      },
      {
        key: `connector-${level.id}`,
        // the band the reader set by dragging one of them, since how steep the
        // connectors read is the whole of what that drag is for
        height: model.contextConnectorHeight,
        node: (
          <g transform={`translate(${exportMargin + trackLabelOffset} 0)`}>
            <OverviewScalebarPolygon
              model={levels[i + 1] ?? model}
              overview={level}
              overviewOffsetPx={-level.offsetPx}
              height={model.contextConnectorHeight}
              gradient
            />
          </g>
        ),
      },
    ]
  })
  rows.push({
    key: model.id,
    height: tracksTop + tracksHeight,
    node: (
      <g transform={`translate(${exportMargin} 0)`}>
        <SVGView
          view={model}
          displayResults={displayResults}
          // the standalone export is the one with room above the tracks, so its
          // header is the full one: cytoband overview and total-bp scalebar as
          // well as the assembly name and ruler. `tracksTop` is the height
          // getHeaderLayout gave it.
          header={
            <SVGHeader
              model={model}
              fontSize={fontSize}
              rulerHeight={rulerHeight}
            />
          }
          fontSize={fontSize}
          textHeight={textHeight}
          trackLabels={trackLabels}
          trackLabelOffset={trackLabelOffset}
          contentTop={tracksTop}
          tracksHeight={tracksHeight}
          showGridlines={showGridlines}
          leftBuffer={exportMargin}
          legendWidth={legendWidth}
        />
      </g>
    ),
  })

  let y = 0
  const children = rows.map(row => {
    const top = y
    y += row.height
    return (
      <g key={row.key} transform={`translate(0 ${top})`}>
        {row.node}
      </g>
    )
  })

  // the xlink namespace is used for rendering <image> tag
  return wrapSvgExport({
    theme,
    width: w,
    height: y + exportMargin,
    fontFamily,
    Wrapper,
    children,
  })
}
