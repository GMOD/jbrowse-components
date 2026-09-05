import { createRenderingBackend } from '../createRenderingBackend.ts'
import {
  Canvas2DPerRegionRenderingBackend,
  GpuPerRegionRenderingBackend,
} from '../perRegionRenderingBackend.ts'
import { paintMarkBlocks } from './markPaint.ts'

import type { BlockClipResult } from '../blockClipUtils.ts'
import type { GpuHal } from '../hal/index.ts'
import type { SampleCount } from '../hal/types.ts'
import type { PerRegionRenderingBackend } from '../perRegionRenderingBackend.ts'
import type { RenderBlock } from '../renderBlock.ts'
import type { FrameDimensions } from '../renderingBackendBase.ts'
import type { Mark } from './types.ts'

/**
 * The HAL-side half of `createMarkBackend`, exported so a display's mark list
 * can be driven against `MockHal`: which marks upload, which draw off another's
 * buffer, and which blocks a shape declines.
 */
export class GpuMarkBackend<
  TRegion,
  TState extends FrameDimensions,
> extends GpuPerRegionRenderingBackend<TRegion, TState> {
  protected regionPasses

  constructor(
    hal: GpuHal,
    private marks: readonly Mark<TRegion, TState>[],
  ) {
    super(hal)
    // a mark drawing off another's buffer is registered but never uploaded to
    this.regionPasses = marks.filter(m => !m.bufferOf).map(m => m.pass)
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
 * **This is the only module on the mark path that reaches the HAL**, which is
 * why it is not on the `marks` subpath: a display's declaration, its painter
 * and its hit test are all things a state model can legitimately reach, and a
 * state model is eager (ADR-091). Reaching the backend costs the GPU stack at
 * plugin-install time, so it is a separate import a display makes once, from
 * the factory the component hands to `DisplayChrome`.
 *
 * This is the whole of what a display used to spell as a `GpuXxxRenderer`
 * class, a `Canvas2DXxxRenderer` class, a pass list and a factory: the passes
 * are the marks' own and each backend walks the same list.
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
  return createRenderingBackend<PerRegionRenderingBackend<TRegion, TState>>(
    canvas,
    {
      passes: marks.map(m => m.pass),
      sampleCount: opts.sampleCount,
      createGpuBackend: hal => new GpuMarkBackend(hal, marks),
      createCanvas2DBackend: c => new Canvas2DMarkBackend(c, marks),
    },
  )
}
