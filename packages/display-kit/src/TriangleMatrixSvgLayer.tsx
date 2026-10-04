import { canvasWideBlocks } from '@jbrowse/render-core/renderBlock'

import MarkSvgLayer from './MarkSvgLayer.tsx'

import type { TriangleFrame } from './TriangleMatrixMixin.ts'
import type { PaintLayerOpts } from '@jbrowse/core/util/paintLayer'
import type { Mark } from '@jbrowse/render-core/marks'

/**
 * A triangle display's matrix in the SVG export: the display's own marks and
 * render state, in one canvas-wide block below `top`.
 */
export default function TriangleMatrixSvgLayer<D, S extends TriangleFrame>({
  marks,
  regions,
  state,
  width,
  height,
  top,
  opts,
}: {
  marks: readonly Mark<D, S>[]
  regions: ReadonlyMap<number, D>
  state: S
  width: number
  height: number
  top: number
  opts?: PaintLayerOpts
}) {
  return (
    <g transform={`translate(0 ${top})`}>
      <MarkSvgLayer
        marks={marks}
        regions={regions}
        blocks={canvasWideBlocks([0], width)}
        state={state}
        width={width}
        height={height - top}
        opts={opts}
      />
    </g>
  )
}
