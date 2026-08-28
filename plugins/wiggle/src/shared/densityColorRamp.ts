import { VIRIDIS_STOPS, buildColorRampLut } from '@jbrowse/core/util/colorRamp'

// The density rendering's colour-ramp choices: 'default' is the inline
// white→track-colour lerp the shader computes per row (a single LUT cannot
// encode multiwiggle's per-row colours, so it stays the default), and each
// named entry is a fixed 256-entry LUT both backends colour through — the GPU
// as the pass's 256×1 texture (uploadColorRampLut), Canvas2D and the SVG
// export as a fillStyle LUT over the same bytes (makeDensityLutFillFn). The
// config schema's enumeration spreads this list, so adding a ramp is one entry
// in NAMED_RAMP_STOPS.
const NAMED_RAMP_STOPS = {
  viridis: VIRIDIS_STOPS,
} as const

export type DensityRampName = 'default' | keyof typeof NAMED_RAMP_STOPS

export const DENSITY_COLOR_RAMPS: DensityRampName[] = [
  'default',
  ...(Object.keys(NAMED_RAMP_STOPS) as (keyof typeof NAMED_RAMP_STOPS)[]),
]

const luts = new Map<string, Uint8Array>()

// The LUT for a named ramp, or null for 'default' (and for any name outside
// the table, so a stale session value degrades to the default rather than
// throwing mid-draw). Cached so repeated reads hand back the SAME Uint8Array —
// the GPU renderer keys its upload memo on that identity, and the render state
// is rebuilt far more often than the ramp changes.
export function densityRampLut(name: string | undefined): Uint8Array | null {
  if (!name || name === 'default') {
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
