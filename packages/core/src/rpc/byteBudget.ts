// The byte budget's shared vocabulary, on both sides of the worker boundary.
// Why each rule is what it is: agent-docs/reference/REGION_TOO_LARGE.md
// § "A budget has a scope".

/** Which question about a region set a byte budget asks. */
export type ByteEstimateScope = 'largestRegion' | 'wholeRequest'

/** Undefined, never 0, when no region could be measured. */
export function largestRegionBytes(perRegion: (number | undefined)[]) {
  let largest: number | undefined
  for (const bytes of perRegion) {
    if (bytes !== undefined && (largest === undefined || bytes > largest)) {
      largest = bytes
    }
  }
  return largest
}

/** A non-positive declared limit means "no opinion" (htsget reports 0). */
export function adapterByteLimit(declared: unknown, fallback: number) {
  return typeof declared === 'number' && declared > 0 ? declared : fallback
}

export function overByteBudget(
  bytes: number | undefined,
  byteLimit: number | undefined,
): bytes is number {
  return bytes !== undefined && byteLimit !== undefined && bytes > byteLimit
}
