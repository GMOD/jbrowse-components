/**
 * The span below which nothing gates: at this zoom a fetch is small enough that
 * a banner asking permission costs the user more than the download does. Lives
 * with the gate rather than on the view because the view never reads it — it is
 * a property of the gate, and `aboveForceLoadFloor` on `RegionTooLargeMixin` is
 * the only comparison against it *as a floor* (MAF's summary swap reads that
 * getter, so the threshold has one spelling).
 *
 * It has a second, different use right below: `rescaleByteEstimateToVisibleSpan`
 * floors both its spans here. Deliberately the same constant and not a copy,
 * because the two are the same fact about the same thing. The floor was chosen
 * at roughly a tabix/BAI linear index's own resolution (16kb bins) — that is
 * what made "a small span is a small fetch" true enough to skip gating, and it
 * is equally what makes the estimate flat below it. A second constant could
 * drift from this one, and the two drifting apart has no coherent meaning.
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
 *
 * **Which is why both spans are floored rather than the rescale being dropped.**
 * The linear model is honest above `AUTO_FORCE_LOAD_BP` and fiction below it: an
 * index reports whole blocks, and 20kb is about where a tabix/BAI linear index
 * stops resolving span at all (16kb bins), so the same query costs the same
 * bytes at every span inside one block. Measured on files in this repo,
 * `volvox.maf.bed.gz` reports an identical 213,443 bytes at 200bp, 1kb and 5kb
 * (MAF_LARGE_BLOCKS.md). Flooring the numerator *and* the denominator keeps the
 * proportional model exactly where it holds and makes the estimate flat exactly
 * where the index is, which has three consequences worth stating:
 *
 * - The release mechanism survives intact. Everything at or above the floor
 *   rescales as before, so a track gated at 200kb still releases on the way in
 *   and still re-measures — no deadlock, which is what killed "just use the
 *   measurement as-is".
 * - Below the floor the verdict becomes exactly the verdict at 20kb. That is
 *   the honest answer and the one `gateBelowForceLoadFloor`'s own argument
 *   already assumes: index estimates are monotone non-decreasing in span, so a
 *   region that fails the cap down here failed it at 20kb too. It used to
 *   release anyway, against a number that isn't real, and the pre-flight put
 *   the banner straight back — a flash and an aborted fetch cycle per zoom step.
 * - It errs toward gating, and the error it removes was in the *unsafe*
 *   direction. The linear model under-reports as you zoom in: extrapolated from
 *   50kb, volvox predicts 98kB at 16kb where the index really charges 239kB.
 *
 * This is also what makes `zoomCanReleaseGate` true: a floor-opt-out display
 * stops offering "zoom in to see features" below 20kb, and now the gate agrees
 * with the banner instead of releasing on a span the bytes don't follow.
 */
export function rescaleByteEstimateToVisibleSpan({
  byteEstimate,
  visibleBp,
}: {
  byteEstimate: ByteEstimate | undefined
  visibleBp: number
}) {
  // A floor-keeping display never reaches the clamp: `gateActive` is false below
  // AUTO_FORCE_LOAD_BP, so neither the span it measured at nor the span it is
  // read at can be under it. The clamp is live only for the displays that opted
  // out of the floor, which are the only ones that gate down there at all.
  return byteEstimate?.bytes && byteEstimate.measuredSpanBp
    ? (byteEstimate.bytes * Math.max(visibleBp, AUTO_FORCE_LOAD_BP)) /
        Math.max(byteEstimate.measuredSpanBp, AUTO_FORCE_LOAD_BP)
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
