import { SVGExportRoot } from '@jbrowse/core/svg/SvgExport'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getEnv, getSession, renderToStaticMarkup } from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { when } from 'mobx'

import { HorizontalAxisRaw, VerticalAxisRaw } from '../components/Axes.tsx'
import DotplotGrid from '../components/DotplotGrid.tsx'

import type { DotplotViewModel, ExportSvgOptions } from '../model.ts'

// render LGV to SVG
export async function renderToSvg(
  model: DotplotViewModel,
  opts: ExportSvgOptions,
) {
  await when(() => model.initialized)
  const { themeName = 'default', Wrapper = ({ children }) => children } = opts

  const session = getSession(model)
  const theme = session.allThemes?.()[themeName]
  const { width, borderX, viewWidth, viewHeight, tracks, height } = model
  const displayResults = await Promise.all(
    tracks.map(async track => {
      const display = track.displays[0]
      return { track, result: await display.renderSvg({ ...opts, theme }) }
    }),
  )

  const { pluginManager } = getEnv(model)
  const additional = pluginManager.evaluateExtensionPoint(
    'DotplotView-OverlaySVGComponent',
    [],
    { model },
  )

  // the xlink namespace is used for rendering <image> tag
  return renderToStaticMarkup(
    <ThemeProvider theme={createJBrowseTheme(theme)}>
      <Wrapper>
        <SVGExportRoot width={width} height={height}>
          <VerticalAxisRaw model={model} />
          <g transform={`translate(${borderX} 0)`}>
            <DotplotGrid model={model} />
            {additional}
            <defs>
              <clipPath id="clip-ruler">
                <rect x={0} y={0} width={viewWidth} height={viewHeight} />
              </clipPath>
            </defs>
            <g clipPath="url(#clip-ruler)">
              {displayResults.map(({ track, result }) => (
                /* biome-ignore lint/suspicious/noArrayIndexKey: */
                <g key={track.configuration.trackId}>{result}</g>
              ))}
            </g>
          </g>
          <g transform={`translate(${borderX} ${viewHeight})`}>
            <HorizontalAxisRaw model={model} />
          </g>
        </SVGExportRoot>
      </Wrapper>
    </ThemeProvider>,
  )
}
