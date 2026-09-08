import { COLOR_RAMP_LUT_ENTRIES, uploadColorRampLut } from '../colorRampLut.ts'
import { createRenderingBackend } from '../createRenderingBackend.ts'
import { uploadPass } from '../instancePass.ts'
import {
  Canvas2DPerRegionRenderingBackend,
  GpuPerRegionRenderingBackend,
} from '../perRegionRenderingBackend.ts'
import { paintMarkBlocks } from './markPaint.ts'

import type { BlockClipResult } from '../blockClipUtils.ts'
import type { GpuHal } from '../hal/index.ts'
import type { SampleCount } from '../hal/types.ts'
import type { InstancePass } from '../instancePass.ts'
import type {
  ClearColor,
  PerRegionRenderingBackend,
} from '../perRegionRenderingBackend.ts'
import type { RenderBlock } from '../renderBlock.ts'
import type { FrameDimensions } from '../renderingBackendBase.ts'
import type { Mark, StagedUniforms } from './types.ts'

// The passes a mark list owns a buffer for: the whole list minus those drawing
// off another's (`bufferOf`). Uploading to a borrowed pass is silent and its
// buffer is the lender's, so the skip is stated once, here — module-local,
// because `marks/backend` is a published subpath and nothing outside wants it.
function ownedPasses<TRegion, TState extends FrameDimensions>(
  marks: readonly Mark<TRegion, TState>[],
) {
  return marks.filter(m => !m.bufferOf).map(m => m.pass)
}

/** Pack and upload one region's buffers for a mark list. */
export function uploadMarks<TRegion, TState extends FrameDimensions>(
  hal: GpuHal,
  regionKey: number,
  marks: readonly Mark<TRegion, TState>[],
  data: TRegion,
) {
  for (const pass of ownedPasses(marks)) {
    uploadPass(hal, regionKey, pass, data)
  }
}

/**
 * Draw one already-clipped block through a mark list.
 *
 * **The viewport is this helper's, the scissor is the caller's.** Every shape
 * maps bp across the block column, so nobody wants a viewport narrower than the
 * clip; a caller does want a narrower scissor, which is how alignments clips a
 * coverage strip inside the column it hands over. `GpuPerRegionRenderingBackend`
 * sets both per block already, so for a backend on that scaffold the viewport
 * set here is the same rect twice.
 *
 * A caller that narrows it must hand over marks declaring no `band`, and that
 * is the one way the two clips do not compose: a banded mark scissors to its
 * strip and hands the BLOCK COLUMN back rather than what the caller had. The
 * split is deliberate — `render-core/CLAUDE.md` §Drawing has which displays
 * take which side — but nothing enforces it, so it is stated at both.
 */
export function drawMarks<TRegion, TState extends FrameDimensions>(
  hal: GpuHal,
  scratch: ArrayBuffer,
  marks: readonly Mark<TRegion, TState>[],
  block: RenderBlock,
  clip: BlockClipResult,
  region: TRegion,
  state: TState,
  regionKey: number,
) {
  hal.setViewport(clip.pxX, 0, clip.pxW, clip.pxH)
  // One call is one block, which is exactly the life of a `StagedUniforms`
  const staged: StagedUniforms = { writer: undefined, params: undefined }
  for (const mark of marks) {
    mark.drawRegion(hal, scratch, block, clip, region, state, regionKey, staged)
  }
}

// What a textured pass binds while its mark names no ramp: a shader declares
// its sampler unconditionally, and a textured pass with no texture never draws
// on the WebGPU HAL.
const INERT_RAMP = new Uint8Array(COLOR_RAMP_LUT_ENTRIES * 4)

/**
 * The HAL-side half of `createMarkBackend`, exported so a display's mark list
 * can be driven against `MockHal`: which marks upload, which draw off another's
 * buffer, and which blocks a shape declines.
 */
export class GpuMarkBackend<
  TRegion,
  TState extends FrameDimensions,
> extends GpuPerRegionRenderingBackend<TRegion, TState> {
  // The base's upload loop already IS the mark walk, so this backend names its
  // passes instead of overriding `upload` with a second spelling of it.
  protected regionPasses: InstancePass<TRegion>[]

  constructor(
    hal: GpuHal,
    private marks: readonly Mark<TRegion, TState>[],
    private clear?: (state: TState) => ClearColor,
  ) {
    super(hal)
    this.regionPasses = ownedPasses(marks)
  }

  protected override clearColor(state: TState) {
    return this.clear ? this.clear(state) : super.clearColor(state)
  }

  // The ramp each textured pass holds, by the table's identity — the mirror of
  // the one texture the HAL keeps per pass, so an unchanged ramp costs a frame
  // nothing and a backend rebuilt after context loss re-uploads. Per pass and
  // per backend, never per region.
  private boundRamps = new Map<string, Uint8Array>()

  private bindRamp(
    mark: Mark<TRegion, TState>,
    region: TRegion,
    state: TState,
  ) {
    if (mark.texture) {
      const ramp = mark.texture(state, region) ?? INERT_RAMP
      if (ramp !== this.boundRamps.get(mark.pass.id)) {
        uploadColorRampLut(this.hal, ramp, [mark.pass.id])
        this.boundRamps.set(mark.pass.id, ramp)
      }
    }
  }

  protected drawRegion(
    block: RenderBlock,
    clip: BlockClipResult,
    region: TRegion,
    state: TState,
  ) {
    for (const mark of this.marks) {
      this.bindRamp(mark, region, state)
    }
    drawMarks(
      this.hal,
      this.uniformData,
      this.marks,
      block,
      clip,
      region,
      state,
      block.displayedRegionIndex,
    )
  }
}

/**
 * The Canvas2D half, exported for the same reason `GpuMarkBackend` is: a
 * display's frame scaffold — the ground it clears to, the blocks it paints — is
 * a property of the pair, and a suite pinning it on one backend has to pin it
 * on the other.
 */
export class Canvas2DMarkBackend<
  TRegion,
  TState extends FrameDimensions,
> extends Canvas2DPerRegionRenderingBackend<TRegion, TState> {
  constructor(
    canvas: HTMLCanvasElement,
    private marks: readonly Mark<TRegion, TState>[],
    private clear?: (state: TState) => ClearColor,
  ) {
    super(canvas)
  }

  protected override clearColor(state: TState) {
    return this.clear ? this.clear(state) : super.clearColor(state)
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
 * write-then-draw ordering already guarantees for a multi-pass renderer — or
 * draws off the struct the previous mark of the same block already staged, per
 * `StagedUniforms`.
 */
export function createMarkBackend<TRegion, TState extends FrameDimensions>(
  canvas: HTMLCanvasElement,
  marks: readonly Mark<TRegion, TState>[],
  opts: {
    sampleCount?: SampleCount
    /**
     * What the frame is cleared to, when transparent is the wrong answer. The
     * GPU side hands it to `beginFrame` and the Canvas2D side fills it after
     * `prepareCanvas`, so both backends composite over the same colour — which
     * synteny needs, its indel wedges being pre-blended against the band's
     * ground rather than composited over it.
     */
    clearColor?: (state: TState) => ClearColor
  } = {},
): Promise<PerRegionRenderingBackend<TRegion, TState>> {
  const { clearColor } = opts
  return createRenderingBackend<PerRegionRenderingBackend<TRegion, TState>>(
    canvas,
    {
      passes: marks.map(m => m.pass),
      sampleCount: opts.sampleCount,
      createGpuBackend: hal => new GpuMarkBackend(hal, marks, clearColor),
      createCanvas2DBackend: c => new Canvas2DMarkBackend(c, marks, clearColor),
    },
  )
}
