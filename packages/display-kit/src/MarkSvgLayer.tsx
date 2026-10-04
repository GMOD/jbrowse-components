import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'

import type { Ctx2D, PaintLayerOpts } from '@jbrowse/core/util/paintLayer'
import type { Mark, MarkFrame } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * A display's marks painted into one export layer, at the layer's size. The
 * layer's `width` and `height` replace the canvas box `state` carries, which
 * is the block scissor: a display's on-screen box is the track's, 2px narrower
 * than the export, and painting at it clips the rightmost column. `paint`
 * draws after the marks with the same state — the overlays the screen stacks
 * over its canvas.
 */
export default function MarkSvgLayer<TRegion, TState extends MarkFrame>({
  marks,
  regions,
  blocks,
  state,
  width,
  height,
  opts,
  paint,
}: {
  marks: readonly Mark<TRegion, TState>[]
  regions: ReadonlyMap<number, TRegion>
  blocks: RenderBlock[]
  state: TState
  width: number
  height: number
  opts?: PaintLayerOpts
  paint?: (ctx: Ctx2D, state: TState) => void
}) {
  const framed = { ...state, canvasWidth: width, canvasHeight: height }
  return (
    <PaintLayer
      width={width}
      height={height}
      opts={opts}
      paint={ctx => {
        paintMarkBlocks(ctx, marks, regions, blocks, framed)
        paint?.(ctx, framed)
      }}
    />
  )
}
