import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as shader from './shaders/ringWarp.generated.ts'
import { annulusRects, warpRing } from './warpRing.ts'

import type { PixelRect, Pixels } from './warpRing.ts'
import type { MarkImage, MarkShape } from '@jbrowse/render-core/marks'

/**
 * The ring shape's channels: one instance per annulus, radii in CSS px from
 * the circle's centre.
 */
export interface RingChannels {
  innerPx: Float32Array
  outerPx: Float32Array
  count: number
}

export interface RingParams {
  /** The circle's centre in the canvas's CSS px frame. */
  centerX: number
  centerY: number
  /** Where strip x = 0 sits, in radians clockwise from the +x axis. */
  offsetRadians: number
  /** The strip the ring samples; nothing is drawn without one. */
  strip: MarkImage | undefined
}

const BAND_ROWS = 64

let scratchCanvas: HTMLCanvasElement | undefined
let ringCanvas: HTMLCanvasElement | undefined
let ringPixels: ImageData | undefined

function context2d(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('ring painter: 2D context unavailable')
  }
  return ctx
}

function scratchContext(width: number, height: number) {
  scratchCanvas ??= document.createElement('canvas')
  scratchCanvas.width = width
  scratchCanvas.height = height
  return context2d(scratchCanvas)
}

// Every pixel drawn from this canvas is first put from `ringPixels`, so a
// resize is the only reason to touch its size.
function ringContext(width: number, height: number) {
  ringCanvas ??= document.createElement('canvas')
  if (ringCanvas.width !== width || ringCanvas.height !== height) {
    ringCanvas.width = width
    ringCanvas.height = height
  }
  return context2d(ringCanvas)
}

const stripPixels = new WeakMap<MarkImage, Pixels>()

/**
 * The strip's pixels, read once per strip: a `MarkImage` is handed fresh per
 * repaint, so a rotation reuses the read.
 */
function pixelsOf(strip: MarkImage) {
  let pixels = stripPixels.get(strip)
  if (!pixels) {
    const ctx = scratchContext(strip.width, strip.height)
    ctx.drawImage(strip.image, 0, 0)
    pixels = ctx.getImageData(0, 0, strip.width, strip.height)
    stripPixels.set(strip, pixels)
  }
  return pixels
}

/**
 * An `ImageData` the size of `ctx`'s canvas, reused across frames, with `rects`
 * cleared: the only pixels the painter reads back.
 */
function clearedPixels(ctx: CanvasRenderingContext2D, rects: PixelRect[]) {
  const { width, height } = ctx.canvas
  if (ringPixels?.width !== width || ringPixels.height !== height) {
    ringPixels = ctx.createImageData(width, height)
    return ringPixels
  }
  const { data } = ringPixels
  for (const { x, y, width: w, height: h } of rects) {
    for (let row = y; row < y + h; row++) {
      const o = (row * width + x) * 4
      data.fill(0, o, o + w * 4)
    }
  }
  return ringPixels
}

/**
 * The polar resampling of a linear display's strip, as a mark shape. The GPU
 * samples the strip per fragment; the Canvas2D painter runs the same map per
 * device pixel of the annulus that lies on the canvas (`warpRing`).
 *
 * One shape per pass id: a pass holds one texture, so a canvas drawing several
 * rings declares one of these per ring.
 */
export function ringShape(id: string): MarkShape<RingChannels, RingParams> {
  return {
    id,
    pass: {
      ...slangPass({ id, mod: shader }),
      pack: c => shader.packInstances(c, c.count),
    },

    writeUniforms(scratch, clip, _block, frame, params) {
      shader.writeUniforms(scratch, {
        centerX: params.centerX,
        centerY: params.centerY,
        canvasWidth: frame.canvasWidth,
        canvasHeight: frame.canvasHeight,
        offsetRadians: params.offsetRadians,
        devicePixelRatio: clip.scaleY,
      })
    },

    paintsBlock(_block, _frame, params) {
      return params.strip !== undefined
    },

    paintBlock(ctx, channels, _block, frame, params) {
      const { strip, offsetRadians } = params
      if (!strip || !ctx.drawImage) {
        return
      }
      const pixels = pixelsOf(strip)
      const dpr = getDpr()
      const cx = params.centerX * dpr
      const cy = params.centerY * dpr
      for (let i = 0; i < channels.count; i++) {
        const outerPx = channels.outerPx[i]! * dpr
        const left = Math.max(0, Math.floor(cx - outerPx - 1))
        const top = Math.max(0, Math.floor(cy - outerPx - 1))
        const right = Math.min(frame.canvasWidth * dpr, cx + outerPx + 1)
        const bottom = Math.min(frame.canvasHeight * dpr, cy + outerPx + 1)
        if (right - left < 1 || bottom - top < 1) {
          continue
        }
        const out = ringContext(
          Math.ceil(right - left),
          Math.ceil(bottom - top),
        )
        const annulus = {
          centerX: cx - left,
          centerY: cy - top,
          innerPx: channels.innerPx[i]! * dpr,
          outerPx,
          offsetRadians,
        }
        const rects = annulusRects(
          out.canvas.width,
          out.canvas.height,
          annulus,
          BAND_ROWS,
        )
        const ring = clearedPixels(out, rects)
        warpRing(ring, pixels, annulus)
        for (const { x, y, width, height } of rects) {
          out.putImageData(ring, 0, 0, x, y, width, height)
        }
        for (const { x, y, width, height } of rects) {
          ctx.drawImage(
            out.canvas,
            x,
            y,
            width,
            height,
            (left + x) / dpr,
            (top + y) / dpr,
            width / dpr,
            height / dpr,
          )
        }
      }
    },
  }
}
