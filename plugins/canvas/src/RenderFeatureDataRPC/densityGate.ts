import { calculateFeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter/stats'
import { checkStopTokenThrottled } from '@jbrowse/core/util/stopToken'

import type { RegionTooLargeResult, RenderFeatureDataArgs } from './rpcTypes.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, StatusCallback } from '@jbrowse/core/util'
import type { StopToken, StopTokenChecker } from '@jbrowse/core/util/stopToken'

type Region = RenderFeatureDataArgs['region']

// Features-per-pixel for a feature count spread over a region at a given zoom.
// Shared by the pre-fetch (sampled estimate) and post-fetch (exact) density
// gates so both measure against maxFeatureScreenDensity the same way.
// A region with no span occupies no pixels, so nothing in it is dense.
export function featuresPerPx(
  featureCount: number,
  region: { start: number; end: number },
  bpPerPx: number,
) {
  const widthBp = region.end - region.start
  return widthBp > 0 ? featureCount / (widthBp / bpPerPx) : 0
}

// The density axis's over-budget comparison, in one place for the reason
// `overByteBudget` is: three callers make it — the pre-fetch sample, the
// post-fetch exact count, and the main-thread banner — and reaching it
// separately makes a `>` drifting to `>=` invisible to every test in the tree.
// An undefined budget is the axis not gating, never a budget of zero.
export function overDensityBudget(
  density: number,
  maxFeatureDensity: number | undefined,
) {
  return maxFeatureDensity !== undefined && density > maxFeatureDensity
}

// The shared "too many features" result. Carrying featureCount (estimated
// pre-fetch, exact post-fetch) lets the model's derived density banner and
// force-load behave identically regardless of which gate rejected the region.
export function tooManyFeaturesResult(
  featureCount: number,
  bytes: number | undefined,
): RegionTooLargeResult {
  return { regionTooLarge: true, featureCount, bytes }
}

// Verdict for a sampled per-bp density: a too-large result (carrying an
// estimated whole-region featureCount) when the extrapolated screen density
// exceeds the limit, else undefined so the caller does the full fetch.
//
// The verdict is taken on the *rounded* featureCount — the same integer the
// result carries and the model re-derives its own density banner from — so a
// value right at the threshold can't be rounded across it after we've already
// bailed (which would leave no stored data and re-trigger the fetch in a loop).
//
// A non-finite density means sampling timed out (very sparse region or slow
// adapter): return undefined and let the full fetch decide, and never emit a
// non-finite featureCount — JSON serializes Infinity to null, which would slip
// past the model's density gate.
export function densityTooLargeResult(
  featureDensityPerBp: number,
  region: { start: number; end: number },
  bpPerPx: number,
  maxFeatureDensity: number,
  bytes: number | undefined,
): RegionTooLargeResult | undefined {
  const featureCount = Math.round(
    featureDensityPerBp * (region.end - region.start),
  )
  return Number.isFinite(featureCount) &&
    overDensityBudget(
      featuresPerPx(featureCount, region, bpPerPx),
      maxFeatureDensity,
    )
    ? tooManyFeaturesResult(featureCount, bytes)
    : undefined
}

// The post-fetch verdict: the exact admitted feature count, measured the same
// way the sampled estimate above is. The backstop for the pre-fetch gate — which
// may be skipped entirely (no budget) or may sample a window that under-counts —
// and the one whose `featureCount` the main thread re-derives its own density
// banner from, so it must be the same number the result carries.
//
// Beside its estimate twin rather than inline in the executor, so both verdicts
// read `featuresPerPx` from one place: the worker's short-circuit and the
// display's banner have to agree on the number, or the banner contradicts the
// decision that produced it.
export function exactDensityTooLargeResult(
  featureCount: number,
  region: { start: number; end: number },
  bpPerPx: number,
  maxFeatureDensity: number | undefined,
  bytes: number | undefined,
): RegionTooLargeResult | undefined {
  return overDensityBudget(
    featuresPerPx(featureCount, region, bpPerPx),
    maxFeatureDensity,
  )
    ? tooManyFeaturesResult(featureCount, bytes)
    : undefined
}

// Cheap pre-fetch density gate: sample a small window to estimate density
// before downloading the whole region, returning a too-large result on a
// confident over-threshold estimate, else undefined so the caller proceeds to
// the full fetch (where the exact post-fetch gate is the backstop). Bytes can't
// distinguish "few large features" from "many tiny features" (a dense VCF is
// small on disk but has too many variants to render), so this is the signal
// that catches those.
//
// `admit` is the caller's admission predicate, and passing the *same* one the
// full fetch uses is what makes this gate safe to run unconditionally: the
// estimate counts the features that will actually be drawn, so a filtered view
// can't be rejected on a population it filters away.
//
// A non-finite estimate means sampling timed out (very sparse region or slow
// adapter): return undefined and let the full fetch decide, and never emit a
// non-finite featureCount — JSON serializes Infinity to null, which would slip
// past the model's density gate and re-trigger the fetch in a loop.
export async function samplePreFetchDensity({
  dataAdapter,
  region,
  bpPerPx,
  maxFeatureDensity,
  bytes,
  admit,
  stopToken,
  statusCallback,
  stopTokenCheck,
}: {
  dataAdapter: BaseFeatureDataAdapter
  region: Region
  bpPerPx: number
  maxFeatureDensity: number
  bytes: number | undefined
  admit: (feature: Feature) => boolean
  stopToken?: StopToken
  statusCallback?: StatusCallback
  stopTokenCheck?: StopTokenChecker
}): Promise<RegionTooLargeResult | undefined> {
  const { featureDensity } = await calculateFeatureDensityStats(
    region,
    (r, o) => dataAdapter.getFeatures(r, o),
    { stopToken, statusCallback },
    admit,
  )
  checkStopTokenThrottled(stopTokenCheck)
  return densityTooLargeResult(
    featureDensity,
    region,
    bpPerPx,
    maxFeatureDensity,
    bytes,
  )
}
