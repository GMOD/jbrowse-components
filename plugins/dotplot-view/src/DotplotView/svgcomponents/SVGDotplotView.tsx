import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { exportMargin } from '@jbrowse/core/svg/constants'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { getEnv, getSession } from '@jbrowse/core/util'
import { when } from 'mobx'

import { SVGColorByLegend } from './SVGColorByLegend.tsx'
import { HorizontalAxisRaw, VerticalAxisRaw } from '../components/Axes.tsx'
import DotplotGrid from '../components/DotplotGrid.tsx'

import type { DotplotViewModel, ExportSvgOptions } from '../model.ts'
import type { SyntenyColorBy } from '@jbrowse/synteny-core'

// render the dotplot view to an SVG string
export async function renderToSvg(
  model: DotplotViewModel,
  opts: ExportSvgOptions,
) {
  await when(() => model.initialized)
  const { themeName = 'default', Wrapper } = opts

  const session = getSession(model)
  const theme = session.getActiveThemeOptions?.(themeName)
  const { width, borderX, viewWidth, viewHeight, tracks, height } = model
  const legendColorBy = model.showColorLegend
    ? (model.dotplotDisplays[0]?.colorBy as SyntenyColorBy | undefined)
    : undefined
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
      <g transform={`translate(${exportMargin} 0)`}>
        <VerticalAxisRaw model={model} />
        <g transform={`translate(${borderX} 0)`}>
          <DotplotGrid model={model} />
          <SvgClipRect
            id={`clip-ruler-${model.id}`}
            width={viewWidth}
            height={viewHeight}
          >
            {additional}
            {displayResults.map(({ track, result }) => (
              <g key={track.configuration.trackId}>{result}</g>
            ))}
          </SvgClipRect>
          {legendColorBy ? (
            <SVGColorByLegend colorBy={legendColorBy} viewWidth={viewWidth} />
          ) : null}
        </g>
        <g transform={`translate(${borderX} ${viewHeight})`}>
          <HorizontalAxisRaw model={model} />
        </g>
      </g>
    ),
  })
}
