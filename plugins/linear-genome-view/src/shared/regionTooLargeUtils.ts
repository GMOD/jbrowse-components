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
 * refetch. `tooLargeStatus` feeds the result to `evaluateRegionTooLarge`.
 *
 * Undefined unless there is both an estimate and a span to scale it from —
 * `setByteEstimate` always writes the pair, so the only way here is a zero span,
 * and yielding undefined keeps the byte axis out of the verdict rather than
 * comparing an unscaled (or infinite) number against the budget.
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
  return estimatedBytesForMeasuredSpan && measuredSpanBp
    ? (estimatedBytesForMeasuredSpan * visibleBp) / measuredSpanBp
    : undefined
}

export interface RegionTooLargeStatus {
  tooLarge: boolean
  reason: string
}

export const NOT_TOO_LARGE: RegionTooLargeStatus = {
  tooLarge: false,
  reason: '',
}

/**
 * The comparison half of the verdict: which axis is over budget, and the banner
 * text for it. Bytes take precedence over density for both.
 *
 * Deliberately knows nothing about *whether* the gate applies — the
 * AUTO_FORCE_LOAD_BP floor, force-load and `alwaysRender` adapters all live in
 * `gateActive` on `RegionTooLargeMixin`, which is also what stops the pre-flight
 * RPC and the worker budgets. One place asks "may anything gate?", this one asks
 * "does it?".
 */
export function evaluateRegionTooLarge({
  estimatedBytesForVisibleSpan,
  byteLimit,
  densityTooLarge,
}: {
  estimatedBytesForVisibleSpan?: number
  byteLimit?: number
  densityTooLarge?: boolean
}): RegionTooLargeStatus {
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
