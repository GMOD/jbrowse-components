import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { axisPlotBox } from '@jbrowse/display-ui'

import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type React from 'react'

export interface ScorePlotSvgModel extends SvgExportable {
  id: string
  height: number
}

export interface ScorePlotSvgLayout {
  canvasWidth: number
  drawHeight: number
  renderBlocks: RenderBlock[]
}

/**
 * The SVG-export body of a display with a score axis, mounted through
 * `renderDisplaySvg`, which draws the axis and cross-hatches. Owns what has to
 * stay pixel-aligned with the on-screen canvas: the clip, the plot-box
 * translate and the paint layer's size. `plotGeometry` defaults to the
 * single-plot box `ScorePlotChrome` draws in; multi-wiggle stacks its rows over
 * the full height instead.
 */
export function ScorePlotSvgFrame({
  model,
  height,
  canvasWidth,
  renderBlocks,
  opts,
  clipIdPrefix,
  plotGeometry = axisPlotBox(height),
  paint,
  legend,
  overlay,
}: LgvSvgBodyProps<ScorePlotSvgModel> & {
  clipIdPrefix: string
  plotGeometry?: { yTop: number; plotHeight: number }
  paint: (ctx: Ctx2D, layout: ScorePlotSvgLayout) => void
  legend?: React.ReactNode
  /** drawn over the plot, in the same untranslated space as the axis */
  overlay?: React.ReactNode
}) {
  const { yTop, plotHeight } = plotGeometry
  return (
    <>
      <SvgClipRect
        id={`${clipIdPrefix}-clip-${svgNodeId(model)}`}
        width={canvasWidth}
        height={height}
      >
        <g transform={`translate(0,${yTop})`}>
          <PaintLayer
            width={canvasWidth}
            height={plotHeight}
            opts={opts}
            paint={ctx => {
              paint(ctx, { canvasWidth, drawHeight: plotHeight, renderBlocks })
            }}
          />
        </g>
      </SvgClipRect>
      {overlay}
      {legend}
    </>
  )
}
