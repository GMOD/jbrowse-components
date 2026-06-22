import { Fragment } from 'react'

import { SVGExportRoot } from '@jbrowse/core/svg/SvgExport'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getSession, radToDeg, renderToStaticMarkup } from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { when } from 'mobx'

import Ruler from '../components/Ruler.tsx'

import type { CircularViewModel, ExportSvgOptions } from '../model.ts'

export async function renderToSvg(
  model: CircularViewModel,
  opts: ExportSvgOptions,
) {
  await when(() => model.initialized)
  const { themeName = 'default', Wrapper = ({ children }) => children } = opts
  const session = getSession(model)
  const theme = session.allThemes?.()[themeName]

  const { figureSize } = model
  const tracks = [...model.tracks]
  const displayResults = await Promise.all(
    tracks.map(async track => ({
      track,
      result: await track.displays[0]!.renderSvg({ ...opts, theme }),
    })),
  )

  const { staticSlices, offsetRadians, centerXY } = model
  const deg = radToDeg(offsetRadians)

  // the xlink namespace is used for rendering <image> tag
  return renderToStaticMarkup(
    <ThemeProvider theme={createJBrowseTheme(theme)}>
      <Wrapper>
        <SVGExportRoot width={figureSize} height={figureSize} margin={0}>
          <g transform={`translate(${centerXY}) rotate(${deg})`}>
            {staticSlices.map(slice => (
              <Ruler key={slice.key} model={model} slice={slice} />
            ))}
            {displayResults.map(({ track, result }) => (
              <Fragment key={track.id}>{result}</Fragment>
            ))}
          </g>
        </SVGExportRoot>
      </Wrapper>
    </ThemeProvider>,
  )
}
