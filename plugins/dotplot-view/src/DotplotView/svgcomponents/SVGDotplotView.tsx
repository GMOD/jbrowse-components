import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { exportMargin } from '@jbrowse/core/svg/constants'
import { svgNodeId } from '@jbrowse/core/svg/svgId'
import {
  awaitSvgRenders,
  awaitViewInitialized,
} from '@jbrowse/core/svg/svgReady'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { getEnv, getSession } from '@jbrowse/core/util'
import { SVGColorByLegend } from '@jbrowse/synteny-core'

import { HorizontalAxisRaw, VerticalAxisRaw } from '../components/Axes.tsx'
import DotplotGrid from '../components/DotplotGrid.tsx'

import type { DotplotViewModel, ExportSvgOptions } from '../model.ts'

// render the dotplot view to an SVG string
export async function renderToSvg(
  model: DotplotViewModel,
  opts: ExportSvgOptions,
) {
  await awaitViewInitialized(model)
  const { themeName = 'default', fontFamily, Wrapper } = opts

  const session = getSession(model)
  const theme = session.getActiveThemeOptions?.(themeName)
  // dotplotDisplays over tracks[].displays[0]: same displays, but typed as
  // DotplotDisplayModel instead of the view's untyped pluggable track array.
  //
  // `awaitSvgRenders` rather than `Promise.all`: a failed track fails the export
  // rather than drawing itself into the plot, and every display paints this one
  // rect, so the export has to name all of them at once instead of whichever
  // rejected first.
  const displayResults = await awaitSvgRenders(
    model.dotplotDisplays.map(async display => ({
      id: display.id,
      node: await display.renderSvg({ ...opts, theme }),
    })),
  )

  // Deliberately read after those waits, not before. Each display's renderSvg
  // reads viewWidth/viewHeight for itself, once its own readiness wait resolves;
  // a zoom or a diagonalize reorder landing during the wait moves the axis
  // borders and so the plot size, and measuring up front left the clip rect and
  // the axes on the pre-wait geometry while the dots were drawn against the new
  // one. (Same ordering rule as the LGV export's track heights.)
  const { width, borderX, viewWidth, viewHeight, height } = model

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
            id={`clip-plot-${svgNodeId(model)}`}
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
              colorBy={model.uniformColorBy}
              trackChips={model.colorLegendChips}
              viewWidth={viewWidth}
              maxHeight={viewHeight}
              alpha={model.alpha}
              attributeRanges={model.attributeRanges}
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
