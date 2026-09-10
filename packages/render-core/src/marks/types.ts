import { devicePxBand, withClip } from '../canvas2dUtils.ts'
import { shapeHitNearest } from './markHit.ts'

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
  // The transform stack, for a shape whose ink is axis-aligned in a frame that
  // is not the canvas's: hic's contact bins are `fillRect`s in a -45° rotated,
  // y-squashed space, and tile seamlessly there where a path-built diamond
  // leaves AA seams. `SvgCanvas` composes its CTM the same way, which is what
  // makes the export land on the diagonal too.
  translate(x: number, y: number): void
  scale(x: number, y: number): void
  rotate(angle: number): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ): void
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
  // For a shape that samples a canvas — the circular view's ring, whose ink is
  // a linear display's finished strip. Optional the way the line members are:
  // a recording context in a test declares what its shapes touch.
  drawImage?(
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void
}

/**
 * A canvas a mark's pass samples in place of a colour ramp, with the size the
 * texture is allocated at. A fresh object per repaint of the canvas: the
 * backend uploads on identity, and a canvas element's identity never moves.
 */
export interface MarkImage {
  image: HTMLCanvasElement | OffscreenCanvas
  width: number
  height: number
}

/** What a mark's pass binds: a 256-entry RGBA ramp, or a canvas. */
export type MarkTexture = Uint8Array | MarkImage

export type MarkFrame = FrameDimensions

/** How a declared value scale reads its domain. */
export type MarkValueScaleType = 'linear' | 'log'

/**
 * The quantitative colour scale a frame paints a ramp channel through: the
 * domain, unioned over the loaded regions by the display; the declared scale
 * type; and the 256-entry RGBA LUT the pass's sampler binds. A shape that
 * reads it takes the raw values in `colorValue` and resolves them per frame,
 * so a pan that widens the domain uploads no instance bytes.
 */
export interface MarkRamp {
  domain: [number, number]
  scale: MarkValueScaleType
  lut: Uint8Array
}

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

/** An axis-aligned box of the canvas, in CSS px. */
export interface InkRect {
  left: number
  top: number
  width: number
  height: number
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
   * says no, and so does `hitNearest`: a block with no ink on it has nothing
   * to be near. Optional: a shape whose every block can carry ink leaves it
   * off.
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
   * The rect `paintBlock` fills for instance `i`, or undefined for an instance
   * it skips — a row the viewport has scrolled past, a bar with no height. A
   * shape whose every instance is one box declares this and nothing about
   * hovering: `defineMark` derives `hitNearest` from it where none is
   * declared, and a display's highlight guide reads it for the instances it
   * names. A shape whose ink is not a box (a ribbon, an arc, a capsule) leaves
   * it off and keeps its own hit test.
   *
   * Painter-only overdraw — `span`'s seam — is not ink; `drawAgainstHit.ts`
   * holds the two to each other within a pixel.
   */
  ink?(
    channels: TChannels,
    block: RenderBlock,
    frame: MarkFrame,
    params: TParams,
    i: number,
  ): InkRect | undefined
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
   * from `span`'s channels, so it reads none. A shape with `ink` and no hit test
   * gets `inkHitNearest` — the nearest of its boxes — through `shapeHitNearest`.
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
 * A mark's pass as a frame plan draws it: what `hal.drawPass(id, regionKey,
 * bufferOf)` takes and nothing else, resolved once per frame so the per-block
 * loop reads two fields per mark.
 */
export interface PlannedPass {
  readonly id: string
  readonly bufferOf: string | undefined
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
  readonly texture?: (state: TState, region: TRegion) => MarkTexture | undefined
  /**
   * The frame-level gate: whether the mark draws at all under `state`, read
   * off the display-wide state and nothing else. `planMarks` asks it once per
   * frame; `drawRegion`, `paintBlock` and `hitNearest` ask it per block, so a
   * list drawn through `drawMarks` gates like one drawn through a plan — and
   * so does the hit test, which is what stops a switched-off layer answering a
   * hover over blank pixels. A question about the block is `paintsBlock`, on
   * the shape.
   */
  readonly enabled?: (state: TState) => boolean
  /**
   * The pass a frame plan draws for this mark, or undefined for a mark the plan
   * form cannot carry: one with a `band` (a plan's caller owns the scissor) or a
   * `paintsBlock` (a plan asks the block nothing).
   */
  readonly planned?: PlannedPass
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
  /**
   * The box instance `i` painted under the mark's gates, clipped to its band
   * where it has one: what a highlight guide draws for the instance a display
   * names. Undefined off a shape with no `ink`, and for an instance nothing
   * drew.
   */
  ink?(
    region: TRegion,
    block: RenderBlock,
    state: TState,
    i: number,
  ): InkRect | undefined
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
 * **`channels` answers `undefined` for a region this mark has nothing in.**
 * That is how one mark list serves a display whose cells are a union — synteny
 * draws ribbon cells, outline cells and glyph-lane cells off one list, and a
 * region key holds exactly one of the three. The mark then packs an empty
 * buffer (which every HAL reads as the release), draws nothing and paints
 * nothing, so the kind test is stated once per mark instead of once per
 * backend.
 *
 * **`params` is handed the block**, because the key a display's per-track
 * state is filed under is the block's `displayedRegionIndex` and nothing else
 * in the lens's reach says which track this is. Every method the lens feeds
 * already receives the block; the lens receiving it is what lets it stay a
 * pick rather than pushing the lookup into the shape.
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
 * **Per pass per FRAME, though the lens is handed a region too.** LD reads its
 * ramp off the payload's own metric — a pre-computed file with no D' column
 * downgrades the request, and the metric that arrived is the authoritative one
 * — which is exact because LD holds one region. A display with several regions
 * wanting different ramps for one pass would re-upload the texture per region
 * per frame; correct, since each recorded draw keeps the table bound when it
 * was encoded, but a texture per region per frame is not what this is for.
 *
 * `band` is the strip of the canvas the mark is clipped to, for a display that
 * stacks bands on one canvas (MAF's coverage strip over its rows viewport).
 * The GPU scissors to it and Canvas2D clips to it, a zero-height band draws
 * nothing, and the shape still places Y against the whole canvas — the band is
 * a clip, never an offset, which is what lets one `scrollTop` serve both
 * backends. A mark without one paints wherever its shape puts ink.
 *
 * `enabled` is the setting that turns the mark off for a whole frame — the
 * pileup's "show mismatches" — and it is one gate for the three consumers: a
 * mark that does not draw does not answer a hover either. It reads the state
 * alone so `planMarks` can resolve it once per frame; a gate that needs the
 * block is the shape's `paintsBlock`.
 */
export function defineMark<
  TRegion,
  TState extends MarkFrame,
  TChannels,
  TParams,
>(spec: {
  shape: MarkShape<TChannels, TParams>
  channels: (region: TRegion) => TChannels | undefined
  params: (state: TState, region: TRegion, block: RenderBlock) => TParams
  bufferOf?: Mark<TRegion, TState>
  band?: (state: TState) => MarkBand
  texture?: (state: TState, region: TRegion) => MarkTexture | undefined
  enabled?: (state: TState) => boolean
}): Mark<TRegion, TState> {
  const { shape, channels, params, band, texture, enabled } = spec
  const hitNearest = shapeHitNearest(shape)
  const shapeInk = shape.ink?.bind(shape)
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
  const planned =
    band || shape.paintsBlock ? undefined : { id: shape.pass.id, bufferOf }
  return {
    pass: {
      ...shape.pass,
      pack: region => {
        const c = channels(region)
        return c === undefined ? NOTHING : shape.pass.pack(c)
      },
    },
    bufferOf,
    texture,
    enabled,
    planned,
    drawRegion(hal, scratch, block, clip, region, state, regionKey, staged) {
      if (enabled && !enabled(state)) {
        return
      }
      const strip = band?.(state)
      const scissor = strip
        ? devicePxBand(strip.top, strip.height, clip.scaleY, clip.pxH)
        : undefined
      if (scissor?.height !== 0 && channels(region) !== undefined) {
        const p = params(state, region, block)
        if (!shape.paintsBlock || shape.paintsBlock(block, state, p)) {
          if (scissor) {
            hal.setScissor(clip.pxX, scissor.top, clip.pxW, scissor.height)
          }
          if (
            staged?.writer !== shape.writeUniforms ||
            staged.params !== params
          ) {
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
        }
      }
    },
    paintBlock(ctx, region, block, state) {
      if (enabled && !enabled(state)) {
        return
      }
      const strip = band?.(state)
      const c = channels(region)
      if ((!strip || strip.height > 0) && c !== undefined) {
        const p = params(state, region, block)
        if (!shape.paintsBlock || shape.paintsBlock(block, state, p)) {
          const paint = () => {
            shape.paintBlock(ctx, c, block, state, p)
          }
          if (strip) {
            withClip(ctx, 0, strip.top, state.canvasWidth, strip.height, paint)
          } else {
            paint()
          }
        }
      }
    },
    hitNearest: hitNearest
      ? (region, block, state, xPx, yPx, candidates, maxDistSq) => {
          const strip = band?.(state)
          const c = channels(region)
          let hit: MarkHit | undefined
          // The three gates `paintBlock` takes, in its order — the band on its
          // HEIGHT, as there, so a band both backends decline answers nothing
          // either. The cursor being inside the strip is a fourth, and the ink
          // being inside it the fifth: a band is a CLIP, so ink outside one was
          // never drawn and cannot be the nearest thing to anything.
          //
          // The fifth gate REJECTS rather than re-runs, and that is the one
          // conservative edge here: the shape picks its winner without knowing
          // about the band, so a clipped-away nearest masks a farther candidate
          // whose ink IS inside the strip, and the mark answers nothing instead
          // of that one. Safe in the direction that matters — it never claims a
          // hover over pixels neither backend drew — and closing it would mean
          // pushing the band down into every shape's own ink test, where the
          // band is deliberately not.
          if (
            (!enabled || enabled(state)) &&
            (!strip || strip.height > 0) &&
            c !== undefined &&
            !bandExcludes(strip, yPx)
          ) {
            const p = params(state, region, block)
            if (!shape.paintsBlock || shape.paintsBlock(block, state, p)) {
              hit = hitNearest(
                c,
                block,
                state,
                p,
                xPx,
                yPx,
                candidates,
                maxDistSq,
              )
            }
          }
          return hit && !bandExcludes(strip, hit.y) ? hit : undefined
        }
      : undefined,
    ink: shapeInk
      ? (region, block, state, i) => {
          const strip = band?.(state)
          const c = channels(region)
          if (
            (enabled && !enabled(state)) ||
            (strip && strip.height <= 0) ||
            c === undefined
          ) {
            return undefined
          }
          const p = params(state, region, block)
          if (shape.paintsBlock && !shape.paintsBlock(block, state, p)) {
            return undefined
          }
          const r = shapeInk(c, block, state, p, i)
          return r && strip ? clipToBand(r, strip) : r
        }
      : undefined,
  }
}

function clipToBand(r: InkRect, strip: MarkBand): InkRect | undefined {
  const top = Math.max(r.top, strip.top)
  const bottom = Math.min(r.top + r.height, strip.top + strip.height)
  return bottom > top
    ? { left: r.left, top, width: r.width, height: bottom - top }
    : undefined
}

// What a mark with nothing in this region packs. An empty pack IS the release
// — every HAL deletes the pass's prior buffer before it looks at the count.
const NOTHING = new ArrayBuffer(0)

function bandExcludes(strip: MarkBand | undefined, yPx: number) {
  return (
    strip !== undefined && (yPx < strip.top || yPx > strip.top + strip.height)
  )
}
