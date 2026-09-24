import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'
import { canvasWideBlocks } from '@jbrowse/render-core/renderBlock'

import type { TriangleFrame } from './TriangleMatrixMixin.ts'
import type { PaintLayerOpts } from '@jbrowse/core/util/paintLayer'
import type { Mark } from '@jbrowse/render-core/marks'

/**
 * A triangle display's matrix in the SVG export: the display's own marks and
 * render state, painted into a layer of the export's width below `top`.
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
      <PaintLayer
        width={width}
        height={height - top}
        opts={opts}
        paint={ctx => {
          paintMarkBlocks(ctx, marks, regions, canvasWideBlocks([0], width), {
            ...state,
            canvasWidth: width,
          })
        }}
      />
    </g>
  )
}
