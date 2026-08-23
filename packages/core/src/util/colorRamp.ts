/** One evenly-spaced ramp stop: 8-bit red, green, blue, alpha. */
export type ColorRampStop = readonly [number, number, number, number]

function lerp8(a: number, b: number, t: number) {
  return Math.round(a * (1 - t) + b * t)
}

/**
 * #api
 * The color at `t` in `[0, 1]` across a list of EVENLY SPACED stops, linearly
 * interpolated per channel. `t` is clamped, so the ends are the end stops
 * rather than an extrapolation past them, and a one-stop ramp is that stop
 * everywhere.
 */
export function sampleColorRamp(stops: readonly ColorRampStop[], t: number) {
  const position = Math.max(0, Math.min(1, t)) * (stops.length - 1)
  const lower = Math.floor(position)
  const lo = stops[lower]!
  const hi = stops[Math.min(lower + 1, stops.length - 1)]!
  const frac = position - lower
  return [
    lerp8(lo[0], hi[0], frac),
    lerp8(lo[1], hi[1], frac),
    lerp8(lo[2], hi[2], frac),
    lerp8(lo[3], hi[3], frac),
  ] as ColorRampStop
}

/**
 * #api
 * A 256-entry RGBA lookup table over {@link sampleColorRamp}, laid out as the
 * 256x1 texture both GPU backends upload and the Canvas2D twins index — entry
 * `i` is the color at `t = i / 255`.
 */
export function buildColorRampLut(stops: readonly ColorRampStop[]) {
  const data = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    const [r, g, b, a] = sampleColorRamp(stops, i / 255)
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = a
  }
  return data
}
