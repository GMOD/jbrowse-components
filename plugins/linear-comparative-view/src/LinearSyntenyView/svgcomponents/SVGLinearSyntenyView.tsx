import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { when } from 'mobx'
import { getSession, sum } from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { createJBrowseTheme } from '@jbrowse/core/ui'

// locals
import { SVGTracks, totalHeight } from '@jbrowse/plugin-linear-genome-view'

// locals
import SVGBackground from './SVGBackground'
import { LinearSyntenyViewModel } from '../model'

type LSV = LinearSyntenyViewModel

// render LGV to SVG
export async function renderToSvg(model: LSV, opts: any) {
  await when(() => model.initialized)
  const {
    paddingHeight = 20,
    textHeight = 20,
    headerHeight = 40,
    rulerHeight = 50,
    fontSize = 15,
    Wrapper = ({ children }: any) => <>{children}</>,
  } = opts
  const session = getSession(model)
  const { width, views } = model
  const shift = 50
  const offset = headerHeight + rulerHeight + 20

  const heights = views.map(view =>
    totalHeight(view.tracks, paddingHeight, textHeight),
  )
  const totalHeightSvg = sum(heights)
  const displayResults = await Promise.all(
    views.map(
      async view =>
        [
          view,
          await Promise.all(
            view.tracks.map(async track => {
              const display = track.displays[0]
              await when(() =>
                display.ready !== undefined ? display.ready : true,
              )
              return { track, result: await display.renderSvg(opts) }
            }),
          ),
        ] as const,
    ),
  )

  // the xlink namespace is used for rendering <image> tag
  return renderToStaticMarkup(
    <ThemeProvider theme={createJBrowseTheme(session.theme)}>
      <Wrapper>
        <svg
          width={width}
          height={totalHeightSvg}
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox={[0, 0, width + shift * 2, totalHeightSvg].toString()}
        >
          <SVGBackground width={width} height={totalHeightSvg} shift={shift} />
          {displayResults.map(([view, displayResult], i) => (
            <g
              stroke="none"
              transform={`translate(${shift} ${
                fontSize + (heights[i - 1] || 0)
              })`}
            >
              <SVGTracks
                paddingHeight={paddingHeight}
                textHeight={textHeight}
                fontSize={fontSize}
                model={view}
                displayResults={displayResult}
                offset={offset}
              />
            </g>
          ))}
        </svg>
      </Wrapper>
    </ThemeProvider>,
  )
}
