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

// ColorBrewer RdYlBu, reversed so low reads cool and high reads hot. The one
// diverging map here, and the only one that is deliberately NOT monotonic in
// luminance: a diverging quantity has a meaningful middle, and a ramp that
// climbs steadily through it hides exactly the value the reader is looking for.
// Its pale middle is the pivot. Still a ColorBrewer colorblind-safe map.
const RD_YL_BU_R: readonly Rgb[] = [
  [69, 117, 180],
  [116, 173, 209],
  [171, 217, 233],
  [224, 243, 248],
  [255, 255, 191],
  [254, 224, 144],
  [253, 174, 97],
  [244, 109, 67],
  [215, 48, 39],
]

export function viridisRgb(norm: number): Rgb {
  return sampleStops(VIRIDIS, norm)
}

export function cividisRgb(norm: number): Rgb {
  return sampleStops(CIVIDIS, norm)
}

export function rdYlBuReversedRgb(norm: number): Rgb {
  return sampleStops(RD_YL_BU_R, norm)
}

/**
 * dN/dS is read against 1, not against its own maximum: below it a gene is
 * under purifying selection, above it under positive selection, and the whole
 * point of looking is which side a gene falls on. So the ramp's own middle has
 * to be 1, which a divide-and-clamp cannot promise — it would put the pivot
 * wherever the domain's top happened to fall.
 *
 * The top is 2 rather than the data's max because the distribution is far from
 * symmetric: nearly every gene sits well under 1, and a domain stretched to
 * accommodate a handful of fast-evolving outliers flattens everything else into
 * the same blue. Anything at or above 2 is already the strongest statement this
 * ramp makes, so clamping there costs nothing and keeps the rest legible.
 */
export const DNDS_PIVOT = 1
export const DNDS_MAX = 2

export function dndsNorm(value: number) {
  return value <= DNDS_PIVOT
    ? 0.5 * Math.min(1, value / DNDS_PIVOT)
    : 0.5 + 0.5 * Math.min(1, (value - DNDS_PIVOT) / (DNDS_MAX - DNDS_PIVOT))
}

// Per-mode ramp: `toRgb` maps a [0,1] normalized value to RGB; `maxValue`
// divides the raw per-feature value into that domain *with a clamp* — this is
// the piece the dotplot view previously omitted for MAPQ, letting MAPQ > 60
// escape the top of the ramp while the synteny LUT clamped it. identity /
// meanQueryIdentity are true [0,1] fractions on viridis; mappingQuality is raw
// MAPQ capped at the minimap2 max of 60, on cividis.
export const continuousRampConfig: Record<
  'identity' | 'meanQueryIdentity' | 'mappingQuality' | 'dnds',
  {
    toRgb: (norm: number) => Rgb
    maxValue: number
    // present only where dividing by maxValue is the wrong shape, which so far
    // means the one diverging mode
    normalize?: (value: number) => number
  }
> = {
  identity: { toRgb: viridisRgb, maxValue: 1 },
  meanQueryIdentity: { toRgb: viridisRgb, maxValue: 1 },
  mappingQuality: { toRgb: cividisRgb, maxValue: 60 },
  dnds: { toRgb: rdYlBuReversedRgb, maxValue: DNDS_MAX, normalize: dndsNorm },
}

/**
 * A raw per-feature value in [0,1] ramp space. The one place the choice between
 * "divide by the domain top" and a mode's own normalization is made, so the
 * linear-synteny LUT and the dotplot's per-feature evaluation cannot answer it
 * differently — the divergence this file exists to prevent, and one the two
 * views have already had once over MAPQ scaling.
 */
export function rampNorm(
  config: { maxValue: number; normalize?: (value: number) => number },
  value: number,
) {
  return config.normalize
    ? config.normalize(value)
    : Math.min(1, value / config.maxValue)
}

/**
 * dN/dS for a link, from the two rates rather than a precomputed ratio: the
 * sources that carry this — Ensembl Compara's homology export, anything derived
 * from a codeml run — publish dN and dS separately, and both are worth having in
 * the detail panel on their own.
 *
 * -1 is "no answer", which is not 0: Compara leaves dS unestimated for a distant
 * pair, and a ratio of 0 reads as total purifying selection rather than as a
 * missing measurement. A dS at or below 0 is the same case — the ratio is
 * undefined, not infinite.
 *
 * Shared by the linear-synteny and dotplot workers so the two views cannot
 * disagree about which links have an answer.
 */
export function dnDsRatio(feature: { get: (key: string) => unknown }): number {
  const dn = feature.get('dn')
  const ds = feature.get('ds')
  return typeof dn === 'number' && typeof ds === 'number' && ds > 0 && dn >= 0
    ? dn / ds
    : -1
}
