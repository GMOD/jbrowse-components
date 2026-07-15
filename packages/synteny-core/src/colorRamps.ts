// Shared normalized-value → RGB color ramps for synteny/dotplot "color by"
// modes. Centralizing the ramp math here is what keeps the two views from
// drifting: the linear-synteny view bakes these into 256-bin LUTs while the
// dotplot view evaluates them per feature, but both draw from the same stops,
// value scaling, and diverging-identity pivot.
//
// All continuous ramps are perceptually-uniform, colorblind-safe colormaps
// (viridis / cividis / RdYlBu) rather than raw HSL hue sweeps. A constant-
// saturation hue sweep is neither perceptually uniform (equal value steps read
// as unequal color steps, e.g. a false-bright yellow ridge mid-scale) nor
// colorblind-safe (red→green is the worst case for deuteranopia). viridis and
// cividis are monotonic in luminance, so "brighter = higher value" holds even
// in grayscale.

export type Rgb = readonly [number, number, number]

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function sampleStops(stops: readonly Rgb[], t: number): Rgb {
  const clamped = Math.max(0, Math.min(1, t))
  const scaled = clamped * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(scaled))
  const frac = scaled - i
  const [r0, g0, b0] = stops[i]!
  const [r1, g1, b1] = stops[i + 1]!
  return [
    Math.round(lerp(r0, r1, frac)),
    Math.round(lerp(g0, g1, frac)),
    Math.round(lerp(b0, b1, frac)),
  ]
}

// matplotlib viridis, sampled at 10 stops (dark purple → teal → yellow). Used
// for the identity axis: high identity reads bright yellow, divergent reads
// dark. Perceptually uniform + colorblind-safe.
const VIRIDIS: readonly Rgb[] = [
  [68, 1, 84],
  [72, 40, 120],
  [62, 73, 137],
  [49, 104, 142],
  [38, 130, 142],
  [31, 158, 137],
  [53, 183, 121],
  [110, 206, 88],
  [181, 222, 43],
  [253, 231, 37],
]

// matplotlib cividis, sampled at 10 stops (dark blue → gray → yellow). Used for
// the mapping-quality axis. Optimized specifically for CVD viewers and visually
// distinct from viridis (no green), so identity vs quality modes don't look
// identical.
const CIVIDIS: readonly Rgb[] = [
  [0, 32, 77],
  [0, 51, 111],
  [57, 72, 107],
  [87, 93, 109],
  [112, 113, 115],
  [138, 135, 121],
  [166, 157, 117],
  [196, 181, 108],
  [228, 207, 91],
  [255, 234, 70],
]

export function viridisRgb(norm: number): Rgb {
  return sampleStops(VIRIDIS, norm)
}

export function cividisRgb(norm: number): Rgb {
  return sampleStops(CIVIDIS, norm)
}

// Per-mode ramp: `toRgb` maps a [0,1] normalized value to RGB; `maxValue`
// divides the raw per-feature value into that domain *with a clamp* — this is
// the piece the dotplot view previously omitted for MAPQ, letting MAPQ > 60
// escape the top of the ramp while the synteny LUT clamped it. identity /
// meanQueryIdentity are true [0,1] fractions on viridis; mappingQuality is raw
// MAPQ capped at the minimap2 max of 60, on cividis.
export const continuousRampConfig: Record<
  'identity' | 'meanQueryIdentity' | 'mappingQuality',
  { toRgb: (norm: number) => Rgb; maxValue: number }
> = {
  identity: { toRgb: viridisRgb, maxValue: 1 },
  meanQueryIdentity: { toRgb: viridisRgb, maxValue: 1 },
  mappingQuality: { toRgb: cividisRgb, maxValue: 60 },
}
