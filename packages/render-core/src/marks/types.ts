import type { BlockClipResult } from '../blockClipUtils.ts'
import type { ClipContext2D } from '../canvas2dUtils.ts'
import type { GpuHal } from '../hal/index.ts'
import type { InstancePass } from '../instancePass.ts'
import type { RenderBlock } from '../renderBlock.ts'
import type { FrameDimensions } from '../renderingBackendBase.ts'

/**
 * The 2D-context subset a shape's painter needs, structural for the same reason
 * `ClipContext2D` is: render-core must not depend on `@jbrowse/core`, where the
 * real `Ctx2D = CanvasRenderingContext2D | SvgCanvas` union lives. Both members
 * satisfy it, so a display passes its `Ctx2D` straight in — which is also what
 * makes one painter the on-screen fallback and the SVG export path.
 */
export interface MarkContext2D extends ClipContext2D {
  fillStyle: string | CanvasGradient | CanvasPattern
  fillRect(x: number, y: number, w: number, h: number): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
  ): void
  closePath(): void
  fill(): void
}

export type MarkFrame = FrameDimensions

/** Where a shape's ink sits nearest a cursor, and how far that is. */
export interface MarkHit {
  index: number
  x: number
  y: number
  distSq: number
}

/**
 * A shape: one hand-written `.slang`, one packer, one Canvas2D painter and one
 * hit test, all reading the same channel arrays.
 *
 * `TChannels` is the shape's own vocabulary — parallel typed arrays plus a
 * count. `TParams` is everything else the drawing needs, which reaches the GPU
 * as uniforms and the painter as arguments; the two must be the same values or
 * the backends diverge, which is what having one object per shape prevents.
 *
 * There is no `MarkShape` constructor. A shape is written out once and
 * admitted by a consumer rather than by completeness — the ADR-040 bar. It
 * lives here when two displays share it (`span`) or its geometry is generic
 * (`point`); a display whose shader's generated twins feed its own hit test
 * keeps the shape beside them (variants' `cellMark`) and still declares it
 * through `defineMark`.
 */
export interface MarkShape<TChannels, TParams> {
  readonly id: string
  readonly pass: InstancePass<TChannels>
  readonly uniformByteSize: number
  writeUniforms(
    scratch: ArrayBuffer,
    clip: BlockClipResult,
    block: RenderBlock,
    frame: MarkFrame,
    params: TParams,
  ): void
  paintBlock(
    ctx: MarkContext2D,
    channels: TChannels,
    block: RenderBlock,
    frame: MarkFrame,
    params: TParams,
  ): void
  /**
   * The nearest drawn ink to `(xPx, yPx)` among `candidates`, or undefined if
   * nothing beats `maxDistSq`.
   *
   * The candidate set is the caller's, not the shape's: a display with a
   * worker-built index (GWAS's Flatbush over (bp, value)) hands in what the
   * index answered, and one without hands in every instance. What the shape
   * owns is where its ink actually is — the half that drifts from the painter.
   *
   * Distance 0 means the point is on the ink `paintBlock` fills, edges
   * included, and a caller wanting containment alone passes a bound that
   * admits nothing else (`Number.MIN_VALUE`). Only a strictly nearer candidate
   * replaces the best, so on a tie the first candidate wins — a caller that
   * iterates back to front gets the last-painted mark, which is the one on
   * top. `drawAgainstHit.ts` is the sweep that holds a shape to this.
   *
   * Optional, because a shape earns it from a consumer like any other member.
   * MAF answers a hit from row/column arithmetic over the alignment rather than
   * from `span`'s channels, so it reads none.
   */
  hitNearest?(
    channels: TChannels,
    block: RenderBlock,
    frame: MarkFrame,
    params: TParams,
    xPx: number,
    yPx: number,
    candidates: Iterable<number>,
    maxDistSq: number,
  ): MarkHit | undefined
}

/**
 * A shape bound to one display's region payload and render state — what
 * `defineMark` returns and what a display actually holds.
 *
 * The shape's own generics are erased here on purpose: a display draws a list
 * of marks over heterogeneous shapes, and only the binding knows how to reach
 * either one's channels.
 */
export interface Mark<TRegion, TState extends MarkFrame> {
  readonly pass: InstancePass<TRegion>
  readonly uniformByteSize: number
  drawRegion(
    hal: GpuHal,
    scratch: ArrayBuffer,
    block: RenderBlock,
    clip: BlockClipResult,
    region: TRegion,
    state: TState,
  ): void
  paintBlock(
    ctx: MarkContext2D,
    region: TRegion,
    block: RenderBlock,
    state: TState,
  ): void
  hitNearest?(
    region: TRegion,
    block: RenderBlock,
    state: TState,
    xPx: number,
    yPx: number,
    candidates: Iterable<number>,
    maxDistSq: number,
  ): MarkHit | undefined
}

/**
 * `{ shape, channels }` over typed arrays — the declaration a display writes in
 * place of a `GpuXxxRenderer` class, a `Canvas2DXxxRenderer` class, a factory
 * and a pass list.
 *
 * `channels` and `params` are projections, not copies: `channels` names which
 * of the region's arrays feed the shape's lanes, and `params` names which of
 * the render state's values reach the uniforms. Both run once per block per
 * frame, never per instance.
 */
export function defineMark<
  TRegion,
  TState extends MarkFrame,
  TChannels,
  TParams,
>(spec: {
  shape: MarkShape<TChannels, TParams>
  channels: (region: TRegion) => TChannels
  params: (state: TState) => TParams
}): Mark<TRegion, TState> {
  const { shape, channels, params } = spec
  return {
    pass: { ...shape.pass, pack: region => shape.pass.pack(channels(region)) },
    uniformByteSize: shape.uniformByteSize,
    drawRegion(hal, scratch, block, clip, region, state) {
      shape.writeUniforms(scratch, clip, block, state, params(state))
      hal.writeUniforms(scratch)
      hal.drawPass(shape.pass.id, block.displayedRegionIndex)
    },
    paintBlock(ctx, region, block, state) {
      shape.paintBlock(ctx, channels(region), block, state, params(state))
    },
    hitNearest: shape.hitNearest
      ? (region, block, state, xPx, yPx, candidates, maxDistSq) =>
          shape.hitNearest!(
            channels(region),
            block,
            state,
            params(state),
            xPx,
            yPx,
            candidates,
            maxDistSq,
          )
      : undefined,
  }
}
