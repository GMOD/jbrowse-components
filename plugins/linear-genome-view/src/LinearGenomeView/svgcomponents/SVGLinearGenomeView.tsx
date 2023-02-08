import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { when } from 'mobx'
import { getSession } from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { createJBrowseTheme } from '@jbrowse/core/ui'

// locals
import { LinearGenomeViewModel, ExportSvgOptions } from '..'
import SVGBackground from './SVGBackground'
import SVGTracks from './SVGTracks'
import SVGHeader from './SVGHeader'

type LGV = LinearGenomeViewModel

interface Display {
  height: number
}
interface Track {
  displays: Display[]
}

const totalHeight = (
  tracks: Track[],
  paddingHeight: number,
  textHeight: number,
) => {
  return tracks.reduce(
    (accum, track) =>
      accum + track.displays[0].height + paddingHeight + textHeight,
    0,
  )
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
    Wrapper = ({ children }) => <>{children}</>,
  } = opts
  const session = getSession(model)
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
    <ThemeProvider theme={createJBrowseTheme(session.theme)}>
      <Wrapper>
        <svg
          width={width}
          height={height}
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox={[0, 0, width + shift * 2, height].toString()}
        >
          <SVGBackground width={width} height={height} shift={shift} />
          <g stroke="none" transform={`translate(${shift} ${fontSize})`}>
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
            />
          </g>
        </svg>
      </Wrapper>
    </ThemeProvider>,
  )
}
