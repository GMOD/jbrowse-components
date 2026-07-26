// The matrix width is roughly `visibleScreenPx * samplesPerPixel` columns per
// source, so an unbounded value (this is a free-text field) makes the cluster
// RPC allocate arbitrarily large Float32Arrays and can hang/crash the worker.
// Cap it well above any sensible oversampling density.
export const MAX_SAMPLES_PER_PIXEL = 100

// `samplesPerPixel` is a free-text field; an empty or non-numeric value would
// make `bpPerPx / +value` produce Infinity/NaN and corrupt the RPC request.
// Fall back to 1 (the default) for any non-positive or non-finite input, and
// clamp the upper end to MAX_SAMPLES_PER_PIXEL to bound the matrix allocation.
export function parseSamplesPerPixel(value: string) {
  const n = +value
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_SAMPLES_PER_PIXEL) : 1
}
