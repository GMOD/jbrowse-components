import { stopsFromRampLut } from '@jbrowse/core/util/colorRamp'
import { makeRampFillStyleLut } from '@jbrowse/render-core/canvas2dUtils'

import { MIN_VISIBLE_ALPHA } from './shaders/hic.consts.generated.ts'

export function legendStops(ramp: Uint8Array) {
  return stopsFromRampLut(ramp, 11)
}

/**
 * The ramp's fill for a normalized `t`, or undefined where the fragment shader
 * discards, so the Canvas2D and SVG paths omit the bins the GPU does.
 */
export function makeHicFillStyleLut(ramp: Uint8Array) {
  const fill = makeRampFillStyleLut(ramp)
  const opaque = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    opaque[i] = ramp[i * 4 + 3]! / 255 < MIN_VISIBLE_ALPHA ? 0 : 1
  }
  return (t: number) => {
    const idx = Math.max(0, Math.min(255, Math.round(t * 255)))
    return opaque[idx] === 0 ? undefined : fill(t)
  }
}
