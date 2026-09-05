import { devicePxBand, withClip } from '../canvas2dUtils.ts'

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
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  fillRect(x: number, y: number, w: number, h: number): void
  strokeRect(x: number, y: number, w: number, h: number): void
  translate(x: number, y: number): void
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
  stroke(): void
}

export type MarkFrame = FrameDimensions

/** A horizontal strip of the canvas, in CSS px down from its top edge. */
export interface MarkBand {
  top: number
  height: number
}

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
   * Whether the shape has any ink on this block at all, decided from the
   * block's place in the frame rather than its instances. Both backends skip
   * the block when it says no. Optional: a shape whose every block can carry
   * ink leaves it off. The canvas continuation marker is the one that needs
   * it — it exists only where a block meets a canvas edge, and an interior
   * block would otherwise shade a whole pileup's worth of vertices to draw
   * nothing.
   */
  paintsBlock?(block: RenderBlock, frame: MarkFrame, params: TParams): boolean
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
  /**
   * The pass id whose instance buffer this mark draws from, for a mark that
   * is registered but never uploaded to: the canvas chevrons ride the line
   * buffer and the continuation markers ride rect's. `defineMark` refuses the
   * pairing unless the two passes declare one instance struct.
   */
  readonly bufferOf?: string
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
 * the render state's values reach the uniforms — and which of the region's,
 * for a value the payload carries rather than the frame (the variant matrix's
 * column count). Both run once per block per frame, never per instance.
 *
 * `bufferOf` names the mark whose uploaded buffer this one draws from, so the
 * declaration says what the HAL's `drawPass(id, region, bufferPassId)` says:
 * the chevron mark's channels are the line mark's, packed once under the line
 * pass.
 *
 * `band` is the strip of the canvas the mark is clipped to, for a display that
 * stacks bands on one canvas (MAF's coverage strip over its rows viewport).
 * The GPU scissors to it and Canvas2D clips to it, a zero-height band draws
 * nothing, and the shape still places Y against the whole canvas — the band is
 * a clip, never an offset, which is what lets one `scrollTop` serve both
 * backends. A mark without one paints wherever its shape puts ink.
 */
export function defineMark<
  TRegion,
  TState extends MarkFrame,
  TChannels,
  TParams,
>(spec: {
  shape: MarkShape<TChannels, TParams>
  channels: (region: TRegion) => TChannels
  params: (state: TState, region: TRegion) => TParams
  bufferOf?: Mark<TRegion, TState>
  band?: (state: TState) => MarkBand
}): Mark<TRegion, TState> {
  const { shape, channels, params, band } = spec
  const lender = spec.bufferOf?.pass
  if (
    lender &&
    (lender.instanceStride !== shape.pass.instanceStride ||
      JSON.stringify(lender.vertexAttributes) !==
        JSON.stringify(shape.pass.vertexAttributes))
  ) {
    throw new Error(
      `mark ${shape.id} draws off ${lender.id}'s buffer but declares a different instance struct`,
    )
  }
  const bufferOf = lender?.id
  return {
    pass: { ...shape.pass, pack: region => shape.pass.pack(channels(region)) },
    bufferOf,
    drawRegion(hal, scratch, block, clip, region, state) {
      const strip = band?.(state)
      const scissor = strip
        ? devicePxBand(strip.top, strip.height, clip.scaleY, clip.pxH)
        : undefined
      if (scissor && scissor.height === 0) {
        return
      }
      const p = params(state, region)
      if (shape.paintsBlock && !shape.paintsBlock(block, state, p)) {
        return
      }
      if (scissor) {
        hal.setScissor(clip.pxX, scissor.top, clip.pxW, scissor.height)
      }
      shape.writeUniforms(scratch, clip, block, state, p)
      hal.writeUniforms(scratch)
      hal.drawPass(shape.pass.id, block.displayedRegionIndex, bufferOf)
      if (scissor) {
        hal.setScissor(clip.pxX, 0, clip.pxW, clip.pxH)
      }
    },
    paintBlock(ctx, region, block, state) {
      const strip = band?.(state)
      if (strip && strip.height <= 0) {
        return
      }
      const p = params(state, region)
      if (shape.paintsBlock && !shape.paintsBlock(block, state, p)) {
        return
      }
      const paint = () => {
        shape.paintBlock(ctx, channels(region), block, state, p)
      }
      if (strip) {
        withClip(ctx, 0, strip.top, state.canvasWidth, strip.height, paint)
      } else {
        paint()
      }
    },
    hitNearest: shape.hitNearest
      ? (region, block, state, xPx, yPx, candidates, maxDistSq) =>
          bandExcludes(band?.(state), yPx)
            ? undefined
            : shape.hitNearest!(
                channels(region),
                block,
                state,
                params(state, region),
                xPx,
                yPx,
                candidates,
                maxDistSq,
              )
      : undefined,
  }
}

function bandExcludes(strip: MarkBand | undefined, yPx: number) {
  return (
    strip !== undefined && (yPx < strip.top || yPx > strip.top + strip.height)
  )
}
