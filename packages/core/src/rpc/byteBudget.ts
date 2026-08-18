/**
 * The byte budget's shared vocabulary, on both sides of the worker boundary.
 *
 * The region-too-large gate decides the same thing twice by design — the worker
 * short-circuits an over-budget region before downloading features, and the main
 * thread raises the banner from the estimate that came back — and the two must
 * reach the same verdict or the failure is silent: the worker refuses, the
 * banner says the region is fine, and the display is blank with nothing to
 * refetch on. So the *comparison* and the *reduction* live here rather than
 * being spelled once per side.
 *
 * This is the byte axis's counterpart to `featuresPerPx` on the density axis,
 * which is shared for exactly that reason and had no twin here.
 *
 * It lives in `packages/core` because that is the only package all three callers
 * can reach: `CoreGetRegionByteEstimate` beside it, the canvas plugin's in-fetch
 * gate, and the LGV plugin's `evaluateRegionTooLarge`. The rest of the gate is
 * plugin-internal and stays there — see
 * agent-docs/architecture-decision-records/adr-045-region-too-large-gate-stays-in-lgv-plugin.md.
 */

/**
 * Which question about a region set a byte budget is asking, because a budget
 * has a **scope** and the two in this codebase differ. Required wherever it is
 * taken, with no default, so a new caller has to say which its budget is rather
 * than inherit whichever reduction the adapter happened to compute.
 *
 * - `largestRegion` — the biggest single region, for a budget enforced once per
 *   region. The gate's is: every region is checked against the same limit, so a
 *   multi-region view where each region individually fits must not be blanked by
 *   what they add up to.
 * - `wholeRequest` — every region's chunks merged and summed, for a budget on
 *   the whole download. "Save track data" pulls all of them in one go.
 */
export type ByteEstimateScope = 'largestRegion' | 'wholeRequest'

/**
 * Reduce per-region byte measurements to the one number a per-region budget is
 * compared against ({@link ByteEstimateScope}'s `largestRegion`).
 *
 * Three decisions, and the third is the one worth naming: an unmeasurable region
 * is skipped rather than read as zero, so a mixed set still gates on what it
 * knows; and a set where **nothing** could be measured answers `undefined`
 * rather than `0`, which a verdict would read as a region that comfortably fits
 * — a silently disabled gate.
 *
 * Two callers spell one rule otherwise: `CoreGetRegionByteEstimate` reducing an
 * adapter's per-region answers, and canvas's `commitGateMeasurements` reducing
 * what its per-region fetches reported. They agreed by comment before they
 * agreed by code.
 *
 * Reduced rather than spread into `Math.max(...)`, so the region count is not a
 * bound on the call stack.
 */
export function largestRegionBytes(perRegion: (number | undefined)[]) {
  let largest: number | undefined
  for (const bytes of perRegion) {
    if (bytes !== undefined && (largest === undefined || bytes > largest)) {
      largest = bytes
    }
  }
  return largest
}

/**
 * Whether a measurement exceeds the budget it is judged against — the one
 * comparison the worker's short-circuit and the main thread's banner both make.
 *
 * False whenever either side is absent, and those absences mean different things
 * that happen to want the same answer: no measurement is "unmeasurable" (the
 * adapter quotes no index estimate), and no budget is "nothing may gate right
 * now" (force-load, or a display that never gates). Neither is a reason to
 * refuse a region.
 *
 * A type predicate on `bytes`, because a caller that gates goes on to quote the
 * number in the banner — narrowing it here is what keeps that from needing a
 * second, hand-written `!== undefined` that could disagree with this one.
 */
export function overByteBudget(
  bytes: number | undefined,
  byteLimit: number | undefined,
): bytes is number {
  return bytes !== undefined && byteLimit !== undefined && bytes > byteLimit
}
