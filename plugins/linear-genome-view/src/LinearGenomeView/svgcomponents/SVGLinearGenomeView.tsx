/* eslint-disable react-refresh/only-export-components */

import type { ReactNode } from 'react'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  getEnv,
  getSession,
  max,
  measureText,
  renderToStaticMarkup,
} from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { ThemeProvider } from '@mui/material'
import { when } from 'mobx'

import SVGBackground from './SVGBackground.tsx'
import SVGGridlines from './SVGGridlines.tsx'
import SVGHeader from './SVGHeader.tsx'
import SVGHighlights from './SVGHighlights.tsx'
import SVGTracks from './SVGTracks.tsx'
import { totalHeight } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ExportSvgOptions } from '../types.ts'

type LGV = LinearGenomeViewModel

export async function renderToSvg(model: LGV, opts: ExportSvgOptions) {
  await when(() => model.initialized)
  const {
    textHeight = 18,
    headerHeight = 40,
    rulerHeight = 50,
    fontSize = 13,
    cytobandHeight = 100,
    trackLabels = 'offset',
    themeName = 'default',
    showGridlines = false,
    Wrapper = ({ children }) => children,
  } = opts
  const session = getSession(model)
  const { allThemes } = session

  const theme = allThemes?.()[themeName]
  const jbrowseTheme = createJBrowseTheme(theme)
  const { width, pinnedTracks, unpinnedTracks, showCytobands } = model
  const visibleTracks = [...pinnedTracks, ...unpinnedTracks].filter(
    t => !t.minimized,
  )
  const shift = 50
  const cytobandOffset = +showCytobands * cytobandHeight
  const offset = headerHeight + rulerHeight + cytobandOffset + 10
  const tracksHeight = totalHeight(visibleTracks, textHeight, trackLabels)
  const height = tracksHeight + offset + 100

  const legendWidth = max(
    visibleTracks.map(
      track => track.displays[0]!.svgLegendWidth?.(jbrowseTheme) ?? 0,
    ),
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
  const trackLabelMaxLen =
    max(
      visibleTracks.map(t =>
        measureText(getTrackName(t.configuration, session), fontSize),
      ),
      0,
    ) + 40
  const trackLabelOffset = trackLabels === 'left' ? trackLabelMaxLen : 0
  const w = width + trackLabelOffset + legendWidth

  const { pluginManager } = getEnv(model)
  const bookmarkHighlights = pluginManager.evaluateExtensionPoint(
    'LinearGenomeView-HighlightSVGComponent',
    [] as ReactNode[],
    { model, height: tracksHeight },
  )

  // the xlink namespace is used for rendering <image> tag
  return renderToStaticMarkup(
    <ThemeProvider theme={jbrowseTheme}>
      <Wrapper>
        <svg
          width={w + shift * 2}
          height={height}
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox={`0 0 ${w + shift * 2} ${height}`}
        >
          <SVGBackground width={w} height={height} shift={shift} />
          <g transform={`translate(${shift} 0)`}>
            <g transform={`translate(${trackLabelOffset})`}>
              <SVGHeader
                model={model}
                fontSize={fontSize}
                rulerHeight={rulerHeight}
                cytobandHeight={cytobandHeight}
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
                leftBuffer={shift}
                legendWidth={legendWidth}
              />
            </g>
            <g transform={`translate(${trackLabelOffset} ${offset})`}>
              <defs>
                <clipPath id="highlight-clip">
                  <rect x={0} y={0} width={width} height={tracksHeight} />
                </clipPath>
              </defs>
              <g clipPath="url(#highlight-clip)">
                <SVGHighlights model={model} height={tracksHeight} />
                {bookmarkHighlights}
              </g>
            </g>
          </g>
        </svg>
      </Wrapper>
    </ThemeProvider>,
  )
}

export { default as SVGGridlines } from './SVGGridlines.tsx'
export { default as SVGRuler } from './SVGRuler.tsx'
export { default as SVGTracks } from './SVGTracks.tsx'
