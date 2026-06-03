// `samplesPerPixel` is a free-text field; an empty or non-numeric value would
// make `bpPerPx / +value` produce Infinity/NaN and corrupt the RPC request.
// Fall back to 1 (the default) for any non-positive or non-finite input.
export function parseSamplesPerPixel(value: string) {
  const n = +value
  return Number.isFinite(n) && n > 0 ? n : 1
}
