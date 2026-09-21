import { buildColorRampLut, colorRampStops } from '@jbrowse/core/util/colorRamp'

import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'

const luts = new Map<string, Uint8Array>()

/**
 * The 256-entry LUT a ramp's `range`, `scheme` and `reverse` ask for, which
 * both backends colour through — the GPU as the pass's 256×1 texture
 * (uploadColorRampLut), Canvas2D and the SVG export as a fillStyle LUT over
 * the same bytes (makeDensityLutFillFn). Cached so repeated reads hand back
 * the SAME Uint8Array: the GPU renderer keys its upload memo on that
 * identity, and the render state is rebuilt far more often than the ramp
 * changes.
 */
export function rampLutOf(ramp: {
  range?: readonly string[]
  scheme?: ColorSchemeName
  reverse?: boolean
}): Uint8Array {
  const key = [ramp.scheme ?? '', ramp.range?.join(' ') ?? '', !!ramp.reverse]
    .map(String)
    .join('|')
  let lut = luts.get(key)
  if (!lut) {
    lut = buildColorRampLut(colorRampStops(ramp))
    luts.set(key, lut)
  }
  return lut
}
