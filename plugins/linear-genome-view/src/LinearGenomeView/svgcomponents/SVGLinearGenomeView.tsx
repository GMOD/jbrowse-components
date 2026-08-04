import { exportMargin } from '@jbrowse/core/svg/constants'
import { awaitViewInitialized } from '@jbrowse/core/svg/svgReady'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { getSession } from '@jbrowse/core/util'

import SVGGridlines from './SVGGridlines.tsx'
import SVGHeader from './SVGHeader.tsx'
import SVGHighlightsOverlay from './SVGHighlightsOverlay.tsx'
import SVGTracks from './SVGTracks.tsx'
import { renderViewTracks } from './renderViewTracks.ts'
import {
  defaultTextHeight,
  getHeaderLayout,
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
  const { width, effectiveShowCytobands } = model
  const { tracksTop } = getHeaderLayout({
    fontSize,
    showCytobands: effectiveShowCytobands,
    rulerHeight,
  })

  // owns the two orderings this used to spell out by hand: legendWidth before
  // the awaits, tracksHeight after them. Every display's `renderSvg` owns its
  // own readiness wait — block renderers await their byte estimate inside
  // `renderBaseLinearDisplaySvg`, GPU renderers await their data/layout inside
  // their own `renderSvg` implementations.
  const { tracks, displayResults, tracksHeight, legendWidth } =
    await renderViewTracks({
      view: model,
      opts,
      theme,
      textHeight,
      trackLabels,
      // the standalone export is the one with room to give: it widens its
      // canvas below so a legend sits beside the plot rather than over it
      reserveLegendWidth: true,
    })
  const height = tracksHeight + tracksTop + exportMargin

  const trackLabelOffset = trackLabelLeftOffset({
    tracks,
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
