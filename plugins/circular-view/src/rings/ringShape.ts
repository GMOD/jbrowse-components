import { slangPass } from '@jbrowse/render-core/slangPass'

import * as shader from './shaders/ringWarp.generated.ts'

import type { MarkImage, MarkShape } from '@jbrowse/render-core/marks'

const TWO_PI = 2 * Math.PI

/** Outer arc length one Canvas2D slice covers, in CSS px. */
export const SLICE_ARC_PX = 2

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

/**
 * The polar resampling of a linear display's strip, as a mark shape. The GPU
 * samples the strip per fragment; the Canvas2D painter draws it as rotated
 * slices of `SLICE_ARC_PX` of outer arc, each a column range of the strip
 * stretched between the two rims and overlapped by a pixel to close the seams.
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

    paintBlock(ctx, channels, _block, _frame, params) {
      const { strip, centerX, centerY, offsetRadians } = params
      if (!strip || !ctx.drawImage) {
        return
      }
      const { image, width, height } = strip
      for (let i = 0; i < channels.count; i++) {
        const inner = channels.innerPx[i]!
        const outer = channels.outerPx[i]!
        const band = outer - inner
        const slices = Math.max(1, Math.ceil((TWO_PI * outer) / SLICE_ARC_PX))
        const step = TWO_PI / slices
        const sliceWidth = outer * step
        for (let s = 0; s < slices; s++) {
          const a = (s + 0.5) * step + offsetRadians + Math.PI / 2
          ctx.translate(centerX, centerY)
          ctx.rotate(a)
          ctx.drawImage(
            image,
            (s / slices) * width,
            0,
            width / slices,
            height,
            -sliceWidth / 2 - 0.5,
            -outer,
            sliceWidth + 1,
            band,
          )
          ctx.rotate(-a)
          ctx.translate(-centerX, -centerY)
        }
      }
    },
  }
}
