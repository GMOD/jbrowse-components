// Shared normalized-value → RGB color ramps for synteny/dotplot "color by"
// modes. Centralizing the ramp math here is what keeps the two views from
// drifting: the linear-synteny view bakes these into 256-bin LUTs while the
// dotplot view evaluates them per feature, but both now agree on hue ranges,
// value scaling, and the diverging-identity stops.

export type Rgb = readonly [number, number, number]

// (hueRange°, maxValue) for the simple red→hue HSL ramps. maxValue normalizes
// the raw per-feature value into [0,1] before the hue sweep, *with a clamp* —
// this is the piece the dotplot view previously omitted for MAPQ, letting
// MAPQ > 60 wrap past green/blue while the synteny LUT clamped it at yellow.
// identity / meanQueryIdentity share a red→green scale (both are true [0,1]
// identity fractions); meanQueryMappingQuality is the normalized synteny-
// strength score on red→blue; mappingQuality is red→yellow, MAPQ capped at the
// minimap2 max of 60.
export const continuousRampConfig: Record<
  | 'identity'
  | 'meanQueryIdentity'
  | 'meanQueryMappingQuality'
  | 'mappingQuality',
  { hueRange: number; maxValue: number }
> = {
  identity: { hueRange: 120, maxValue: 1 },
  meanQueryIdentity: { hueRange: 120, maxValue: 1 },
  meanQueryMappingQuality: { hueRange: 200, maxValue: 1 },
  mappingQuality: { hueRange: 60, maxValue: 60 },
}

// HSL(hue, 100%, 40%) → RGB without a `hsl(...)` CSS string round-trip.
// Reference: https://en.wikipedia.org/wiki/HSL_and_HSV#HSL_to_RGB_alternative
export function hslRampRgb(norm: number, hueRange: number): Rgb {
  const hue = norm * hueRange
  const s = 1
  const l = 0.4
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + hue / 30) % 12
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
  }
  return [
    Math.round(f(0) * 255),
    Math.round(f(8) * 255),
    Math.round(f(4) * 255),
  ]
}

// ColorBrewer RdYlBu diverging endpoints + midpoint. RdYlBu is in the
// colorblind-safe diverging set — a strict improvement over the sequential
// red→green identity ramp, which is the worst possible pairing for the ~8% of
// males with red-green color vision deficiency.
const RD_YL_BU: readonly Rgb[] = [
  [165, 0, 38], // 0.0 deep red   (most divergent)
  [244, 109, 67],
  [254, 224, 144],
  [224, 243, 248],
  [69, 117, 180], // 1.0 deep blue (most conserved)
]

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

// Default pivot for the diverging identity ramp. Synteny alignments between
// related assemblies cluster tightly above ~90% identity, so a plain linear
// ramp wastes most of its range on an empty low end. Splitting at the pivot
// gives the divergent tail (< pivot) the full red→yellow sweep and the
// conserved bulk (>= pivot) the yellow→blue sweep, expanding the part users
// actually care about.
export const DEFAULT_IDENTITY_PIVOT = 0.9

// identity (0..1) → diverging RdYlBu RGB, pivoted so divergent regions read
// warm/red and conserved regions read cool/blue.
export function divergingIdentityRgb(
  identity: number,
  pivot = DEFAULT_IDENTITY_PIVOT,
): Rgb {
  const norm =
    identity < pivot
      ? 0.5 * (identity / pivot)
      : 0.5 + 0.5 * ((identity - pivot) / (1 - pivot))
  return sampleStops(RD_YL_BU, norm)
}
