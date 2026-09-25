import { checkAbortSignal } from '../util/aborting.ts'
import { updateStatus } from '../util/progress.ts'

import type { StatusCallback } from '../util/progress.ts'
import type { AugmentedRegion } from '../util/types/data.ts'

/**
 * Which question a byte budget asks of a region set: the gate's per-region
 * budget, or the save dialog's bound on the whole download.
 */
export type ByteEstimateScope = 'largestRegion' | 'wholeRequest'

/**
 * The one spelling of a gated feature RPC's budget argument: the number the
 * worker measures against, undefined when the gate declined to act and nothing
 * is measured. A call-site argument, never part of `rpcProps`, because it
 * swings at 20kb and on force-load.
 */
export interface GatedFetchArgs {
  byteLimit?: number
}

export interface ByteMeasurableAdapter {
  getRegionByteSize: (
    regions: AugmentedRegion[],
    opts?: { signal?: AbortSignal; statusCallback?: StatusCallback },
  ) => Promise<number | undefined>
}

/**
 * What a gated fetch RPC answers instead of a payload when a region is over
 * budget on either axis, carrying everything measured on the way: the byte
 * stage runs first, so a density refusal still has `bytes`.
 */
export interface RegionTooLargeResult {
  regionTooLarge: true
  featureCount?: number
  bytes?: number
  /** `bytes` is the max over the regions that reported — {@link measurementPartial} */
  partial?: boolean
}

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

/** The bytes a fetch result reports, payload or refusal; absent means unmeasured. */
export function measuredBytes(result: unknown) {
  return typeof result === 'object' &&
    result !== null &&
    'bytes' in result &&
    typeof result.bytes === 'number'
    ? result.bytes
    : undefined
}

/**
 * Whether a result's `bytes` covers the whole region set it was asked about. A
 * fan-out that stops at its first refusal reports whichever regions won the
 * race, and `nextByteEstimate` takes no zoom evidence from one.
 */
export function measurementPartial(result: unknown) {
  return (
    typeof result === 'object' &&
    result !== null &&
    'partial' in result &&
    result.partial === true
  )
}

/**
 * The first await of every gated feature fetch: each region's index-only byte
 * estimate, judged by the largest because the budget is per region. `bytes`
 * comes back either way; when `tooLarge` is set the caller returns it and
 * fetches nothing. No budget means no measurement.
 */
export async function measureRegionBytes({
  dataAdapter,
  regions,
  byteLimit,
  signal,
  statusCallback,
}: {
  dataAdapter: ByteMeasurableAdapter
  regions: AugmentedRegion[]
  byteLimit: number | undefined
  signal?: AbortSignal
  statusCallback?: StatusCallback
}): Promise<{ bytes?: number; tooLarge?: RegionTooLargeResult }> {
  if (byteLimit === undefined) {
    return {}
  }
  const bytes = largestRegionBytes(
    await updateStatus('Downloading index', statusCallback, () =>
      Promise.all(
        regions.map(region =>
          dataAdapter.getRegionByteSize([region], {
            signal,
            statusCallback,
          }),
        ),
      ),
    ),
  )
  checkAbortSignal(signal)
  return overByteBudget(bytes, byteLimit)
    ? { bytes, tooLarge: { regionTooLarge: true, bytes } }
    : { bytes }
}
