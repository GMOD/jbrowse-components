import { calculateFeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter/stats'
import { checkStopTokenThrottled } from '@jbrowse/core/util/stopToken'

import type { RegionTooLargeResult, RenderFeatureDataArgs } from './rpcTypes.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, StatusCallback } from '@jbrowse/core/util'
import type { StopToken, StopTokenChecker } from '@jbrowse/core/util/stopToken'

type Region = RenderFeatureDataArgs['region']

// A region with no span occupies no pixels, so nothing in it is dense.
export function featuresPerPx(
  featureCount: number,
  region: { start: number; end: number },
  bpPerPx: number,
) {
  const widthBp = region.end - region.start
  return widthBp > 0 ? featureCount / (widthBp / bpPerPx) : 0
}

// Three callers make this comparison — the pre-fetch sample, the post-fetch
// exact count, and the main-thread banner — so it lives in one place. An
// undefined budget is the axis not gating, never a budget of zero.
export function overDensityBudget(
  density: number,
  maxFeatureDensity: number | undefined,
) {
  return maxFeatureDensity !== undefined && density > maxFeatureDensity
}

// Carrying featureCount lets the model's derived density banner and force-load
// behave identically whichever gate rejected the region.
export function tooManyFeaturesResult(
  featureCount: number,
  bytes: number | undefined,
): RegionTooLargeResult {
  return { regionTooLarge: true, featureCount, bytes }
}

// The verdict is taken on the ROUNDED featureCount, the same integer the result
// carries, so a value at the threshold cannot round across it after the bail
// and re-trigger the fetch in a loop. A non-finite density means sampling timed
// out: let the full fetch decide, and never emit a non-finite featureCount,
// which JSON serializes to null and slips past the model's density gate.
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
  return Number.isFinite(featureCount)
    ? exactDensityTooLargeResult(
        featureCount,
        region,
        bpPerPx,
        maxFeatureDensity,
        bytes,
      )
    : undefined
}

// The backstop for the pre-fetch gate, which may be skipped entirely (no
// budget) or may sample a window that under-counts.
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
// admitted features it has to read it from, before the probe stops laddering
// and refuses.
export const DENSITY_SETTLE_MARGIN = 4
export const DENSITY_SETTLE_FEATURES = 8

const PROBE_WINDOW_PX = DENSITY_SETTLE_FEATURES / DENSITY_SETTLE_MARGIN

// `maxFeatureScreenDensity` is a config slot, so 0 and NaN both reach here;
// undefined then leaves the ladder as it was rather than deriving a bound from
// them. The cap keeps a budget below 1 feature/px from asking for a
// proportionally wider window — 0.01 asks for 200 px, half a gigabase at
// whole-genome zoom.
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

// Passing the SAME `admit` predicate the full fetch uses is what makes this
// gate safe to run unconditionally: the estimate counts the features that will
// actually be drawn, so a filtered view cannot be rejected on a population it
// filters away. A non-finite estimate means sampling timed out — return
// undefined and let the full fetch decide.
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
    // The probe draws nothing, so it does not need the subfeature completion a
    // tabix GFF3/GTF read pays flanks for — most of the probe's cost on an NCBI
    // GFF3.
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
