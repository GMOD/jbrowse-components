/**
 * The span below which nothing gates: at this zoom a fetch is small enough that
 * a banner asking permission costs the user more than the download does. Lives
 * with the gate rather than on the view because the view never reads it — it is
 * a property of the gate, and `aboveForceLoadFloor` on `RegionTooLargeMixin` is
 * the only comparison against it (MAF's summary swap reads that getter, so the
 * threshold has one spelling).
 */
export const AUTO_FORCE_LOAD_BP = 20_000

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
 * - `byteEstimate.bytes` — the adapter's estimate for the span that was on
 *   screen at the moment the estimate was taken. It never changes as you
 *   navigate, which is why it is stored alongside that span
 *   (`byteEstimate.measuredSpanBp`).
 * - `estimatedBytesForVisibleSpan` — the same estimate scaled to the span on
 *   screen right now, since bytes are roughly proportional to span. This one
 *   shrinks as you zoom in, which is what lets the banner release itself.
 *
 * The gate always compares `estimatedBytesForVisibleSpan` against the limit.
 */
export interface ByteEstimate {
  /**
   * The adapter's cheap index-only estimate, or undefined when it has none.
   * "Unmeasurable" rather than `0`, so the byte axis stays out of the verdict
   * instead of reading a zero as a measured value.
   */
  bytes: number | undefined
  /**
   * The **visible** span at the moment the measurement was requested, captured
   * before the round trip — the anchor the rescale divides by, not the span
   * `bytes` covers. Those differ by the fetch buffer: `byteGateBlocksFetch`
   * measures the regions it is about to fetch, which for the
   * `MultiRegionDisplayMixin` family are `bufferedVisibleRegions` — half a screen
   * each side, so twice the visible span. Deliberate, and it cancels: the buffer
   * scales with `visibleBp`, so the ratio stays right and the number the banner
   * quotes is the whole download rather than the on-screen slice of it.
   */
  measuredSpanBp: number
}

// Reason text shown in the too-large banner. Single source so every gating path
// (block density, canvas derived stats, pre-fetch byte estimate) renders an
// identical message.
export const TOO_MANY_FEATURES_REASON = 'Too many features'

export function bytesTooLargeReason(bytes: number) {
  return `Requested too much data (${getDisplayStr(bytes)})`
}

// What the banner actually says: which axis tripped (empty when the display
// gates without a reason), then the way out. Both chrome sets — the MUI
// `TooLargeMessage` and the dependency-free `PlainTooLarge` — render this, so
// the wording can't drift between them, and the screenshot harness that keys
// off the literal keeps matching whichever set is mounted.
//
// `zoomCanRelease` decides whether "zoom in" is offered, and it has to be asked
// because the advice is not always true. It was, once: the `AUTO_FORCE_LOAD_BP`
// floor turned the gate off below 20kb, so zooming far enough always worked. A
// display that opts out of the floor (`gateBelowForceLoadFloor`) has no such
// guarantee, and below the floor it has no chance either — 20kb is about where a
// tabix/BAI index stops resolving span at all (16kb linear bins), so the
// estimate is flat down there and zooming changes nothing. Telling someone to
// keep zooming into a fetch whose cost cannot fall is the one thing the banner
// must not do.
export function tooLargeBannerText(
  regionTooLargeReason: string,
  { zoomCanRelease = true }: { zoomCanRelease?: boolean } = {},
) {
  return [
    regionTooLargeReason,
    zoomCanRelease
      ? 'Zoom in to see features, or force load this track for the rest of the session (may be slow)'
      : 'Force load this track for the rest of the session (may be slow)',
  ]
    .filter(f => !!f)
    .join('. ')
}

/**
 * Resolve the effective byte budget: the adapter's self-reported limit, else the
 * display's configured default. A non-positive adapter limit means "no opinion"
 * (e.g. htsget/no-index adapters report 0) and is skipped — without this guard a
 * 0 would gate every request as too-large, and a negative sentinel (-1) would
 * survive `|| undefined` (truthy) and do the same.
 *
 * Both inputs are read on the main thread (`gateByteLimit`), so the banner and
 * the worker budget resolve one number. There is deliberately no force-load tier:
 * force-load is a boolean "render this track regardless" (`byteGateExempt`), not
 * a raised ceiling — see agent-docs/reference/REGION_TOO_LARGE.md § Force-load.
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
 * Produce `estimatedBytesForVisibleSpan` from a stored {@link ByteEstimate}, by
 * scaling from the span it covers to the span on screen now (`visibleBp`). This
 * is what makes the too-large verdict a pure function of the current view, so it
 * self-releases on zoom-in instead of a large zoomed-out estimate staying above
 * the limit forever and gating refetch. `tooLargeStatus` feeds the result to
 * `evaluateRegionTooLarge`.
 *
 * Undefined with no estimate, an unmeasurable one, or a zero span — keeping the
 * byte axis out of the verdict rather than comparing an unscaled (or infinite)
 * number against the budget.
 *
 * **The downward half of this is the gate's only release mechanism, not a
 * convenience.** The estimate is refreshed only by `byteGateBlocksFetch`, which
 * runs only from a fetch, which `FetchVisibleRegions` skips while
 * `regionTooLarge` holds. Take away the shrink-on-zoom-in and a track gated at
 * 200kb stays gated at 2kb forever, with nothing left that could re-measure it.
 * That is why the known-wrong linear model survives an index whose real
 * granularity is block-quantized — see ARCHITECTURAL_LIMITS.md, "The byte gate
 * assumes bytes scale with span".
 */
export function rescaleByteEstimateToVisibleSpan({
  byteEstimate,
  visibleBp,
}: {
  byteEstimate: ByteEstimate | undefined
  visibleBp: number
}) {
  return byteEstimate?.bytes && byteEstimate.measuredSpanBp
    ? (byteEstimate.bytes * visibleBp) / byteEstimate.measuredSpanBp
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
