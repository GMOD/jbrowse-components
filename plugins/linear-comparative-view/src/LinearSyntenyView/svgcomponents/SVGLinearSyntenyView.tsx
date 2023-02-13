import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { when } from 'mobx'
import { getSession, renderToAbstractCanvas, sum } from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { createJBrowseTheme } from '@jbrowse/core/ui'

// locals
import {
  SVGTracks,
  SVGRuler,
  totalHeight,
} from '@jbrowse/plugin-linear-genome-view'

// locals
import SVGBackground from './SVGBackground'
import { ExportSvgOptions, LinearSyntenyViewModel } from '../model'
import { drawRef } from '../../LinearSyntenyDisplay/drawSynteny'

type LSV = LinearSyntenyViewModel

// render LGV to SVG
export async function renderToSvg(model: LSV, opts: ExportSvgOptions) {
  await when(() => model.initialized)
  const {
    textHeight = 20,
    headerHeight = 40,
    rulerHeight = 50,
    fontSize = 15,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Wrapper = ({ children }: any) => <>{children}</>,
  } = opts
  const session = getSession(model)
  const { width, views, middleComparativeHeight, tracks } = model
  const shift = 50
  const offset = headerHeight + rulerHeight + 20

  const heights = views.map(
    view => totalHeight(view.tracks, textHeight) + offset,
  )
  const totalHeightSvg = sum(heights) + middleComparativeHeight + 100
  const displayResults = await Promise.all(
    views.map(
      async view =>
        ({
          view,
          data: await Promise.all(
            view.tracks.map(async track => {
              const d = track.displays[0]
              await when(() => (d.ready !== undefined ? d.ready : true))
              return { track, result: await d.renderSvg(opts) }
            }),
          ),
        } as const),
    ),
  )

  const renderings = await Promise.all(
    tracks.map(track =>
      renderToAbstractCanvas(
        width,
        middleComparativeHeight,
        { highResolutionScaling: 1, exportSVG: opts },
        ctx => drawRef(track.displays[0], ctx),
      ),
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
          <g transform={`translate(${shift} ${fontSize})`}>
            <SVGRuler
              model={displayResults[0].view}
              fontSize={fontSize}
              width={displayResults[0].view.width}
            />
            <SVGTracks
              textHeight={textHeight}
              fontSize={fontSize}
              model={displayResults[0].view}
              displayResults={displayResults[0].data}
              offset={offset}
            />
          </g>
          <g transform={`translate(${shift} ${fontSize + heights[0]})`}>
            {
              // @ts-ignore
              renderings.map(r => r.reactElement)
            }
          </g>
          <g
            transform={`translate(${shift} ${
              fontSize + heights[0] + middleComparativeHeight
            })`}
          >
            <SVGRuler
              model={displayResults[1].view}
              fontSize={fontSize}
              width={displayResults[1].view.width}
            />
            <SVGTracks
              textHeight={textHeight}
              fontSize={fontSize}
              model={displayResults[1].view}
              displayResults={displayResults[1].data}
              offset={offset}
            />
          </g>
        </svg>
      </Wrapper>
    </ThemeProvider>,
  )
}
