import React from 'react'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getSession, radToDeg, renderToStaticMarkup } from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { when } from 'mobx'
import { getRoot } from 'mobx-state-tree'

// locals
import SVGBackground from './SVGBackground'
import Ruler from '../components/Ruler'
import type { ExportSvgOptions, CircularViewModel } from '../models/model'

type CGV = CircularViewModel

export async function renderToSvg(model: CGV, opts: ExportSvgOptions) {
  await when(() => model.initialized)
  const { themeName = 'default', Wrapper = ({ children }) => children } = opts
  const session = getSession(model)
  const theme = session.allThemes?.()[themeName]

  const { createRootFn } = getRoot<any>(model)
  const { width, tracks, height } = model
  const shift = 50
  const displayResults = await Promise.all(
    tracks.map(async track => {
      const display = track.displays[0]
      await when(() => (display.ready !== undefined ? display.ready : true))
      return { track, result: await display.renderSvg({ ...opts, theme }) }
    }),
  )

  const { staticSlices, offsetRadians, centerXY } = model
  const deg = radToDeg(offsetRadians)

  // the xlink namespace is used for rendering <image> tag
  return renderToStaticMarkup(
    <ThemeProvider theme={createJBrowseTheme(theme)}>
      <Wrapper>
        <svg
          width={width}
          height={height}
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox={[0, 0, width + shift * 2, height].toString()}
        >
          <SVGBackground width={width} height={height} shift={shift} />
          <g transform={`translate(${centerXY}) rotate(${deg})`}>
            {staticSlices.map((slice, i) => (
              /* biome-ignore lint/suspicious/noArrayIndexKey: */
              <Ruler key={i} model={model} slice={slice} />
            ))}
            {displayResults.map(({ result }, i) => (
              /* biome-ignore lint/suspicious/noArrayIndexKey: */
              <React.Fragment key={i}>{result}</React.Fragment>
            ))}
          </g>
        </svg>
      </Wrapper>
    </ThemeProvider>,
    createRootFn,
  )
}
