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

// How far over `maxFeatureDensity` a sampled window has to read, and how many
// admitted features it has to read it from, before the probe stops laddering and
// refuses. `DENSITY_SETTLE_FEATURES / DENSITY_SETTLE_MARGIN` is also the first
// window's width in screen pixels, which is where the cap below comes from.
// Both numbers are argued from measurements in
// agent-docs/reference/REGION_TOO_LARGE.md.
export const DENSITY_SETTLE_MARGIN = 4
export const DENSITY_SETTLE_FEATURES = 8

const PROBE_WINDOW_PX = DENSITY_SETTLE_FEATURES / DENSITY_SETTLE_MARGIN

// The probe's stopping rule, built from the budget the fetch was issued under,
// or undefined for a budget that cannot size a window — which then leaves the
// ladder exactly as it was rather than deriving a bound from it. That is not
// defensive throat-clearing: `maxFeatureScreenDensity` is a config slot, so 0
// (`8 / 0`, an infinite window that clamps to the whole region) and NaN (a
// jexl-computed value; NaN bounds on every rung until the sample timeout) both
// reach here, and `executeRenderFeatureData` only guards the slot against
// `undefined`. Neither could hurt the old fixed 1 kb start.
//
// The cap is the other half. A budget below 1/px asks for a proportionally wider
// window — `maxFeatureScreenDensity: 0.01`, a plausible way to gate hard, asks
// for 200 px, half a gigabase at whole-genome zoom. It costs nothing where it
// binds, because a tighter budget makes `settled` easier to clear, not harder.
export function densityProbeGate(bpPerPx: number, maxFeatureDensity: number) {
  const settlingPerBp = (DENSITY_SETTLE_MARGIN * maxFeatureDensity) / bpPerPx
  return settlingPerBp > 0 && Number.isFinite(settlingPerBp)
    ? {
        initialInterval: Math.min(
          DENSITY_SETTLE_FEATURES / settlingPerBp,
          PROBE_WINDOW_PX * bpPerPx,
        ),
        settled: (admitted: number, sampledBp: number) =>
          admitted >= DENSITY_SETTLE_FEATURES &&
          admitted / sampledBp >= settlingPerBp,
      }
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
    // `topLevelOnly`: this counts and draws nothing, so it does not need the
    // subfeature completion a tabix GFF3/GTF read pays flanks for — and on an
    // NCBI GFF3 those flanks are most of the probe's cost. See
    // `readTabixLinesRedispatched`.
    (r, o) => dataAdapter.getFeatures(r, { ...o, topLevelOnly: true }),
    {
      stopToken,
      statusCallback,
      admit,
      gate: densityProbeGate(bpPerPx, maxFeatureDensity),
    },
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
