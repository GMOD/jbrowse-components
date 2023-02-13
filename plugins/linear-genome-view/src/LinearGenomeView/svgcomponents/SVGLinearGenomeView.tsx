import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { when } from 'mobx'
import { getSession, sum } from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { createJBrowseTheme } from '@jbrowse/core/ui'

// locals
import { LinearGenomeViewModel, ExportSvgOptions } from '..'
import SVGBackground from './SVGBackground'
import SVGTracks from './SVGTracks'
import SVGHeader from './SVGHeader'
import SVGRuler from './SVGRuler'

type LGV = LinearGenomeViewModel

interface Display {
  height: number
}
interface Track {
  displays: Display[]
}

export function totalHeight(
  tracks: Track[],
  padding: number,
  textHeight: number,
) {
  return sum(tracks.map(t => t.displays[0].height + padding + textHeight))
}

// render LGV to SVG
export async function renderToSvg(model: LGV, opts: ExportSvgOptions) {
  await when(() => model.initialized)
  const {
    paddingHeight = 20,
    textHeight = 20,
    headerHeight = 40,
    rulerHeight = 50,
    fontSize = 15,
    cytobandHeight = 100,
    trackNames = 'offset',
    themeName = 'default',
    Wrapper = ({ children }) => <>{children}</>,
  } = opts
  const session = getSession(model)
  const themes = session.allThemes()
  const { width, tracks, showCytobands } = model
  const shift = 50
  const c = +showCytobands * cytobandHeight
  const offset = headerHeight + rulerHeight + c + 20
  const height = totalHeight(tracks, paddingHeight, textHeight) + offset
  const displayResults = await Promise.all(
    tracks.map(async track => {
      const display = track.displays[0]
      await when(() => (display.ready !== undefined ? display.ready : true))
      return { track, result: await display.renderSvg(opts) }
    }),
  )

  // the xlink namespace is used for rendering <image> tag
  return renderToStaticMarkup(
    <ThemeProvider theme={createJBrowseTheme(themes[themeName])}>
      <Wrapper>
        <svg
          width={width}
          height={height}
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox={[0, 0, width + shift * 2, height].toString()}
        >
          <SVGBackground width={width} height={height} shift={shift} />
          <g transform={`translate(${shift} ${fontSize})`}>
            <SVGHeader
              model={model}
              fontSize={fontSize}
              rulerHeight={rulerHeight}
              cytobandHeight={cytobandHeight}
            />
            <SVGTracks
              paddingHeight={paddingHeight}
              textHeight={textHeight}
              fontSize={fontSize}
              model={model}
              displayResults={displayResults}
              offset={offset}
              trackNames={trackNames}
            />
          </g>
        </svg>
      </Wrapper>
    </ThemeProvider>,
  )
}

export { SVGTracks, SVGRuler }
