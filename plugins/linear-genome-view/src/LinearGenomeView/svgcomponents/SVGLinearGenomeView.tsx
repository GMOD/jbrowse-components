/* eslint-disable react-refresh/only-export-components */

import type { ReactNode } from 'react'

import { SVGExportRoot, SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { exportMargin } from '@jbrowse/core/svg/constants'
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
  const cytobandOffset = +showCytobands * cytobandHeight
  const offset = headerHeight + rulerHeight + cytobandOffset + 10
  const tracksHeight = totalHeight(visibleTracks, textHeight, trackLabels)
  const height = tracksHeight + offset + 100

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
  const trackLabelOffset =
    trackLabels === 'left'
      ? max(
          visibleTracks.map(t =>
            measureText(getTrackName(t.configuration, session), fontSize),
          ),
          0,
        ) + 40
      : 0
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
        <SVGExportRoot width={w} height={height}>
          <g transform={`translate(${exportMargin} 0)`}>
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
                leftBuffer={exportMargin}
                legendWidth={legendWidth}
              />
            </g>
            <g transform={`translate(${trackLabelOffset} ${offset})`}>
              <SvgClipRect
                id={`highlight-clip-${model.id}`}
                width={width}
                height={tracksHeight}
              >
                <SVGHighlights model={model} height={tracksHeight} />
                {bookmarkHighlights}
              </SvgClipRect>
            </g>
          </g>
        </SVGExportRoot>
      </Wrapper>
    </ThemeProvider>,
  )
}

export { default as SVGGridlines } from './SVGGridlines.tsx'
export { default as SVGRuler } from './SVGRuler.tsx'
export { default as SVGTracks } from './SVGTracks.tsx'
