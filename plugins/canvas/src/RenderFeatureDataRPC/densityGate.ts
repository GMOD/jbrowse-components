import { calculateFeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter/stats'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'

import type {
  RenderFeatureDataArgs,
  RenderFeatureDataResult,
} from './rpcTypes.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { StatusCallback } from '@jbrowse/core/util'
import type { StopToken, StopTokenChecker } from '@jbrowse/core/util/stopToken'

type Region = RenderFeatureDataArgs['region']

// Features-per-pixel for a feature count spread over a region at a given zoom.
// Shared by the pre-fetch (sampled estimate) and post-fetch (exact) density
// gates so both measure against maxFeatureScreenDensity the same way.
export function featuresPerPx(
  featureCount: number,
  region: { start: number; end: number },
  bpPerPx: number,
) {
  return featureCount / ((region.end - region.start) / bpPerPx)
}

// The shared "too many features" result. Carrying featureCount (estimated
// pre-fetch, exact post-fetch) lets the model's derived density banner and
// force-load behave identically regardless of which gate rejected the region.
export function tooManyFeaturesResult(
  featureCount: number,
  bytes: number | undefined,
): RenderFeatureDataResult {
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
): RenderFeatureDataResult | undefined {
  const featureCount = Math.round(featureDensityPerBp * (region.end - region.start))
  return Number.isFinite(featureCount) &&
    featuresPerPx(featureCount, region, bpPerPx) > maxFeatureDensity
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
  stopToken,
  statusCallback,
  stopTokenCheck,
}: {
  dataAdapter: BaseFeatureDataAdapter
  region: Region
  bpPerPx: number
  maxFeatureDensity: number
  bytes: number | undefined
  stopToken?: StopToken
  statusCallback?: StatusCallback
  stopTokenCheck?: StopTokenChecker
}): Promise<RenderFeatureDataResult | undefined> {
  const { featureDensity } = await calculateFeatureDensityStats(
    region,
    (r, o) => dataAdapter.getFeatures(r, o),
    { stopToken, statusCallback },
  )
  checkStopToken2(stopTokenCheck)
  return densityTooLargeResult(
    featureDensity,
    region,
    bpPerPx,
    maxFeatureDensity,
    bytes,
  )
}
