import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { axisPlotBox } from '@jbrowse/display-ui'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'

import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { Mark, MarkFrame } from '@jbrowse/render-core/marks'
import type React from 'react'

export interface ScorePlotSvgModel extends SvgExportable {
  id: string
  height: number
}

/**
 * The SVG-export body of a display with a score axis, mounted through
 * `renderDisplaySvg`, which draws the axis and cross-hatches. Paints `marks`
 * over `regions` inside the plot box, at the export's width and the box's
 * height — the two fields of `renderState` the on-screen canvas sizes
 * differently. `plotGeometry` defaults to the single-plot box `ScorePlotChrome`
 * draws in; multi-wiggle stacks its rows over the full height instead.
 * `children` draw over the plot, in the same untranslated space as the axis.
 */
export function ScorePlotSvgFrame<TRegion, TState extends MarkFrame>({
  model,
  height,
  canvasWidth,
  renderBlocks,
  opts,
  clipIdPrefix,
  plotGeometry = axisPlotBox(height),
  marks,
  regions,
  renderState,
  children,
}: LgvSvgBodyProps<ScorePlotSvgModel> & {
  clipIdPrefix: string
  plotGeometry?: { yTop: number; plotHeight: number }
  marks: readonly Mark<TRegion, TState>[]
  regions: ReadonlyMap<number, TRegion>
  renderState: TState
  children?: React.ReactNode
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
              paintMarkBlocks(ctx, marks, regions, renderBlocks, {
                ...renderState,
                canvasWidth,
                canvasHeight: plotHeight,
              })
            }}
          />
        </g>
      </SvgClipRect>
      {children}
    </>
  )
}
