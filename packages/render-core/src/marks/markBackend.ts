import { forEachClippedBlock } from '../canvas2dUtils.ts'
import { createRenderingBackend } from '../createRenderingBackend.ts'
import {
  Canvas2DPerRegionRenderingBackend,
  GpuPerRegionRenderingBackend,
} from '../perRegionRenderingBackend.ts'

import type { BlockClipResult } from '../blockClipUtils.ts'
import type { GpuHal } from '../hal/index.ts'
import type { SampleCount } from '../hal/types.ts'
import type { PerRegionRenderingBackend } from '../perRegionRenderingBackend.ts'
import type { RenderBlock } from '../renderBlock.ts'
import type { FrameDimensions } from '../renderingBackendBase.ts'
import type { Mark, MarkContext2D } from './types.ts'

/**
 * Paint one frame's blocks with a mark list — the Canvas2D half of a
 * declaration, and the SVG export path, since `MarkContext2D` is satisfied by
 * both a real 2D context and the SVG one.
 *
 * Exported on its own because SVG export runs it against the model's data map
 * with the export's own canvas dimensions rather than through a backend.
 */
export function paintMarkBlocks<TRegion, TState extends FrameDimensions>(
  ctx: MarkContext2D,
  marks: readonly Mark<TRegion, TState>[],
  regions: ReadonlyMap<number, TRegion>,
  blocks: RenderBlock[],
  state: TState,
) {
  forEachClippedBlock(
    ctx,
    blocks,
    state.canvasWidth,
    state.canvasHeight,
    block => regions.get(block.displayedRegionIndex),
    (region, block) => {
      for (const mark of marks) {
        mark.paintBlock(ctx, region, block, state)
      }
    },
  )
}

class GpuMarkBackend<
  TRegion,
  TState extends FrameDimensions,
> extends GpuPerRegionRenderingBackend<TRegion, TState> {
  protected regionPasses

  constructor(
    hal: GpuHal,
    uniformByteSize: number,
    private marks: readonly Mark<TRegion, TState>[],
  ) {
    super(hal, uniformByteSize)
    this.regionPasses = marks.map(m => m.pass)
  }

  protected drawRegion(
    block: RenderBlock,
    clip: BlockClipResult,
    region: TRegion,
    state: TState,
  ) {
    for (const mark of this.marks) {
      mark.drawRegion(this.hal, this.uniformData, block, clip, region, state)
    }
  }
}

class Canvas2DMarkBackend<
  TRegion,
  TState extends FrameDimensions,
> extends Canvas2DPerRegionRenderingBackend<TRegion, TState> {
  constructor(
    canvas: HTMLCanvasElement,
    private marks: readonly Mark<TRegion, TState>[],
  ) {
    super(canvas)
  }

  protected draw(
    blocks: RenderBlock[],
    regions: ReadonlyMap<number, TRegion>,
    state: TState,
  ) {
    paintMarkBlocks(this.ctx, this.marks, regions, blocks, state)
  }
}

/**
 * Build a display's rendering backend from its mark declarations.
 *
 * This is the whole of what a display used to spell as a `GpuXxxRenderer`
 * class, a `Canvas2DXxxRenderer` class, a pass list and a factory: the passes
 * are the marks' own, the uniform scratch is sized to the largest shape's, and
 * each backend walks the same list.
 *
 * One uniform buffer serves every mark because each writes its own layout into
 * the scratch immediately before its own `drawPass`, which is what the HAL's
 * write-then-draw ordering already guarantees for a multi-pass renderer.
 */
export function createMarkBackend<TRegion, TState extends FrameDimensions>(
  canvas: HTMLCanvasElement,
  marks: readonly Mark<TRegion, TState>[],
  opts: { sampleCount?: SampleCount } = {},
): Promise<PerRegionRenderingBackend<TRegion, TState>> {
  const uniformByteSize = Math.max(...marks.map(m => m.uniformByteSize))
  return createRenderingBackend<PerRegionRenderingBackend<TRegion, TState>>(
    canvas,
    {
      passes: marks.map(m => m.pass),
      uniformByteSize,
      sampleCount: opts.sampleCount,
      createGpuBackend: hal => new GpuMarkBackend(hal, uniformByteSize, marks),
      createCanvas2DBackend: c => new Canvas2DMarkBackend(c, marks),
    },
  )
}
