import { cssColorToRgba } from '@jbrowse/core/util/colorBits'
import { VIRIDIS_STOPS, buildColorRampLut } from '@jbrowse/core/util/colorRamp'

// The named colour ramps a `color.ramp` may ask for by name. Each is a fixed
// 256-entry LUT both backends colour through — the GPU as the pass's 256×1
// texture (uploadColorRampLut), Canvas2D and the SVG export as a fillStyle LUT
// over the same bytes (makeDensityLutFillFn). A colour naming no ramp keeps the
// inline white→track-colour lerp the shader computes per row, which is what a
// single LUT cannot encode once each row has a colour of its own.
const NAMED_RAMP_STOPS = {
  viridis: VIRIDIS_STOPS,
} as const

export type DensityRampName = keyof typeof NAMED_RAMP_STOPS

export const DENSITY_COLOR_RAMPS: DensityRampName[] = Object.keys(
  NAMED_RAMP_STOPS,
) as DensityRampName[]

const luts = new Map<string, Uint8Array>()

// The LUT a name asks for, or null where it names none (a CSS colour, or a
// name outside the table, so a stale session value degrades to the inline fade
// rather than throwing mid-draw). Cached so repeated reads hand back the SAME
// Uint8Array — the GPU renderer keys its upload memo on that identity, and the
// render state is rebuilt far more often than the ramp changes.
export function densityRampLut(name: string | undefined): Uint8Array | null {
  if (!name) {
    return null
  }
  let lut = luts.get(name)
  if (!lut) {
    if (!Object.hasOwn(NAMED_RAMP_STOPS, name)) {
      return null
    }
    lut = buildColorRampLut(
      NAMED_RAMP_STOPS[name as keyof typeof NAMED_RAMP_STOPS],
    )
    luts.set(name, lut)
  }
  return lut
}

// The LUT a list of CSS stops asks for, cached on the list so the GPU upload
// memo and the render state see one array for one ramp.
export function stopRampLut(stops: readonly string[]): Uint8Array {
  const key = stops.join(' ')
  let lut = luts.get(key)
  if (!lut) {
    lut = buildColorRampLut(stops.map(c => cssColorToRgba(c)))
    luts.set(key, lut)
  }
  return lut
}
