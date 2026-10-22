import { stopsFromRampLut } from '@jbrowse/core/util/colorRamp'
import { makeRampFillStyleLut } from '@jbrowse/render-core/canvas2dUtils'

import { MIN_VISIBLE_ALPHA } from './shaders/hic.consts.generated.ts'

export function legendStops(ramp: Uint8Array, midNorm: number) {
  return stopsFromRampLut(ramp, 11, midNorm)
}

/**
 * The ramp's fill for a normalized `t`, or undefined where the fragment shader
 * discards, so the Canvas2D and SVG paths omit the bins the GPU does.
 */
export function makeHicFillStyleLut(ramp: Uint8Array) {
  const fill = makeRampFillStyleLut(ramp)
  const table = Array.from({ length: 256 }, (_, i) =>
    ramp[i * 4 + 3]! / 255 < MIN_VISIBLE_ALPHA ? undefined : fill(i / 255),
  )
  return (t: number) => table[Math.max(0, Math.min(255, Math.round(t * 255)))]
}
