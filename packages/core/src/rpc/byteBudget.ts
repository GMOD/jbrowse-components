import { updateStatus } from '../util/progress.ts'
import { checkStopTokenThrottled } from '../util/stopToken.ts'

import type { StatusCallback } from '../util/progress.ts'
import type { StopToken, StopTokenChecker } from '../util/stopToken.ts'
import type { AugmentedRegion } from '../util/types/data.ts'

// The size gate's shared vocabulary, on both sides of the worker boundary — the
// byte budget, and the answer a worker gives when either axis refuses a region.
// Why each rule is what it is: agent-docs/reference/REGION_TOO_LARGE.md
// § "A budget has a scope".

/** Which question about a region set a byte budget asks. */
export type ByteEstimateScope = 'largestRegion' | 'wholeRequest'

/**
 * What the two measurement helpers below need an adapter to be. A duck type,
 * not `BaseFeatureDataAdapter`: this module sits under the adapter layer, and
 * the one method the byte axis reads is this one.
 */
export interface ByteMeasurableAdapter {
  getRegionByteSize: (
    regions: AugmentedRegion[],
    opts?: { stopToken?: StopToken; statusCallback?: StatusCallback },
  ) => Promise<number | undefined>
}

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

/**
 * The bytes a fetch result reports it measured, whether it came back as a
 * payload or as a refusal. A probe over `unknown` for the same reason
 * {@link isRegionRefused} is one: the fan-out helpers are generic over what a
 * display's RPC returns, and the gate only ever wants this one field off it.
 * Absent means "this fetch measured nothing", which the commit protocol keeps
 * distinct from "measured zero".
 */
export function measuredBytes(result: unknown) {
  return typeof result === 'object' &&
    result !== null &&
    'bytes' in result &&
    typeof result.bytes === 'number'
    ? result.bytes
    : undefined
}

/**
 * Stage 1 of every gated feature fetch: the adapter's index-only byte estimate,
 * taken before any feature download, so an over-budget region short-circuits
 * without pulling data — on a whole-genome fan-out that's one cheap index read
 * per chromosome instead of every chromosome's features.
 *
 * `bytes` comes back either way (undefined when the adapter offers no index
 * estimate, or when there is no budget to check against), because the result
 * carries it to the main-thread gate whether or not this region tripped. When
 * `tooLarge` is set the caller must return it as-is and fetch nothing.
 *
 * In core rather than in the plugin that first grew it because every gated
 * feature RPC in the tree now runs it as its first await — canvas's two, the
 * alignments pileup, arc, both MAF tiers, the multi-sample variant matrix and
 * LD — and a second copy is a second answer to "is this region over budget".
 * See agent-docs/reference/REGION_TOO_LARGE.md.
 */
export async function measureRegionBytes({
  dataAdapter,
  region,
  byteLimit,
  stopToken,
  statusCallback,
  stopTokenCheck,
}: {
  dataAdapter: ByteMeasurableAdapter
  region: AugmentedRegion
  byteLimit: number | undefined
  stopToken?: StopToken
  statusCallback?: StatusCallback
  stopTokenCheck?: StopTokenChecker
}): Promise<{ bytes?: number; tooLarge?: RegionTooLargeResult }> {
  if (byteLimit === undefined) {
    return {}
  }
  // Labelled, because this is the FIRST thing a feature fetch does and it used
  // to be the one stretch of a fetch with no phase open at all: the display had
  // just cleared its status, so the overlay showed its `statusMessage ||
  // 'Loading'` fallback until the download phase opened. Every refetch flashed
  // "Loading" for as long as the estimate took.
  //
  // It does paint even when the estimate is instant, unlike a phase in the
  // middle of a fetch: a fetch begins by reopening the throttle window, so its
  // first status is always on a leading edge. What that buys is the label being
  // true while it is up — an index read that has to go to the network is
  // exactly the case the overlay used to call "Loading" — and the download
  // phase's own first status displaces it a window later at the outside.
  const bytes = await updateStatus('Checking region size', statusCallback, () =>
    dataAdapter.getRegionByteSize([region], { stopToken, statusCallback }),
  )
  checkStopTokenThrottled(stopTokenCheck)
  return overByteBudget(bytes, byteLimit)
    ? { bytes, tooLarge: { regionTooLarge: true, bytes } }
    : { bytes }
}

/**
 * The whole-region-set form, for a display whose RPC serves every region in one
 * call: measure each region separately and judge the largest against the
 * budget, because the budget is what ONE region may cost. The largest comes
 * back either way, so the banner quotes the region that refused the set.
 */
export async function measureRegionsBytes({
  dataAdapter,
  regions,
  byteLimit,
  stopToken,
  statusCallback,
  stopTokenCheck,
}: {
  dataAdapter: ByteMeasurableAdapter
  regions: AugmentedRegion[]
  byteLimit: number | undefined
  stopToken?: StopToken
  statusCallback?: StatusCallback
  stopTokenCheck?: StopTokenChecker
}): Promise<{ bytes?: number; tooLarge?: RegionTooLargeResult }> {
  if (byteLimit === undefined) {
    return {}
  }
  const bytes = largestRegionBytes(
    await updateStatus('Checking region size', statusCallback, () =>
      Promise.all(
        regions.map(region =>
          dataAdapter.getRegionByteSize([region], {
            stopToken,
            statusCallback,
          }),
        ),
      ),
    ),
  )
  checkStopTokenThrottled(stopTokenCheck)
  return overByteBudget(bytes, byteLimit)
    ? { bytes, tooLarge: { regionTooLarge: true, bytes } }
    : { bytes }
}
