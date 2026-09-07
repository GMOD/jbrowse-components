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
  // Optional because only a stroked shape sets them, and a test's recording
  // context is written to the members its shapes actually touch. Both real
  // contexts carry them.
  lineCap?: CanvasLineCap
  lineJoin?: CanvasLineJoin
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
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
  ): void
  setLineDash(segments: number[]): void
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
   * The shape's draw predicate over (block, frame, params) — not over its
   * instances, which it is never handed. Both backends skip the block when it
   * says no. Optional: a shape whose every block can carry ink leaves it off.
   *
   * Placement is one use: the canvas continuation marker exists only where a
   * block meets a canvas edge, and an interior block would otherwise shade a
   * whole pileup's worth of vertices to draw nothing. Settings are the other,
   * and the general one: the coverage band's layers read `hasDomain` off
   * `params` so an unresolved autoscale draws no depth-scaled layer rather
   * than bars of arbitrary height, and `showInterbase` off it so the histogram
   * and its triangles turn off together.
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
 * Which uniform struct is standing in the HAL's current slot, so the next mark
 * of the SAME block can draw off it instead of packing and staging the same
 * bytes again. Compared by reference and never called or read for its values:
 * one writer plus one `params` lens is one struct, because `writeUniforms` sees
 * nothing but the block, the clip, the frame and what that lens returned.
 *
 * A display declaring several marks over one writer and one lens is the common
 * shape, not an edge case — the coverage band is five, the feature glyphs are
 * five — and every mark after the first was restating the previous one's write.
 *
 * **The caller owns one of these per block and hands the same one to every mark
 * of that block.** A stale one drawn against the next block's clip is silently
 * the wrong geometry, so it is a fresh object per block rather than a field
 * that has to be remembered to reset. A caller that writes uniforms of its own
 * between marks (alignments' per-section pileup write) starts a new one after
 * it, or hands none at all.
 */
export interface StagedUniforms {
  writer: unknown
  params: unknown
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
  /**
   * The 256-entry RGBA colour ramp this mark's pass samples this frame, or
   * undefined when it samples none. `createMarkBackend` uploads it per pass and
   * only when the bytes' identity moves, and binds an inert table for the
   * undefined case — a shader owns its sampler unconditionally, and a textured
   * pass with no texture never draws on the WebGPU HAL.
   */
  readonly texture?: (state: TState, region: TRegion) => Uint8Array | undefined
  // `regionKey` is the HAL key the caller uploaded this region's passes under;
  // a stacked alignments section's is not its block's displayedRegionIndex.
  // Draw through `marks/backend`'s `drawMarks`: the viewport must already be
  // the block's clip column and the scissor whatever the caller wants kept.
  drawRegion(
    hal: GpuHal,
    scratch: ArrayBuffer,
    block: RenderBlock,
    clip: BlockClipResult,
    region: TRegion,
    state: TState,
    regionKey: number,
    staged?: StagedUniforms,
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
 * `texture` is the colour ramp the mark's pass samples, for a shape that
 * resolves a per-instance scalar through a LUT (wiggle density, and the same
 * 256-entry table HiC and LD bind). It is state, not a channel: the backend
 * uploads it once per pass and re-uploads only when the bytes' identity moves,
 * so a ramp change costs one texture and no instance byte.
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
  texture?: (state: TState, region: TRegion) => Uint8Array | undefined
}): Mark<TRegion, TState> {
  const { shape, channels, params, band, texture } = spec
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
    texture,
    drawRegion(hal, scratch, block, clip, region, state, regionKey, staged) {
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
      if (staged?.writer !== shape.writeUniforms || staged.params !== params) {
        shape.writeUniforms(scratch, clip, block, state, p)
        hal.writeUniforms(scratch)
        if (staged) {
          staged.writer = shape.writeUniforms
          staged.params = params
        }
      }
      hal.drawPass(shape.pass.id, regionKey, bufferOf)
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
