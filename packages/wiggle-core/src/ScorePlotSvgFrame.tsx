import MarkSvgLayer from '@jbrowse/display-kit/MarkSvgLayer'
import { axisPlotBox } from '@jbrowse/display-ui'

import type {
  LgvSvgBodyProps,
  LgvSvgExportable,
} from '@jbrowse/display-kit/renderDisplaySvg'
import type { Mark, MarkFrame } from '@jbrowse/render-core/marks'
import type React from 'react'

export type ScorePlotSvgModel = LgvSvgExportable

/**
 * The SVG-export body of a display with a score axis, mounted through
 * `renderDisplaySvg`, which draws the axis and cross-hatches. Paints `marks`
 * over `regions` inside the plot box. `plotGeometry` defaults to the
 * single-plot box `ScorePlotChrome` draws in; multi-wiggle stacks its rows over
 * the full height instead. `children` draw over the plot, in the same
 * untranslated space as the axis.
 */
export function ScorePlotSvgFrame<TRegion, TState extends MarkFrame>({
  height,
  canvasWidth,
  renderBlocks,
  opts,
  plotGeometry = axisPlotBox(height),
  marks,
  regions,
  renderState,
  children,
}: Pick<
  LgvSvgBodyProps<unknown>,
  'height' | 'canvasWidth' | 'renderBlocks' | 'opts'
> & {
  plotGeometry?: { yTop: number; plotHeight: number }
  marks: readonly Mark<TRegion, TState>[]
  regions: ReadonlyMap<number, TRegion>
  renderState: TState
  children?: React.ReactNode
}) {
  const { yTop, plotHeight } = plotGeometry
  return (
    <>
      <g transform={`translate(0,${yTop})`}>
        <MarkSvgLayer
          marks={marks}
          regions={regions}
          blocks={renderBlocks}
          state={renderState}
          width={canvasWidth}
          height={plotHeight}
          opts={opts}
        />
      </g>
      {children}
    </>
  )
}
