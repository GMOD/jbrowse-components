import { buildColorRampLut } from '@jbrowse/core/util/colorRamp'

export type RgbStop = [number, number, number]

// The LD ramps are opaque throughout, so the shared interpolation gets its
// alpha channel here rather than each stop table carrying a fourth 255.
function opaqueRampLut(stops: RgbStop[]) {
  return buildColorRampLut(stops.map(([r, g, b]) => [r, g, b, 255] as const))
}

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

export function mapLDValue(ldVal: number) {
  return Math.max(0, Math.min(1, ldVal))
}

/**
 * What to call the number in a cell. Pre-computed LD files report magnitudes
 * (plink2's signed DPRIME is read through `Math.abs`), so there is one name per
 * metric — the tooltip and the legend both say it from here.
 */
export function ldMetricLabel(metric: string) {
  return metric === 'dprime' ? "D'" : 'R²'
}

/**
 * The number in a cell as the tooltip should print it.
 */
export function ldValueText(ldValue: number) {
  return ldValue.toFixed(3)
}

/**
 * The stops for one metric. The 256-entry ramp the cells are painted through
 * and the SVG gradient in the legend are both built from this one call, so the
 * key can't say one thing and the plot another — the legend used to carry its
 * own hand-picked five-stop copy of each of these.
 */
export function ldColorStops(metric: string): RgbStop[] {
  return metric === 'dprime' ? DPRIME_STOPS : R2_STOPS
}

// Keyed by the stop array itself, so the one dispatch in `ldColorStops` decides
// which ramp a caller gets and nothing here has to repeat it.
const RAMPS = new Map(
  [R2_STOPS, DPRIME_STOPS].map(stops => [stops, opaqueRampLut(stops)]),
)

export function generateLDColorRamp(metric: string): Uint8Array {
  return RAMPS.get(ldColorStops(metric))!
}
