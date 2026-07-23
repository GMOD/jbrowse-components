import { AUTO_FORCE_LOAD_BP } from '../LinearGenomeView/index.ts'

export function getDisplayStr(totalBytes: number) {
  // pick the unit from the rounded value so e.g. 999,999 bytes reads "1 Mb"
  // rather than "1000 Kb"
  if (Number.parseFloat((totalBytes / 1000000).toPrecision(3)) >= 1) {
    return `${Number.parseFloat((totalBytes / 1000000).toPrecision(3))} Mb`
  } else if (Number.parseFloat((totalBytes / 1000).toPrecision(3)) >= 1) {
    return `${Number.parseFloat((totalBytes / 1000).toPrecision(3))} Kb`
  } else {
    return `${Math.floor(totalBytes)} bytes`
  }
}

/**
 * Two byte numbers flow through this file. Both estimate how many bytes would
 * come over the wire if we fetched, and they differ only in WHICH SPAN of the
 * genome they cover:
 *
 * - `estimatedBytesForMeasuredSpan` — the adapter's estimate for the span that
 *   was on screen at the moment the estimate was taken. It never changes as you
 *   navigate. Stored as `featureDensityStats.bytes`, alongside the span it
 *   covers (`visibleBpWhenBytesMeasured`).
 * - `estimatedBytesForVisibleSpan` — the same estimate scaled to the span on
 *   screen right now, since bytes are roughly proportional to span. This one
 *   shrinks as you zoom in, which is what lets the banner release itself.
 *
 * The gate always compares `estimatedBytesForVisibleSpan` against the limit.
 */

// Reason text shown in the too-large banner. Single source so every gating path
// (block density, canvas derived stats, pre-fetch byte estimate) renders an
// identical message.
export const TOO_MANY_FEATURES_REASON = 'Too many features'

export function bytesTooLargeReason(bytes: number) {
  return `Requested too much data (${getDisplayStr(bytes)})`
}

/**
 * Resolve the effective byte budget from the layered sources, newest-wins: a
 * user force-load override, then the adapter's self-reported limit, then the
 * display's configured default. A non-positive adapter limit means "no opinion"
 * (e.g. htsget/no-index adapters report 0) and is skipped — without this guard a
 * 0 would gate every request as too-large, and a negative sentinel (-1) would
 * survive `|| undefined` (truthy) and do the same. Single source of truth for
 * all three paths.
 */
export function resolveByteLimit({
  userByteSizeLimit,
  adapterFetchSizeLimit,
  configFetchSizeLimit,
}: {
  userByteSizeLimit?: number
  adapterFetchSizeLimit?: number
  configFetchSizeLimit: number
}) {
  const adapterLimit =
    adapterFetchSizeLimit !== undefined && adapterFetchSizeLimit > 0
      ? adapterFetchSizeLimit
      : undefined
  return userByteSizeLimit ?? adapterLimit ?? configFetchSizeLimit
}

/**
 * Force-load raises the tripped gate's limit this far past the offending
 * estimate: enough that the just-confirmed request clears and a small zoom-out
 * doesn't immediately re-trip the banner. One constant so the byte and density
 * force-load paths use identical headroom.
 */
export const FORCE_LOAD_HEADROOM = 1.5

export function raiseLimitPast(estimate: number) {
  return Math.ceil(estimate * FORCE_LOAD_HEADROOM)
}

/**
 * The byte limit a derived-path force-load should install. Raises past the
 * visible-span estimate, not the measured-span one, because the visible-span
 * estimate is what the gate compares against: if the view zoomed out between
 * the measurement and the force-load click, raising past the measured-span
 * number leaves the gate still tripped and the banner up. Returns undefined
 * when there's nothing to gate. Single source for canvas and LD so the two
 * force-load paths can't drift (a drift that once left LD's force-load
 * under-raising — it used the RegionTooLargeMixin measured-span default).
 */
export function forceLoadByteLimit({
  estimatedBytesForVisibleSpan,
  estimatedBytesForMeasuredSpan,
}: {
  estimatedBytesForVisibleSpan?: number
  estimatedBytesForMeasuredSpan?: number
}) {
  // the measured-span number is the fallback for a display with no rescaled
  // estimate (view not measured yet, or the derived gate turned off)
  const estimate = estimatedBytesForVisibleSpan ?? estimatedBytesForMeasuredSpan
  return estimate ? raiseLimitPast(estimate) : undefined
}

/**
 * Produce `estimatedBytesForVisibleSpan` from `estimatedBytesForMeasuredSpan`,
 * by scaling from the span the estimate covers (`visibleBpWhenMeasured`) to the
 * span on screen now (`visibleBp`). This is what makes the too-large verdict a
 * pure function of the current view, so it self-releases on zoom-in instead of
 * a large zoomed-out estimate staying above the limit forever and gating
 * refetch. The derived `regionTooLarge` getter on the canvas and LD displays
 * feeds the result to `evaluateRegionTooLarge`. Returns undefined when there's
 * no estimate yet, and passes the estimate through unchanged when the span it
 * was measured over is unknown.
 */
export function rescaleByteEstimateToVisibleSpan({
  estimatedBytesForMeasuredSpan,
  visibleBpWhenMeasured,
  visibleBp,
}: {
  estimatedBytesForMeasuredSpan?: number
  visibleBpWhenMeasured?: number
  visibleBp: number
}) {
  if (!estimatedBytesForMeasuredSpan) {
    return undefined
  }
  return visibleBpWhenMeasured
    ? (estimatedBytesForMeasuredSpan * visibleBp) / visibleBpWhenMeasured
    : estimatedBytesForMeasuredSpan
}

/**
 * The dual-axis force-load decision, shared by every canvas feature display with
 * both a byte and a density gate (LinearBasicDisplay/LinearVariantDisplay base,
 * LinearMultiRowFeatureDisplay) so the two can't drift. Given a cleared
 * force-load state, decides which single axis to raise:
 *
 * - Raise the BYTE ceiling only when doing so actually LIFTS the baseline
 *   (`raisedByteLimit > baselineByteLimit`). A tabix adapter reports an index-byte
 *   estimate alongside a *density* rejection, so a dense-but-byte-small region
 *   carries a small `bytes`; adopting it as `userByteSizeLimit` would install a
 *   ceiling BELOW the config/adapter default and wrongly gate later, larger-byte
 *   regions. When the byte gate wasn't the blocker, fall through to density.
 * - Otherwise, if a density gate is active, raise past the highest observed
 *   density (not the current `maxFeatureDensity`, which already folds in any prior
 *   force-load — basing on it would multiply attempts exponentially).
 *
 * Returns at most one defined field; both are assigned by the caller each call so
 * the other axis's stale value is always cleared.
 */
export function resolveForceLoadLimits({
  estimatedBytesForVisibleSpan,
  estimatedBytesForMeasuredSpan,
  baselineByteLimit,
  densityGateActive,
  observedMaxDensity,
  configuredMaxDensity,
}: {
  estimatedBytesForVisibleSpan?: number
  estimatedBytesForMeasuredSpan?: number
  baselineByteLimit: number
  densityGateActive: boolean
  observedMaxDensity: number
  configuredMaxDensity: number
}): { userByteSizeLimit?: number; userFeatureDensityLimit?: number } {
  const raisedByteLimit = forceLoadByteLimit({
    estimatedBytesForVisibleSpan,
    estimatedBytesForMeasuredSpan,
  })
  if (raisedByteLimit !== undefined && raisedByteLimit > baselineByteLimit) {
    return { userByteSizeLimit: raisedByteLimit }
  }
  if (densityGateActive) {
    return {
      userFeatureDensityLimit: raiseLimitPast(
        observedMaxDensity > 0 ? observedMaxDensity : configuredMaxDensity,
      ),
    }
  }
  return {}
}

export interface RegionTooLargeStatus {
  tooLarge: boolean
  reason: string
}

const NOT_TOO_LARGE: RegionTooLargeStatus = { tooLarge: false, reason: '' }

/**
 * Single source of truth for the region-too-large verdict + reason shared by
 * every gating path. Below AUTO_FORCE_LOAD_BP small regions always load.
 * Otherwise bytes take precedence over density for both the verdict and the
 * reason text.
 *
 * Callers pass already-resolved values (limits with any force-load override
 * folded in via resolveByteLimit, and the path-specific densityTooLarge
 * boolean), so the per-path measurement and force-load mechanics stay where
 * they belong while the threshold, precedence, and reason live here.
 */
export function evaluateRegionTooLarge({
  visibleBp,
  estimatedBytesForVisibleSpan,
  byteLimit,
  densityTooLarge,
  alwaysRender,
}: {
  visibleBp: number
  estimatedBytesForVisibleSpan?: number
  byteLimit?: number
  densityTooLarge?: boolean
  alwaysRender?: boolean
}): RegionTooLargeStatus {
  // Self-summarizing adapters (e.g. BigWig) cap returned data at screen
  // resolution, so no region is ever too large regardless of span or threshold.
  if (alwaysRender || visibleBp < AUTO_FORCE_LOAD_BP) {
    return NOT_TOO_LARGE
  }
  if (
    estimatedBytesForVisibleSpan !== undefined &&
    byteLimit !== undefined &&
    estimatedBytesForVisibleSpan > byteLimit
  ) {
    return {
      tooLarge: true,
      reason: bytesTooLargeReason(estimatedBytesForVisibleSpan),
    }
  }
  if (densityTooLarge) {
    return { tooLarge: true, reason: TOO_MANY_FEATURES_REASON }
  }
  return NOT_TOO_LARGE
}
