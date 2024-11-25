import React from 'react'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getSession, renderToStaticMarkup } from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { when } from 'mobx'
import { getRoot } from 'mobx-state-tree'

// locals
import SVGBackground from './SVGBackground'
import { HorizontalAxisRaw, VerticalAxisRaw } from '../components/Axes'
import { GridRaw } from '../components/Grid'
import type { DotplotViewModel, ExportSvgOptions } from '../model'

// render LGV to SVG
export async function renderToSvg(
  model: DotplotViewModel,
  opts: ExportSvgOptions,
) {
  await when(() => model.initialized)
  const { themeName = 'default', Wrapper = ({ children }) => children } = opts

  const { createRootFn } = getRoot<any>(model)
  const session = getSession(model)
  const theme = session.allThemes?.()[themeName]
  const { width, borderX, viewWidth, viewHeight, tracks, height } = model
  const shift = 50
  const displayResults = await Promise.all(
    tracks.map(async track => {
      const display = track.displays[0]
      await when(() => (display.ready !== undefined ? display.ready : true))
      return { track, result: await display.renderSvg({ ...opts, theme }) }
    }),
  )
  const w = width + shift * 2

  // the xlink namespace is used for rendering <image> tag
  return renderToStaticMarkup(
    <ThemeProvider theme={createJBrowseTheme(theme)}>
      <Wrapper>
        <svg
          width={width}
          height={height}
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox={[0, 0, w, height].toString()}
        >
          <SVGBackground width={w} height={height} />
          <VerticalAxisRaw model={model} />
          <g transform={`translate(${borderX} 0)`}>
            <GridRaw model={model} />
            <defs>
              <clipPath id="clip-ruler">
                <rect x={0} y={0} width={viewWidth} height={viewHeight} />
              </clipPath>
            </defs>
            <g clipPath="url(#clip-ruler)">
              {displayResults.map(({ result }, i) => (
                /* biome-ignore lint/suspicious/noArrayIndexKey: */
                <g key={i}>{result}</g>
              ))}
            </g>
          </g>
          <g transform={`translate(${borderX} ${viewHeight})`}>
            <HorizontalAxisRaw model={model} />
          </g>
        </svg>
      </Wrapper>
    </ThemeProvider>,
    createRootFn,
  )
}
