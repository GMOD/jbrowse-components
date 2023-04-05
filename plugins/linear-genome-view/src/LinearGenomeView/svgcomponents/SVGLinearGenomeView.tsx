import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { when } from 'mobx'
import { getSession, max, measureText, sum } from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { createJBrowseTheme } from '@jbrowse/core/ui'

// locals
import { LinearGenomeViewModel, ExportSvgOptions } from '..'
import SVGBackground from './SVGBackground'
import SVGTracks from './SVGTracks'
import SVGHeader from './SVGHeader'

import { getTrackName } from '@jbrowse/core/util/tracks'

type LGV = LinearGenomeViewModel

interface Display {
  height: number
}
interface Track {
  displays: Display[]
}

export function totalHeight(
  tracks: Track[],
  textHeight: number,
  trackLabels: string,
) {
  return sum(
    tracks.map(
      t =>
        t.displays[0].height +
        (['none', 'left'].includes(trackLabels) ? 0 : textHeight),
    ),
  )
}

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
    Wrapper = ({ children }) => <>{children}</>,
  } = opts
  const session = getSession(model)
  const theme = session.allThemes?.()[themeName]
  const { width, tracks, showCytobands } = model
  const shift = 50
  const c = +showCytobands * cytobandHeight
  const offset = headerHeight + rulerHeight + c + 10
  const height = totalHeight(tracks, textHeight, trackLabels) + offset + 100
  const displayResults = await Promise.all(
    tracks.map(async track => {
      const display = track.displays[0]
      await when(() => (display.ready !== undefined ? display.ready : true))
      return { track, result: await display.renderSvg({ ...opts, theme }) }
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
  const w = width + trackLabelOffset

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
            <SVGTracks
              textHeight={textHeight}
              fontSize={fontSize}
              model={model}
              displayResults={displayResults}
              offset={offset}
              trackLabels={trackLabels}
              trackLabelOffset={trackLabelOffset}
            />
          </g>
        </svg>
      </Wrapper>
    </ThemeProvider>,
  )
}

export { default as SVGRuler } from './SVGRuler'
export { default as SVGTracks } from './SVGTracks'
