import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { when } from 'mobx'
import {
  getSession,
  hydrateSerializedSvg,
  max,
  measureText,
  ReactRendering,
  renderToAbstractCanvas,
  sum,
} from '@jbrowse/core/util'
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
import { getTrackName } from '@jbrowse/core/util/tracks'

type LSV = LinearSyntenyViewModel

// render LGV to SVG
export async function renderToSvg(model: LSV, opts: ExportSvgOptions) {
  await when(() => model.initialized)
  const {
    textHeight = 18,
    headerHeight = 30,
    rulerHeight = 30,
    fontSize = 13,
    trackLabels = 'offset',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Wrapper = ({ children }: any) => <>{children}</>,
    themeName = 'default',
  } = opts
  const session = getSession(model)
  const theme = session.allThemes?.()[themeName]
  const { width, views, middleComparativeHeight, tracks } = model
  const shift = 50
  const offset = headerHeight + rulerHeight

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
              return { track, result: await d.renderSvg({ ...opts, theme }) }
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

  const trackLabelMaxLen =
    max(
      views
        .map(view =>
          view.tracks.map(
            t => measureText(getTrackName(t.configuration, session), fontSize),
            fontSize,
          ),
        )
        .flat(),
    ) + 40
  const trackLabelOffset = trackLabels === 'left' ? trackLabelMaxLen : 0
  const w = width + trackLabelOffset

  const hydratedRenderings = !opts.rasterizeLayers
    ? await Promise.all(
        renderings.map(r =>
          // @ts-ignore
          hydrateSerializedSvg({
            ...r,
            width,
            height: middleComparativeHeight,
          }).then(r => ({
            html: r.innerHTML,
          })),
        ),
      )
    : renderings

  const t = createJBrowseTheme(theme)

  // the xlink namespace is used for rendering <image> tag
  return renderToStaticMarkup(
    <ThemeProvider theme={createJBrowseTheme(theme)}>
      <Wrapper>
        <svg
          width={width}
          height={totalHeightSvg}
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox={[0, 0, w + shift * 2, totalHeightSvg].toString()}
        >
          <SVGBackground width={w} height={totalHeightSvg} shift={shift} />
          <g transform={`translate(${shift} ${fontSize})`}>
            <g transform={`translate(${trackLabelOffset})`}>
              <text x={0} fontSize={fontSize} fill={t.palette.text.primary}>
                {views[0].assemblyNames.join(', ')}
              </text>

              <SVGRuler
                model={displayResults[0].view}
                fontSize={fontSize}
                width={displayResults[0].view.width}
              />
            </g>
            <SVGTracks
              textHeight={textHeight}
              trackLabels={trackLabels}
              fontSize={fontSize}
              model={displayResults[0].view}
              displayResults={displayResults[0].data}
              offset={offset}
              trackLabelOffset={trackLabelOffset}
            />
          </g>
          <g
            transform={`translate(${shift + trackLabelOffset} ${
              fontSize + heights[0]
            })`}
          >
            {hydratedRenderings.map((r, i) => (
              // @ts-ignore
              <ReactRendering key={i} rendering={r} />
            ))}
          </g>
          <g
            transform={`translate(${shift} ${
              fontSize + heights[0] + middleComparativeHeight
            })`}
          >
            <g transform={`translate(${trackLabelOffset})`}>
              <text x={0} fontSize={fontSize} fill={t.palette.text.primary}>
                {views[1].assemblyNames.join(', ')}
              </text>
              <SVGRuler
                model={displayResults[1].view}
                fontSize={fontSize}
                width={displayResults[1].view.width}
              />
            </g>
            <SVGTracks
              textHeight={textHeight}
              trackLabels={trackLabels}
              fontSize={fontSize}
              model={displayResults[1].view}
              displayResults={displayResults[1].data}
              offset={offset}
              trackLabelOffset={trackLabelOffset}
            />
          </g>
        </svg>
      </Wrapper>
    </ThemeProvider>,
  )
}
