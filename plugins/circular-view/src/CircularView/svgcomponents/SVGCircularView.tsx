import { Fragment } from 'react'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getSession, radToDeg, renderToStaticMarkup } from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { when } from 'mobx'

import SVGBackground from './SVGBackground.tsx'
import Ruler from '../components/Ruler.tsx'

import type { CircularViewModel, ExportSvgOptions } from '../model.ts'

export async function renderToSvg(
  model: CircularViewModel,
  opts: ExportSvgOptions,
) {
  await when(() => model.initialized, { timeout: 10000 })
  const { themeName = 'default', Wrapper = ({ children }) => children } = opts
  const session = getSession(model)
  const theme = session.allThemes?.()[themeName]

  const { figureSize } = model
  const tracks = [...model.tracks]
  const displayResults = await Promise.all(
    tracks.flatMap(track => {
      const display = track.displays[0]
      if (!display) {
        return []
      }
      return [
        when(() => display.ready, { timeout: 10000 }).then(async () => ({
          track,
          result: await display.renderSvg({ ...opts, theme }),
        })),
      ]
    }),
  )

  const { staticSlices, offsetRadians, centerXY } = model
  const deg = radToDeg(offsetRadians)

  // the xlink namespace is used for rendering <image> tag
  return renderToStaticMarkup(
    <ThemeProvider theme={createJBrowseTheme(theme)}>
      <Wrapper>
        <svg
          width={figureSize}
          height={figureSize}
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
        >
          <SVGBackground width={figureSize} height={figureSize} />
          <g transform={`translate(${centerXY}) rotate(${deg})`}>
            {staticSlices.map(slice => (
              <Ruler key={slice.key} model={model} slice={slice} />
            ))}
            {displayResults.map(({ track, result }) => (
              <Fragment key={track.id}>{result}</Fragment>
            ))}
          </g>
        </svg>
      </Wrapper>
    </ThemeProvider>,
  )
}
