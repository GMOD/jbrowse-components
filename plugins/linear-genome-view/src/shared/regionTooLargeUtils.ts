/**
 * The span below which the **density** axis stops gating: at this zoom a canvas
 * display is drawing few enough glyphs that a banner asking permission costs the
 * user more than the draw does. Lives with the gate rather than on the view
 * because the view never reads it — `aboveForceLoadFloor` on
 * `RegionTooLargeMixin` is the only comparison against it, and MAF's summary
 * swap reads that getter, so the threshold has one spelling.
 *
 * **It is not a floor on the byte axis, and used not to be only that.** The byte
 * gate now measures at the viewport it is judging (`RegionTooLargeMixin`
 * §"Measurement follows the viewport"), so "a small span is a small fetch" is
 * something it checks rather than assumes — and the check routinely fails. An
 * index quotes whole blocks, so the estimate goes flat wherever a query stops
 * splitting bins, and *where* that happens is a property of the file, not of the
 * index's bin width. Measured 2026-08-06 on files in this repo:
 * `volvox.maf.bed.gz` reports an identical 306,719 bytes from 25kb up to 100kb,
 * and the whole-genome `hs37d5.HG002…sv.vcf.gz` is flat at 15,408 from 7.8 Mb
 * down — 400x above where a 20kb floor would have looked. The old reading here
 * ("roughly a tabix/BAI linear index's own resolution, 16kb bins") described one
 * dense file and generalized from it.
 *
 * The density axis keeps the floor because its number is still a *model* — the
 * last fetch's features-per-bp times the current bpPerPx — with no measurement
 * under it at the span being judged. A repo-wide scan of all 60 indexed files
 * (same date) found nothing that would banner below this span on a display with
 * the density axis on, so removing it would be a change with no measured
 * benefit and an unmeasured risk.
 */
export const AUTO_FORCE_LOAD_BP = 20_000

/**
 * A re-measure is only evidence about zoom when the span actually moved: below
 * this ratio the two measurements describe about the same window, so a flat
 * result says nothing about whether zooming further would help.
 */
const ZOOM_EVIDENCE_SPAN_RATIO = 0.5

/**
 * ...and a halving that buys less than a tenth of the bytes is the index
 * quoting the same blocks. Measured on the whole-genome
 * `hs37d5.HG002…sv.vcf.gz`, successive halvings buy 47%, 34%, 26%, 17%, 12%, 4%,
 * 2%, 0% — so the curve's knee is comfortably inside this threshold and a track
 * still making progress is never called stuck.
 */
const ZOOM_EVIDENCE_BYTE_RATIO = 0.9

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
 * One measurement of what a fetch would cost, taken at the viewport it
 * describes. **There is no second, derived byte number** — there used to be
 * (`estimatedBytesForVisibleSpan`, this one scaled by `visibleBp /
 * measuredSpanBp`) and the scaling was fiction: index estimates are quoted in
 * whole blocks, so they do not follow span, and the model under-reported by up
 * to three orders of magnitude on real files (see {@link AUTO_FORCE_LOAD_BP}).
 * The gate re-measures when the viewport moves under it instead — see
 * `RegionTooLargeMixin` §"Measurement follows the viewport".
 */
export interface ByteEstimate {
  /**
   * The adapter's cheap index-only estimate for {@link measuredSpanBp}, or
   * undefined when it has none. "Unmeasurable" rather than `0`, so the byte axis
   * stays out of the verdict instead of reading a zero as a measured value.
   */
  bytes: number | undefined
  /**
   * The **visible** span this measurement was taken at, captured before the
   * round trip. Nothing divides by it any more; it is kept because two
   * consecutive measurements at two spans are the only evidence anyone has about
   * whether zooming shrinks this file's fetch ({@link zoomIneffective}).
   *
   * Not the span `bytes` covers: a display measures the regions it is about to
   * fetch, which for the `MultiRegionDisplayMixin` family are
   * `bufferedVisibleRegions` — half a screen each side, so twice the visible
   * span. The number the banner quotes is therefore the whole download rather
   * than the on-screen slice of it, which is the honest thing to ask permission
   * for.
   */
  measuredSpanBp: number
  /**
   * The user zoomed in materially and the estimate did not fall — so this file
   * quotes the same blocks however far they go, and "zoom in to see features" is
   * advice that cannot work. Drives `zoomCanReleaseGate`, which is what the
   * banner offers a way out from.
   *
   * **Measured, never predicted.** False on a first measurement, because one
   * point is not evidence; set by {@link nextByteEstimate} when a later
   * measurement at a materially smaller span comes back materially unchanged,
   * and cleared again the moment one does fall. Predicting it instead would mean
   * sampling the index at a ladder of sub-spans up front, which costs 18x the
   * one call on a whole-genome region set (2.4s against 133ms, measured
   * 2026-08-06) to answer a question only a blocked track ever asks.
   */
  zoomIneffective: boolean
}

/** What a measurement is about, captured before it is requested. */
export interface GateViewport {
  spanBp: number
  key: string
}

/**
 * Fold a fresh measurement into the stored one, carrying across the only thing
 * the stored one knows that the fresh one can't: whether zooming has been shown
 * not to help. See {@link ByteEstimate.zoomIneffective}.
 *
 * Deliberately a pure function rather than logic inside `setByteEstimate`, so
 * the "two points make the evidence" rule is testable without a model, and so
 * the thresholds sit next to the measurements that chose them.
 */
export function nextByteEstimate(
  previous: ByteEstimate | undefined,
  measurement: { bytes: number | undefined; viewport: GateViewport },
): ByteEstimate {
  const { bytes, viewport } = measurement
  const base = { bytes, measuredSpanBp: viewport.spanBp }
  // Nothing to compare against, or nothing comparable: an unmeasurable estimate
  // on either side says nothing about zoom. Start from "zoom might help", which
  // is what the banner has always said by default.
  if (
    previous?.bytes === undefined ||
    bytes === undefined ||
    previous.measuredSpanBp <= 0
  ) {
    return { ...base, zoomIneffective: false }
  }
  // Zoomed out, or barely moved — no new evidence either way, so keep whatever
  // the last zoom-in taught us rather than clearing it on a pan.
  const zoomedInMaterially =
    viewport.spanBp / previous.measuredSpanBp <= ZOOM_EVIDENCE_SPAN_RATIO
  return {
    ...base,
    zoomIneffective: zoomedInMaterially
      ? bytes / previous.bytes > ZOOM_EVIDENCE_BYTE_RATIO
      : previous.zoomIneffective,
  }
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
// floor turned the byte gate off below 20kb, so zooming far enough always
// worked. The byte gate no longer stops at any floor, and an index quotes whole
// blocks — so for a file whose blocks are large the same bytes come down however
// far the user goes, and telling them to keep zooming into a fetch whose cost
// cannot fall is the one thing the banner must not do. `zoomCanReleaseGate`
// answers it from two consecutive measurements rather than from a threshold; see
// `ByteEstimate.zoomIneffective`.
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

export interface RegionTooLargeStatus {
  tooLarge: boolean
  reason: string
  /**
   * Which axis tripped, absent when nothing did. Not a second spelling of
   * `reason` — `zoomCanReleaseGate` has to branch on it, because the two axes
   * answer "would zooming in help?" differently and only one of them can
   * honestly say no. Screen density is features ÷ pixels, so it falls with
   * `bpPerPx` whatever the file looks like; bytes come in whole index blocks
   * and may not fall at all ({@link ByteEstimate.zoomIneffective}). Matching on
   * the reason string instead would tie the banner's logic to its wording.
   */
  axis?: 'bytes' | 'density'
}

export const NOT_TOO_LARGE: RegionTooLargeStatus = {
  tooLarge: false,
  reason: '',
}

/**
 * The comparison half of the verdict: which axis is over budget, and the banner
 * text for it. Bytes take precedence over density for both.
 *
 * Deliberately knows nothing about *whether* each axis applies — force-load, the
 * opt-in, and the `AUTO_FORCE_LOAD_BP` floor on the density axis live in
 * `byteGateActive` / `densityGateActive` on `RegionTooLargeMixin`, which are also
 * what stop the pre-flight RPC and the worker budgets. Those ask "may this axis
 * gate?", this one asks "does it?" — so each caller passes `undefined` / `false`
 * for an axis that is off rather than restating why.
 */
export function evaluateRegionTooLarge({
  estimatedFetchBytes,
  byteLimit,
  densityTooLarge,
}: {
  estimatedFetchBytes?: number
  byteLimit?: number
  densityTooLarge?: boolean
}): RegionTooLargeStatus {
  if (
    estimatedFetchBytes !== undefined &&
    byteLimit !== undefined &&
    estimatedFetchBytes > byteLimit
  ) {
    return {
      tooLarge: true,
      reason: bytesTooLargeReason(estimatedFetchBytes),
      axis: 'bytes',
    }
  }
  if (densityTooLarge) {
    return { tooLarge: true, reason: TOO_MANY_FEATURES_REASON, axis: 'density' }
  }
  return NOT_TOO_LARGE
}
