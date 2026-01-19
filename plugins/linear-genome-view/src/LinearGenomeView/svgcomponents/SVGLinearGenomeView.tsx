/* eslint-disable react-refresh/only-export-components */

import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  getSession,
  max,
  measureText,
  renderToStaticMarkup,
} from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { ThemeProvider } from '@mui/material'
import { when } from 'mobx'

import { isReadyOrHasError } from '../svgExportUtil.ts'
import SVGBackground from './SVGBackground.tsx'
import SVGGridlines from './SVGGridlines.tsx'
import SVGHeader from './SVGHeader.tsx'
import SVGTracks from './SVGTracks.tsx'
import { totalHeight } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ExportSvgOptions } from '../types.ts'

type LGV = LinearGenomeViewModel

// render LGV to SVG
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
  const { width, pinnedTracks, unpinnedTracks, tracks, showCytobands } = model
  const shift = 50
  const c = +showCytobands * cytobandHeight
  const offset = headerHeight + rulerHeight + c + 10
  const height = totalHeight(tracks, textHeight, trackLabels) + offset + 100

  // Calculate maximum legend width across all displays
  const legendWidth = max(
    [...pinnedTracks, ...unpinnedTracks].map(track => {
      const display = track.displays[0]
      return display?.svgLegendWidth?.(jbrowseTheme) ?? 0
    }),
    0,
  )

  const displayResults = await Promise.all(
    [...pinnedTracks, ...unpinnedTracks].map(async track => {
      const display = track.displays[0]
      await when(() => isReadyOrHasError(display))
      return {
        track,
        result: await display.renderSvg({ ...opts, theme, legendWidth }),
      }
    }),
  )
  const trackLabelMaxLen =
    max(
      tracks.map(t =>
        measureText(getTrackName(t.configuration, session), fontSize),
      ),
      0,
    ) + 40
  const trackLabelOffset = trackLabels === 'left' ? trackLabelMaxLen : 0
  const w = width + trackLabelOffset + legendWidth
  const tracksHeight = totalHeight(tracks, textHeight, trackLabels)

  // the xlink namespace is used for rendering <image> tag
  return renderToStaticMarkup(
    <ThemeProvider theme={createJBrowseTheme(theme)}>
      <Wrapper>
        <svg
          width={w}
          height={height}
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox={[0, 0, w + shift * 2, height].toString()}
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
              />
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
