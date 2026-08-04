import { exportMargin } from '@jbrowse/core/svg/constants'
import { awaitViewInitialized } from '@jbrowse/core/svg/svgReady'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { getSession, max } from '@jbrowse/core/util'

import SVGGridlines from './SVGGridlines.tsx'
import SVGHeader from './SVGHeader.tsx'
import SVGHighlightsOverlay from './SVGHighlightsOverlay.tsx'
import SVGTracks from './SVGTracks.tsx'
import {
  defaultTextHeight,
  getHeaderLayout,
  totalHeight,
  trackLabelLeftOffset,
} from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ExportSvgOptions } from '../types.ts'

type LGV = LinearGenomeViewModel

export async function renderToSvg(model: LGV, opts: ExportSvgOptions) {
  await awaitViewInitialized(model)
  const {
    fontSize = 13,
    // the label band scales with the font it holds; destructured after
    // fontSize so the default can read it
    textHeight = defaultTextHeight(fontSize),
    rulerHeight = 34,
    trackLabels = 'offset',
    themeName = 'default',
    fontFamily,
    showGridlines = false,
    Wrapper,
  } = opts
  const session = getSession(model)
  const theme = session.getActiveThemeOptions?.(themeName)
  const { width, pinnedTracks, unpinnedTracks, effectiveShowCytobands } = model
  const visibleTracks = [...pinnedTracks, ...unpinnedTracks].filter(
    t => !t.minimized,
  )
  const { tracksTop } = getHeaderLayout({
    fontSize,
    showCytobands: effectiveShowCytobands,
    rulerHeight,
  })

  // deliberately read before the awaits below, since it is an input to them.
  // That is why `svgLegendWidth` is specified as a function of the *settings*
  // and not of the loaded data — see LinearHicDisplay's implementation.
  const legendWidth = max(
    visibleTracks.map(track => track.displays[0]!.svgLegendWidth?.() ?? 0),
    0,
  )

  // Every display's `renderSvg` owns its own readiness wait — block
  // renderers await their byte estimate inside
  // `renderBaseLinearDisplaySvg`, GPU renderers await their data/layout
  // inside their own `renderSvg` implementations.
  const displayResults = await Promise.all(
    visibleTracks.map(async track => ({
      track,
      result: await track.displays[0]!.renderSvg({
        ...opts,
        theme,
        legendWidth,
      }),
    })),
  )

  // Reserved *after* those awaits, not before: a display whose height is
  // derived from its data (LinearMultiRowFeatureDisplay is `nrow *
  // effectiveRowHeight`) only reaches its final height once `renderSvg`'s
  // readiness wait resolves. SVGTracks re-reads `displays[0].height` when it
  // lays the tracks out, which happens later still, so measuring up front left
  // the canvas sized for the pre-fetch height and the taller track bodies ran
  // off the bottom of the export.
  const tracksHeight = totalHeight(visibleTracks, textHeight, trackLabels)
  const height = tracksHeight + tracksTop + exportMargin

  const trackLabelOffset = trackLabelLeftOffset({
    tracks: visibleTracks,
    trackLabels,
    fontSize,
    session,
  })
  const w = width + trackLabelOffset + legendWidth

  // the xlink namespace is used for rendering <image> tag
  return wrapSvgExport({
    theme,
    width: w,
    height,
    fontFamily,
    Wrapper,
    children: (
      <g transform={`translate(${exportMargin} 0)`}>
        <g transform={`translate(${trackLabelOffset})`}>
          <SVGHeader
            model={model}
            fontSize={fontSize}
            rulerHeight={rulerHeight}
          />
        </g>
        {showGridlines ? (
          <g transform={`translate(${trackLabelOffset} ${tracksTop})`}>
            <SVGGridlines model={model} height={tracksHeight} />
          </g>
        ) : null}
        <g transform={`translate(0 ${tracksTop})`}>
          <SVGTracks
            textHeight={textHeight}
            fontSize={fontSize}
            model={model}
            displayResults={displayResults}
            trackLabels={trackLabels}
            trackLabelOffset={trackLabelOffset}
            leftBuffer={exportMargin}
            legendWidth={legendWidth}
          />
        </g>
        <g transform={`translate(${trackLabelOffset} ${tracksTop})`}>
          <SVGHighlightsOverlay model={model} tracksHeight={tracksHeight} />
        </g>
      </g>
    ),
  })
}
