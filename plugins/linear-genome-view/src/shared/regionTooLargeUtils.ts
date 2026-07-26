import { AUTO_FORCE_LOAD_BP } from '../LinearGenomeView/index.ts'

// Round to 3 significant digits, dropping trailing zeros ("1.00" -> "1").
function round3(n: number) {
  return Number.parseFloat(n.toPrecision(3))
}

export function getDisplayStr(totalBytes: number) {
  // pick the unit from the rounded value so e.g. 999,999 bytes reads "1 Mb"
  // rather than "1000 Kb"
  const mb = round3(totalBytes / 1_000_000)
  const kb = round3(totalBytes / 1000)
  if (mb >= 1) {
    return `${mb} Mb`
  } else if (kb >= 1) {
    return `${kb} Kb`
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
 *   navigate. Stored as `byteEstimate.bytes`, alongside the span it
 *   covers (`measuredSpanBp`).
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
 * Resolve the effective byte budget: the adapter's self-reported limit, else the
 * display's configured default. A non-positive adapter limit means "no opinion"
 * (e.g. htsget/no-index adapters report 0) and is skipped — without this guard a
 * 0 would gate every request as too-large, and a negative sentinel (-1) would
 * survive `|| undefined` (truthy) and do the same. Single source of truth for
 * every gating path.
 *
 * There is deliberately no force-load tier here. Force-load is a boolean "render
 * this track regardless" (`byteGateExempt`), not a raised ceiling — see
 * agent-docs/reference/REGION_TOO_LARGE.md § Force-load.
 */
export function resolveByteLimit({
  adapterFetchSizeLimit,
  configFetchSizeLimit,
}: {
  adapterFetchSizeLimit?: number
  configFetchSizeLimit: number
}) {
  return adapterFetchSizeLimit !== undefined && adapterFetchSizeLimit > 0
    ? adapterFetchSizeLimit
    : configFetchSizeLimit
}

/**
 * Produce `estimatedBytesForVisibleSpan` from `estimatedBytesForMeasuredSpan`,
 * by scaling from the span the estimate covers (`measuredSpanBp`) to the
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
  measuredSpanBp,
  visibleBp,
}: {
  estimatedBytesForMeasuredSpan?: number
  measuredSpanBp?: number
  visibleBp: number
}) {
  if (!estimatedBytesForMeasuredSpan) {
    return undefined
  }
  return measuredSpanBp
    ? (estimatedBytesForMeasuredSpan * visibleBp) / measuredSpanBp
    : estimatedBytesForMeasuredSpan
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
