import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { getEnv, getSession } from '@jbrowse/core/util'
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
  const theme = session.getActiveThemeOptions?.(themeName)
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
  return wrapSvgExport({
    theme,
    width,
    height,
    Wrapper,
    children: (
      <>
        <VerticalAxisRaw model={model} />
        <g transform={`translate(${borderX} 0)`}>
          <DotplotGrid model={model} />
          {additional}
          <SvgClipRect
            id={`clip-ruler-${model.id}`}
            width={viewWidth}
            height={viewHeight}
          >
            {displayResults.map(({ track, result }) => (
              /* biome-ignore lint/suspicious/noArrayIndexKey: */
              <g key={track.configuration.trackId}>{result}</g>
            ))}
          </SvgClipRect>
        </g>
        <g transform={`translate(${borderX} ${viewHeight})`}>
          <HorizontalAxisRaw model={model} />
        </g>
      </>
    ),
  })
}
