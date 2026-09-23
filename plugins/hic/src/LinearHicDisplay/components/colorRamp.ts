import { stopsFromRampLut } from '@jbrowse/core/util/colorRamp'
import { makeRampFillStyleLut } from '@jbrowse/render-core/canvas2dUtils'

import { MIN_VISIBLE_ALPHA } from './shaders/hic.consts.generated.ts'

const LEGEND_STOP_COUNT = 11

// The legend's stops, read out of the same ramp bytes the GPU uploads — entry
// round(t * 255) at bar fraction t — so the key and the heatmap are one table.
// Alpha rides `opacity`, which is what keeps the juicebox scheme's
// transparent→opaque fade through exporters with uneven rgba() support.
export function legendStops(ramp: Uint8Array) {
  return stopsFromRampLut(ramp, LEGEND_STOP_COUNT)
}

// Per-cell fillStyle LUT for the Canvas2D + SVG hic draw: returns the cached
// `rgba(...)` string for a normalized value `t`, or undefined where the ramp is
// effectively transparent (the juicebox scheme fades alpha→0 at low counts) so
// the caller skips painting that bin. The cutoff is hic-specific, so it stays
// out of the shared render-core LUT — but it is the SHADER's, generated from
// hic.slang's MIN_VISIBLE_ALPHA (adr-051), because the fragment discards on the
// same test and the two paths must not disagree about which bins exist.
export function makeHicFillStyleLut(ramp: Uint8Array) {
  const fill = makeRampFillStyleLut(ramp)
  // Precompute the transparent/opaque decision per ramp entry instead of
  // re-deriving it per call: this LUT runs once per painted contact per frame,
  // and `fill` already does its own index math. Reading the alpha byte here
  // (rather than via lookupColorRamp) also avoids allocating an {r,g,b,a} object
  // 256 times for a question that only needs one byte.
  const opaque = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    opaque[i] = ramp[i * 4 + 3]! / 255 < MIN_VISIBLE_ALPHA ? 0 : 1
  }
  return (t: number) => {
    const idx = Math.max(0, Math.min(255, Math.round(t * 255)))
    return opaque[idx] === 0 ? undefined : fill(t)
  }
}
