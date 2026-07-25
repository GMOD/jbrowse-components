import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { exportMargin } from '@jbrowse/core/svg/constants'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { getEnv, getSession } from '@jbrowse/core/util'
import { SVGColorByLegend } from '@jbrowse/synteny-core'
import { when } from 'mobx'

import { HorizontalAxisRaw, VerticalAxisRaw } from '../components/Axes.tsx'
import DotplotGrid from '../components/DotplotGrid.tsx'

import type { DotplotViewModel, ExportSvgOptions } from '../model.ts'

// render the dotplot view to an SVG string
export async function renderToSvg(
  model: DotplotViewModel,
  opts: ExportSvgOptions,
) {
  await when(() => model.initialized)
  const { themeName = 'default', fontFamily, Wrapper } = opts

  const session = getSession(model)
  const theme = session.getActiveThemeOptions?.(themeName)
  const { width, borderX, viewWidth, viewHeight, height } = model
  // dotplotDisplays over tracks[].displays[0]: same displays, but typed as
  // DotplotDisplayModel instead of the view's untyped pluggable track array
  const displayResults = await Promise.all(
    model.dotplotDisplays.map(async display => ({
      id: display.id,
      node: await display.renderSvg({ ...opts, theme }),
    })),
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
    fontFamily,
    Wrapper,
    children: (
      <g transform={`translate(${exportMargin} 0)`}>
        <VerticalAxisRaw model={model} />
        <g transform={`translate(${borderX} 0)`}>
          {/* grid inside the clip, matching the on-screen grid's sized <svg>:
              its region-boundary lines can otherwise stray into the axes */}
          <SvgClipRect
            id={`clip-plot-${model.id}`}
            width={viewWidth}
            height={viewHeight}
          >
            <DotplotGrid model={model} />
            {additional}
            {displayResults.map(({ id, node }) => (
              <g key={id}>{node}</g>
            ))}
          </SvgClipRect>
          {model.showColorLegend ? (
            <SVGColorByLegend
              colorBy={model.colorBy}
              viewWidth={viewWidth}
              alpha={model.alpha}
              pointBased
            />
          ) : null}
        </g>
        <g transform={`translate(${borderX} ${viewHeight})`}>
          <HorizontalAxisRaw model={model} />
        </g>
      </g>
    ),
  })
}
