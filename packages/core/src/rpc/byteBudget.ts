// The size gate's shared vocabulary, on both sides of the worker boundary — the
// byte budget, and the answer a worker gives when either axis refuses a region.
// Why each rule is what it is: agent-docs/reference/REGION_TOO_LARGE.md
// § "A budget has a scope".

/** Which question about a region set a byte budget asks. */
export type ByteEstimateScope = 'largestRegion' | 'wholeRequest'

/**
 * What a fetch RPC answers **instead of a payload** when a region is over
 * budget on either axis. Every in-fetch-gated RPC returns
 * `Payload | RegionTooLargeResult`, so "was this region refused" is one shape
 * rather than a per-RPC convention — see {@link isRegionRefused}.
 */
export interface RegionTooLargeResult {
  regionTooLarge: true
  // Which gate tripped, plus everything measured on the way there — NOT one or
  // the other. The byte stage runs first, so a density rejection still carries
  // the index estimate it cleared (`tooManyFeaturesResult` takes it as an
  // argument for exactly this reason), and `commitGateMeasurements` records both
  // axes off one result. A byte short-circuit returns before any features are
  // counted, so that one carries `bytes` alone.
  //
  // `bytes` is absent when the adapter offers no index estimate, or when the
  // fetch carried no `byteLimit` and so measured nothing.
  featureCount?: number
  bytes?: number
}

/**
 * Whether a fetch answered "refused" rather than data for this region.
 *
 * **The one test, because the answer decides what `loadedRegions` may claim.**
 * A refused region stored nothing, so marking it loaded over the span the fetch
 * asked for makes the viewport read as covered against data that does not exist
 * — the plan then reports `covered`, nothing refetches, and nothing
 * re-measures. That is invisible on a region fetched for the first time (the
 * data map is empty and the display notices) and permanent on one the reader
 * already had data for, which is every region they zoomed out from.
 *
 * So the fan-out helpers and the displays that fold the gate into their own RPC
 * both ask here, rather than each spelling out `'regionTooLarge' in result`.
 */
export function isRegionRefused(
  result: unknown,
): result is RegionTooLargeResult {
  return (
    typeof result === 'object' && result !== null && 'regionTooLarge' in result
  )
}

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
