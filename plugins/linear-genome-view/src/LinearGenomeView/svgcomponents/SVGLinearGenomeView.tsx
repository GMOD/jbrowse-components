/* eslint-disable react-refresh/only-export-components */

import { exportMargin } from '@jbrowse/core/svg/constants'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { getSession, max } from '@jbrowse/core/util'
import { when } from 'mobx'

import SVGGridlines from './SVGGridlines.tsx'
import SVGHeader from './SVGHeader.tsx'
import SVGHighlightsOverlay from './SVGHighlightsOverlay.tsx'
import SVGTracks from './SVGTracks.tsx'
import { getHeaderLayout, totalHeight, trackLabelLeftOffset } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ExportSvgOptions } from '../types.ts'

type LGV = LinearGenomeViewModel

export async function renderToSvg(model: LGV, opts: ExportSvgOptions) {
  await when(() => model.initialized)
  const {
    textHeight = 18,
    rulerHeight = 34,
    fontSize = 13,
    trackLabels = 'offset',
    themeName = 'default',
    fontFamily,
    showGridlines = false,
    Wrapper = ({ children }) => children,
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
  const offset = tracksTop
  const tracksHeight = totalHeight(visibleTracks, textHeight, trackLabels)
  const height = tracksHeight + offset + exportMargin

  const legendWidth = max(
    visibleTracks.map(track => track.displays[0]!.svgLegendWidth?.() ?? 0),
    0,
  )

  // Every display's `renderSvg` owns its own readiness wait — block
  // renderers await their feature-density stats inside
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
          <g transform={`translate(${trackLabelOffset} ${offset})`}>
            <SVGGridlines model={model} height={tracksHeight} />
          </g>
        ) : null}
        <g transform={`translate(0 ${offset})`}>
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
        <g transform={`translate(${trackLabelOffset} ${offset})`}>
          <SVGHighlightsOverlay model={model} tracksHeight={tracksHeight} />
        </g>
      </g>
    ),
  })
}

export { default as SVGGridlines } from './SVGGridlines.tsx'
export { default as SVGRuler } from './SVGRuler.tsx'
export { default as SVGTracks } from './SVGTracks.tsx'
export { default as SVGView } from './SVGView.tsx'
