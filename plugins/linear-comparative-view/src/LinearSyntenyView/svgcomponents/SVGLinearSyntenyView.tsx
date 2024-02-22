import React from 'react'
import { ThemeProvider } from '@mui/material'
import { getRoot } from 'mobx-state-tree'
import { when } from 'mobx'
import {
  getSession,
  getSerializedSvg,
  max,
  measureText,
  ReactRendering,
  renderToAbstractCanvas,
  renderToStaticMarkup,
  sum,
} from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { createJBrowseTheme } from '@jbrowse/core/ui'
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
    textHeight = 18,
    headerHeight = 30,
    rulerHeight = 30,
    fontSize = 13,
    trackLabels = 'offset',
    Wrapper = ({ children }) => <>{children}</>,
    themeName = 'default',
  } = opts
  const session = getSession(model)
  const theme = session.allThemes?.()[themeName]
  const { width, views, middleComparativeHeight: synH, tracks } = model
  const shift = 50
  const offset = headerHeight + rulerHeight
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { createRootFn } = getRoot<any>(model)
  const heights = views.map(
    v => totalHeight(v.tracks, textHeight, trackLabels) + offset,
  )
  const totalHeightSvg = sum(heights) + synH + 100
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
        }) as const,
    ),
  )

  const renderings = await Promise.all(
    tracks.map(async track => {
      const d = track.displays[0]
      await when(() => (d.ready !== undefined ? d.ready : true))
      const r = await renderToAbstractCanvas(
        width,
        synH,
        { exportSVG: opts },
        ctx => drawRef(d, ctx),
      )

      if ('imageData' in r) {
        throw new Error('found a canvas in svg export, probably a bug')
      } else if ('canvasRecordedData' in r) {
        return {
          html: await getSerializedSvg({
            ...r,
            width,
            height: synH,
          }),
        }
      } else {
        return r
      }
    }),
  )

  const trackLabelMaxLen =
    max(
      views.flatMap(view =>
        view.tracks.map(t =>
          measureText(getTrackName(t.configuration, session), fontSize),
        ),
      ),
      0,
    ) + 40
  const trackLabelOffset = trackLabels === 'left' ? trackLabelMaxLen : 0
  const w = width + trackLabelOffset

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

              <SVGRuler model={displayResults[0].view} fontSize={fontSize} />
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

          <defs>
            <clipPath id={'synclip'}>
              <rect x={0} y={0} width={width} height={synH} />
            </clipPath>
          </defs>
          <g
            transform={`translate(${shift + trackLabelOffset} ${
              fontSize + heights[0]
            })`}
            clipPath={`url(#synclip)`}
          >
            {renderings.map((r, i) => (
              <ReactRendering key={i} rendering={r} />
            ))}
          </g>
          <g transform={`translate(${shift} ${fontSize + heights[0] + synH})`}>
            <g transform={`translate(${trackLabelOffset})`}>
              <text x={0} fontSize={fontSize} fill={t.palette.text.primary}>
                {views[1].assemblyNames.join(', ')}
              </text>
              <SVGRuler model={displayResults[1].view} fontSize={fontSize} />
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
    createRootFn,
  )
}
