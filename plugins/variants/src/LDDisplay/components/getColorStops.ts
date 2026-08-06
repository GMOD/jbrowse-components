import { ldColorStops } from './ldColorRamp.ts'

/**
 * The legend gradient's stops, evenly spaced across the same color table the
 * cells are painted through (`ldColorStops`). Derived rather than restated: the
 * legend used to carry its own five hand-picked colors per metric, which is a
 * second place to edit a palette and a key that can quietly stop describing the
 * plot beside it.
 */
export function getColorStops(ldMetric: string, signedLD: boolean) {
  const stops = ldColorStops(ldMetric, signedLD)
  return stops.map(([r, g, b], i) => ({
    offset: `${((i / (stops.length - 1)) * 100).toFixed(2)}%`,
    color: `rgb(${r},${g},${b})`,
  }))
}
