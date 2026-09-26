import { devicePxBand, withClip } from '../canvas2dUtils.ts'
import { shapeHitNearest } from './markHit.ts'

import type { BlockClipResult } from '../blockClipUtils.ts'
import type { ClipContext2D } from '../canvas2dUtils.ts'
import type { GpuHal } from '../hal/index.ts'
import type { InstancePass } from '../instancePass.ts'
import type { RenderBlock } from '../renderBlock.ts'
import type { FrameDimensions } from '../renderingBackendBase.ts'

/**
 * The 2D-context subset a shape's painter needs, which both a canvas and
 * `@jbrowse/core`'s `SvgCanvas` satisfy: one painter is the fallback and the
 * SVG export.
 */
export interface MarkContext2D extends ClipContext2D {
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  lineCap?: CanvasLineCap
  lineJoin?: CanvasLineJoin
  fillRect(x: number, y: number, w: number, h: number): void
  strokeRect(x: number, y: number, w: number, h: number): void
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
    counterclockwise?: boolean,
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
 * A canvas a mark's pass samples in place of a colour ramp. Hand a fresh object
 * per repaint: the backend uploads on identity.
 */
export interface MarkImage {
  image: HTMLCanvasElement | OffscreenCanvas
  width: number
  height: number
}

/**
 * RGBA8 texels with their dimensions: a table a pass samples, such as a row
 * table. Hand a fresh object per change: the backend uploads on identity.
 */
export interface MarkTexels {
  bytes: Uint8Array
  width: number
  height: number
}

/** What a mark's pass binds: a 256-entry RGBA ramp, a canvas, or texels. */
export type MarkTexture = Uint8Array | MarkImage | MarkTexels

export type MarkFrame = FrameDimensions

export type MarkValueScaleType = 'linear' | 'log' | 'symlog'

/**
 * The colour scale a ramp channel's raw `colorValue`s resolve through each
 * frame, with the 256-entry RGBA LUT the pass's sampler binds: straight, its
 * middle stop at the middle, and `mid`, where a diverging ramp puts that stop,
 * read through a uniform.
 */
export interface MarkRamp {
  domain: [number, number]
  scale: 'linear' | 'log'
  lut: Uint8Array
  /** The value the ramp's middle stop sits at; the domain's middle when absent. */
  mid?: number
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
 * A shape: one `.slang` pass, a uniform writer and a Canvas2D painter over the
 * same channel arrays, and the geometry its hit test reads. `TParams` reaches
 * the GPU as uniforms and the painter as arguments, so both backends draw the
 * same values.
 */
export interface MarkShape<TChannels, TParams> {
  readonly id: string
  readonly pass: InstancePass<TChannels>
  /**
   * Draws over the whole canvas from every loaded region's payload, after the
   * blocks and unclipped to any block's column, each region's instances placed
   * through a canvas-wide block of its own: a link, whose curve crosses regions
   * holding neither foot.
   */
  readonly spansView?: boolean
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
   * Whether the block carries any ink under these params. Both backends and the
   * hit test skip a block it declines.
   */
  paintsBlock?(block: RenderBlock, frame: MarkFrame, params: TParams): boolean
  /**
   * Slots the GPU addresses per instance this frame, where the pass's
   * registered count is a worst case over canvas widths. The canvas chevron
   * pass shades a slot per chevron a line could put on screen, which is the
   * canvas width over the chevron pitch — a tenth of its registered budget at a
   * laptop width, and every surplus slot is a vertex invocation that runs the
   * whole placement before culling itself.
   */
  verticesPerInstance?(frame: MarkFrame, params: TParams): number
  /**
   * The texture the pass samples, read off the params the painter and the hit
   * test read (`span`'s row table), so the two backends cannot be handed
   * different tables. A display's own `texture` lens wins where it declares
   * one.
   */
  texture?(params: TParams): MarkTexture | undefined
  /**
   * The rect `paintBlock` fills for instance `i`, undefined where it paints
   * nothing. `defineMark` derives `hitNearest` from it where none is declared,
   * and a highlight guide draws it. Painter-only overdraw, `span`'s seam, is
   * not ink.
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
   * nothing beats `maxDistSq`. Distance 0 is on the ink, edges included. Only a
   * strictly nearer candidate replaces the best, so candidates handed back to
   * front answer a tie with the mark on top.
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
  /**
   * The values an instance can hold and still put ink within `radiusPx` of
   * canvas y `yPx`, which a display's index over (bp, value) is searched with.
   * A shape with no value axis leaves it off.
   */
  valueWindow?(
    yPx: number,
    radiusPx: number,
    frame: MarkFrame,
    params: TParams,
  ): [number, number]
}

/**
 * The uniform writer and `params` lens whose struct is in the HAL's slot, so a
 * later mark of the same block over both draws without writing it again. Hand
 * every mark of a block one fresh object: a stale one draws against the
 * previous block's clip.
 */
export interface StagedUniforms {
  writer: unknown
  params: unknown
}

/**
 * Puts a texture behind a pass's sampler once per identity: a repeat of the
 * bound one costs nothing, and undefined leaves what is bound or binds an
 * inert table where nothing is, since a textured pass with no texture never
 * draws on the WebGPU HAL.
 */
export interface TextureBinder {
  bind(passId: string, texture: MarkTexture | undefined): void
}

/** What `hal.drawPass` takes for one mark of a frame plan. */
export interface PlannedPass {
  readonly id: string
  readonly bufferOf: string | undefined
}

/**
 * A shape bound to a display's region payload and render state, its generics
 * erased so one list holds several shapes.
 */
export interface Mark<TRegion, TState extends MarkFrame> {
  readonly pass: InstancePass<TRegion>
  /** The shape's {@link MarkShape.spansView}. */
  readonly spansView?: boolean
  /** The pass whose uploaded instance buffer this mark draws from. */
  readonly bufferOf?: string
  /** What the pass samples this frame; undefined binds an inert table. */
  readonly texture?: (state: TState, region: TRegion) => MarkTexture | undefined
  /**
   * Whether the shape binds the pass's texture off its params as it draws,
   * so the backend binds nothing for it ahead of the block.
   */
  readonly texturedByParams?: boolean
  /**
   * Whether the mark draws at all under `state`. `planMarks` asks once per
   * frame and every other consumer per block, before any lens.
   */
  readonly enabled?: (state: TState) => boolean
  /** The pass a frame plan draws; undefined with a `band` or `paintsBlock`. */
  readonly planned?: PlannedPass
  // Called through `drawMarks`, with the viewport on the block's clip column.
  // `regionKey` is the key the region was uploaded under, which a stacked
  // alignments section does not share with its block.
  drawRegion(
    hal: GpuHal,
    scratch: ArrayBuffer,
    block: RenderBlock,
    clip: BlockClipResult,
    region: TRegion,
    state: TState,
    regionKey: number,
    staged?: StagedUniforms,
    textures?: TextureBinder,
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
  /** The box instance `i` painted under the mark's gates, clipped to a band. */
  ink?(
    region: TRegion,
    block: RenderBlock,
    state: TState,
    i: number,
  ): InkRect | undefined
  /** The shape's `valueWindow` under the mark's gates, if they open. */
  valueWindow?(
    region: TRegion,
    block: RenderBlock,
    state: TState,
    yPx: number,
    radiusPx: number,
  ): [number, number] | undefined
}

/**
 * The shape under another pass id. A pass id keys the instance buffer and
 * texture, so two marks of one shape in one display need two ids; pipelines
 * are keyed by content, so the clone compiles nothing.
 */
export function withPassId<C, P>(
  shape: MarkShape<C, P>,
  id: string,
): MarkShape<C, P> {
  return { ...shape, id, pass: { ...shape.pass, id } }
}

/**
 * Binds a shape to a display's payload and render state through two picks run
 * once per block per frame: `channels` names the region's arrays for the
 * shape's lanes, and answers undefined for a region the mark has nothing in,
 * which then packs, draws and paints nothing; `params` names what reaches the
 * uniforms.
 *
 * `bufferOf` draws off another mark's uploaded buffer of the same instance
 * struct. `texture` binds per pass per frame and re-uploads when its identity
 * moves, so ramps that differ by region re-upload per region. `band` clips the
 * mark to a strip without offsetting it. `enabled` turns the mark off for a
 * whole frame, for every consumer.
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
  const shapeValueWindow = shape.valueWindow?.bind(shape)
  const shapeTexture = texture ? undefined : shape.texture?.bind(shape)
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

  // `channels` gates `params`: a union payload's params lens may only read its
  // own kind of region.
  function resolve(region: TRegion, block: RenderBlock, state: TState) {
    if (enabled && !enabled(state)) {
      return undefined
    }
    const strip = band?.(state)
    if (strip && !bandIsOpen(strip)) {
      return undefined
    }
    const c = channels(region)
    if (c === undefined) {
      return undefined
    }
    const p = params(state, region, block)
    if (shape.paintsBlock && !shape.paintsBlock(block, state, p)) {
      return undefined
    }
    return { channels: c, params: p, strip }
  }

  return {
    pass: {
      ...shape.pass,
      pack: region => {
        const c = channels(region)
        return c === undefined ? NOTHING : shape.pass.pack(c)
      },
    },
    bufferOf,
    spansView: shape.spansView,
    texture,
    texturedByParams: shapeTexture !== undefined,
    enabled,
    planned,
    // `resolve`'s gates inline: its picks leaving as a record or through
    // closure state measured 0.80-0.86x of these locals on
    // markUniformDedupe.bench.ts.
    drawRegion(
      hal,
      scratch,
      block,
      clip,
      region,
      state,
      regionKey,
      staged,
      textures,
    ) {
      if (enabled && !enabled(state)) {
        return
      }
      const strip = band?.(state)
      if (strip && !bandIsOpen(strip)) {
        return
      }
      if (channels(region) === undefined) {
        return
      }
      const p = params(state, region, block)
      if (shape.paintsBlock && !shape.paintsBlock(block, state, p)) {
        return
      }
      if (shapeTexture && textures) {
        textures.bind(shape.pass.id, shapeTexture(p))
      }
      const scissor =
        strip && devicePxBand(strip.top, strip.height, clip.scaleY, clip.pxH)
      if (scissor?.height === 0) {
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
      hal.drawPass(
        shape.pass.id,
        regionKey,
        bufferOf,
        shape.verticesPerInstance?.(state, p),
      )
      if (scissor) {
        hal.setScissor(clip.pxX, 0, clip.pxW, clip.pxH)
      }
    },
    paintBlock(ctx, region, block, state) {
      const open = resolve(region, block, state)
      if (!open) {
        return
      }
      const { strip } = open
      if (strip) {
        withClip(ctx, 0, strip.top, state.canvasWidth, strip.height, () => {
          shape.paintBlock(ctx, open.channels, block, state, open.params)
        })
      } else {
        shape.paintBlock(ctx, open.channels, block, state, open.params)
      }
    },
    hitNearest: hitNearest
      ? (region, block, state, xPx, yPx, candidates, maxDistSq) => {
          const open = resolve(region, block, state)
          if (!open || bandExcludes(open.strip, yPx)) {
            return undefined
          }
          const hit = hitNearest(
            open.channels,
            block,
            state,
            open.params,
            xPx,
            yPx,
            candidates,
            maxDistSq,
          )
          // Rejecting a nearest hit the band clipped away, rather than asking
          // again, can mask a farther candidate inside the strip.
          return hit && !bandExcludes(open.strip, hit.y) ? hit : undefined
        }
      : undefined,
    ink: shapeInk
      ? (region, block, state, i) => {
          const open = resolve(region, block, state)
          if (!open) {
            return undefined
          }
          const r = shapeInk(open.channels, block, state, open.params, i)
          return r && open.strip ? clipToBand(r, open.strip) : r
        }
      : undefined,
    valueWindow: shapeValueWindow
      ? (region, block, state, yPx, radiusPx) => {
          const open = resolve(region, block, state)
          return open && shapeValueWindow(yPx, radiusPx, state, open.params)
        }
      : undefined,
  }
}

function bandIsOpen(strip: MarkBand) {
  return strip.height > 0 && Number.isFinite(strip.top + strip.height)
}

function clipToBand(r: InkRect, strip: MarkBand): InkRect | undefined {
  const top = Math.max(r.top, strip.top)
  const bottom = Math.min(r.top + r.height, strip.top + strip.height)
  return bottom > top
    ? { left: r.left, top, width: r.width, height: bottom - top }
    : undefined
}

const NOTHING = new ArrayBuffer(0)

function bandExcludes(strip: MarkBand | undefined, yPx: number) {
  return (
    strip !== undefined && (yPx < strip.top || yPx > strip.top + strip.height)
  )
}
