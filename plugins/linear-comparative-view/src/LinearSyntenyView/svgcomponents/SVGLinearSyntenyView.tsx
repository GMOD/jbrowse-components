import React from 'react'
import { createJBrowseTheme } from '@jbrowse/core/ui'
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
import { totalHeight } from '@jbrowse/plugin-linear-genome-view'
import { ThemeProvider } from '@mui/material'
import { when } from 'mobx'
import { getRoot } from 'mobx-state-tree'

// locals
import SVGBackground from './SVGBackground'
import SVGLinearGenomeView from './SVGLinearGenomeView'
import { drawRef } from '../../LinearSyntenyDisplay/drawSynteny'
import type { ExportSvgOptions, LinearSyntenyViewModel } from '../model'

// render LGV to SVG
export async function renderToSvg(
  model: LinearSyntenyViewModel,
  opts: ExportSvgOptions,
) {
  await when(() => model.initialized)
  const {
    textHeight = 18,
    rulerHeight = 30,
    fontSize = 13,
    trackLabels = 'offset',
    Wrapper = ({ children }) => children,
    themeName = 'default',
  } = opts
  const session = getSession(model)
  const themeVar = session.allThemes?.()[themeName]
  const { width, views, levels } = model
  const shift = 50
  const offset = rulerHeight

  const { createRootFn } = getRoot<any>(model)
  const heights = views.map(
    v => totalHeight(v.tracks, textHeight, trackLabels) + offset,
  )
  const totalHeightSvg = sum(heights) + sum(levels.map(l => l.height)) + 100

  const displayResults = await Promise.all(
    views.map(
      async view =>
        ({
          view,
          data: await Promise.all(
            view.tracks.map(async track => {
              const d = track.displays[0]
              await when(() => (d.ready !== undefined ? d.ready : true))
              return {
                track,
                result: await d.renderSvg({ ...opts, theme: themeVar }),
              }
            }),
          ),
        }) as const,
    ),
  )

  const renderings = await Promise.all(
    levels.map(
      async level =>
        await Promise.all(
          level.tracks.map(async track => {
            const d = track.displays[0]
            await when(() => (d.ready !== undefined ? d.ready : true))
            const r = await renderToAbstractCanvas(
              width,
              level.height,
              { exportSVG: opts },
              ctx => {
                drawRef(d, ctx)
                return undefined
              },
            )

            if ('imageData' in r) {
              throw new Error('found a canvas in svg export, probably a bug')
            } else if ('canvasRecordedData' in r) {
              return {
                html: await getSerializedSvg({
                  ...r,
                  width,
                  height: level.height,
                }),
              }
            } else {
              return r
            }
          }),
        ),
    ),
  )

  const trackLabelMaxLen =
    max(
      views.flatMap(view =>
        view.tracks.map(track =>
          measureText(getTrackName(track.configuration, session), fontSize),
        ),
      ),
      0,
    ) + 40
  const trackLabelOffset = trackLabels === 'left' ? trackLabelMaxLen : 0
  const w = width + trackLabelOffset
  const theme = createJBrowseTheme(themeVar)
  const RenderList = [
    <SVGLinearGenomeView
      rulerHeight={rulerHeight}
      trackLabelOffset={trackLabelOffset}
      shift={shift}
      textHeight={textHeight}
      trackLabels={trackLabels}
      displayResults={displayResults[0]}
      key={views[0]!.id}
      view={views[0]!}
      fontSize={fontSize}
    />,
  ] as React.ReactNode[]
  let currOffset = heights[0]! + fontSize + rulerHeight
  for (let i = 1; i < views.length; i++) {
    const view = views[i]!
    const level = levels[i - 1]!
    const rendering = renderings[i - 1]
    const height = heights[i]!
    const levelHeight = level.height || 0
    RenderList.push(
      <g key={view.id} transform={`translate(0 ${currOffset})`}>
        {levelHeight ? (
          <defs>
            <clipPath id={`synclip-${i}`}>
              <rect x={0} y={0} width={width} height={levelHeight} />
            </clipPath>
          </defs>
        ) : null}
        <g
          transform={`translate(${shift + trackLabelOffset} ${fontSize})`}
          clipPath={`url(#synclip-${i})`}
        >
          {rendering?.map((r, i) => (
            /* biome-ignore lint/suspicious/noArrayIndexKey: */
            <ReactRendering key={i} rendering={r} />
          ))}
        </g>
        <g transform={`translate(0 ${levelHeight})`}>
          <SVGLinearGenomeView
            rulerHeight={rulerHeight}
            shift={shift}
            trackLabelOffset={trackLabelOffset}
            textHeight={textHeight}
            trackLabels={trackLabels}
            displayResults={displayResults[i]}
            key={view.id}
            view={view}
            fontSize={fontSize}
          />
        </g>
      </g>,
    )
    currOffset += height + fontSize + rulerHeight + levelHeight
  }

  // the xlink namespace is used for rendering <image> tag
  return renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <Wrapper>
        <svg
          width={width}
          height={totalHeightSvg}
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox={[0, 0, w + shift * 2, totalHeightSvg].toString()}
        >
          <SVGBackground width={w} height={totalHeightSvg} shift={shift} />
          {RenderList}
        </svg>
      </Wrapper>
    </ThemeProvider>,
    createRootFn,
  )
}
