function interpolateStops(stops: RgbStop[]): Uint8Array {
  const data = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    const stopIndex = t * (stops.length - 1)
    const lower = Math.floor(stopIndex)
    const upper = Math.min(lower + 1, stops.length - 1)
    const frac = stopIndex - lower
    const lo = stops[lower]!
    const hi = stops[upper]!

    data[i * 4] = Math.round(lo[0] * (1 - frac) + hi[0] * frac)
    data[i * 4 + 1] = Math.round(lo[1] * (1 - frac) + hi[1] * frac)
    data[i * 4 + 2] = Math.round(lo[2] * (1 - frac) + hi[2] * frac)
    data[i * 4 + 3] = 255
  }
  return data
}

export type RgbStop = [number, number, number]

const R2_STOPS: RgbStop[] = [
  [255, 255, 255],
  [255, 224, 224],
  [255, 192, 192],
  [255, 128, 128],
  [255, 64, 64],
  [255, 0, 0],
  [208, 0, 0],
  [160, 0, 0],
]

const DPRIME_STOPS: RgbStop[] = [
  [255, 255, 255],
  [224, 224, 255],
  [192, 192, 255],
  [128, 128, 255],
  [64, 64, 255],
  [0, 0, 255],
  [0, 0, 208],
  [0, 0, 160],
]

const R_SIGNED_STOPS: RgbStop[] = [
  [0, 0, 160],
  [0, 0, 208],
  [0, 0, 255],
  [64, 64, 255],
  [128, 128, 255],
  [192, 192, 255],
  [224, 224, 255],
  [255, 255, 255],
  [255, 224, 224],
  [255, 192, 192],
  [255, 128, 128],
  [255, 64, 64],
  [255, 0, 0],
  [208, 0, 0],
  [160, 0, 0],
]

const DPRIME_SIGNED_STOPS: RgbStop[] = [
  [0, 100, 0],
  [0, 128, 0],
  [0, 160, 0],
  [64, 192, 64],
  [128, 224, 128],
  [192, 240, 192],
  [224, 248, 224],
  [255, 255, 255],
  [224, 224, 255],
  [192, 192, 255],
  [128, 128, 255],
  [64, 64, 255],
  [0, 0, 255],
  [0, 0, 208],
  [0, 0, 160],
]

export function mapLDValue(ldVal: number, signedLD: boolean) {
  return Math.max(0, Math.min(1, signedLD ? (ldVal + 1) / 2 : ldVal))
}

/**
 * What to call the number in a cell. Signed r² is not r² but r, and D' keeps
 * its name either way — the tooltip and the legend both have to say the same
 * thing about the same value, so they say it from here.
 */
export function ldMetricLabel(metric: string, signedLD: boolean) {
  if (metric === 'dprime') {
    return "D'"
  }
  return signedLD ? 'R' : 'R²'
}

/**
 * The stops for one metric+sign combination. The 256-entry ramp the cells are
 * painted through and the SVG gradient in the legend are both built from this
 * one call, so the key can't say one thing and the plot another — the legend
 * used to carry its own hand-picked five-stop copy of each of these.
 */
export function ldColorStops(metric: string, signedLD: boolean): RgbStop[] {
  if (signedLD) {
    return metric === 'dprime' ? DPRIME_SIGNED_STOPS : R_SIGNED_STOPS
  }
  return metric === 'dprime' ? DPRIME_STOPS : R2_STOPS
}

// Keyed by the stop array itself, so the one dispatch in `ldColorStops` decides
// which ramp a caller gets and nothing here has to repeat it.
const RAMPS = new Map(
  [R2_STOPS, DPRIME_STOPS, R_SIGNED_STOPS, DPRIME_SIGNED_STOPS].map(stops => [
    stops,
    interpolateStops(stops),
  ]),
)

export function generateLDColorRamp(
  metric: string,
  signedLD: boolean,
): Uint8Array {
  return RAMPS.get(ldColorStops(metric, signedLD))!
}
