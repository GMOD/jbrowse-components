import { adapterByteLimit, overByteBudget } from '@jbrowse/core/rpc/byteBudget'
import { getDisplayStr } from '@jbrowse/core/util'

/**
 * The span below which the **density** axis stops gating. `aboveForceLoadFloor`
 * on `RegionTooLargeMixin` is the only comparison against it.
 *
 * **On the byte axis it is a budget tier, not a floor** — see
 * {@link SUB_FLOOR_BYTE_BUDGET_FACTOR}. Why, and the measurements that decided
 * it: agent-docs/reference/REGION_TOO_LARGE.md § "The sub-floor budget tier".
 */
export const AUTO_FORCE_LOAD_BP = 20_000

/**
 * How much the byte budget is multiplied by below {@link AUTO_FORCE_LOAD_BP}.
 * The gate keeps asking down there — a tier, not an off-switch — but against a
 * larger number, because at gene scale the user navigated to this locus
 * deliberately.
 *
 * A policy dial, not a derived constant: raise it if real tracks keep bannering
 * at a locus, lower it if a tab hangs. What it is sized against, and why a tier
 * rather than the old floor: agent-docs/reference/REGION_TOO_LARGE.md § "The
 * sub-floor budget tier".
 */
export const SUB_FLOOR_BYTE_BUDGET_FACTOR = 2

/**
 * A re-measure is only evidence about zoom when the span actually moved: below
 * this ratio the two measurements describe about the same window, so a flat
 * result says nothing about whether zooming further would help.
 */
const ZOOM_EVIDENCE_SPAN_RATIO = 0.5

/**
 * ...and a halving that buys less than a tenth of the bytes is the index quoting
 * the same blocks. The halving curve that chose this: REGION_TOO_LARGE.md
 * § "Measurement follows the viewport".
 */
const ZOOM_EVIDENCE_BYTE_RATIO = 0.9

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
   * Undefined is not representable: an adapter quoting no estimate leaves the
   * whole {@link ByteEstimate} unset, so "unmeasurable" and "not measured yet"
   * are one state. `0` is a real measurement — a region with no index chunks.
   */
  bytes: number
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
 * The gate as it was when a fetch was issued, since every field moves during
 * the round trip and its results are judged against none of their live values.
 */
export interface GateFetchState {
  viewport: GateViewport | undefined
  gated: boolean
  /**
   * `byteGateAdapterKey` at issue — which *file* the measurement is about, the
   * way `viewport` says which region. A fetch in flight across a tier swap
   * (MAF crossing the summary threshold mid-RPC) otherwise commits the old
   * tier's bytes right after `ClearByteEstimateOnTierSwap` dropped them, and
   * the banner quotes megabytes against a summary read. Undefined when the
   * display never gates, so an ungated display's `byteGateAdapterConfig` is
   * never evaluated.
   */
  tierKey: string | undefined
}

/**
 * The gate's own stored state: everything a sequence of events moves, and
 * nothing else. `regionTooLarge` and its neighbours are pure functions of this
 * plus the display's budgets, so this is the whole of what the protocol below
 * has to get right.
 */
export interface GateState {
  byteEstimate: ByteEstimate | undefined
  gateMeasuredViewportKey: string | undefined
  forceLoadTrack: boolean
}

/**
 * Everything that moves a {@link GateState}, as data. `viewportMoved` carries
 * no payload and changes nothing, and is here precisely for that: the estimate
 * surviving an ordinary pan is a rule rather than an omission, and a walk over
 * these events can only assert it if the event exists to walk over.
 */
export type GateEvent =
  /** a fetch's measurement came back — the one event with rules attached */
  | {
      kind: 'measurement'
      /** the gate as it stood when that fetch was issued */
      issued: GateFetchState
      /** `byteGateAdapterKey` now, which `issued.tierKey` is judged against */
      currentTierKey: string | undefined
      /** absent when the fetch measured no bytes (a density short-circuit) */
      bytes?: number
    }
  /** the stored estimate describes a fetch nobody is going to make any more */
  | { kind: 'invalidated' }
  /** the user approved this track track-wide, or that approval was revoked */
  | { kind: 'forceLoad'; approved: boolean }
  /** a pan or zoom inside the same chromosome and the same tier */
  | { kind: 'viewportMoved' }

/**
 * The byte gate's commit protocol as a pure function, so a seeded walk over
 * event *sequences* can reach it. `gateTruthTable.test.ts` enumerates the
 * derived getters exhaustively and says itself that it cannot see an order —
 * yet every rule here is about one: which of two measurements wins, what a
 * clear leaves behind, what an approval outlives. The 2026-08 tier-key bug had
 * exactly that shape, and the example test pinning it could only be written
 * once somebody had thought of the interleaving.
 *
 * Four rules, each of which used to live at a call site or nowhere:
 *
 * - **a measurement is judged by the tier it was issued against.** A fetch
 *   still in flight when `ClearByteEstimateOnTierSwap` fires would otherwise
 *   re-instate the old tier's bytes right behind the clear, and the banner
 *   would quote them against the new tier's file until the next fetch corrected
 *   it. An `issued.tierKey` of `undefined` means the display never gates, so
 *   there is no tier to disagree about.
 * - **a fetch the gate sat out stamps nothing** (`gated: false`), so
 *   `gateMeasurementStale` goes on asking about the live viewport.
 * - **unmeasurable is not a measurement.** An absent `bytes` leaves the last
 *   real estimate alone rather than wiping it.
 * - **an approval outlives an invalidation.** `forceLoadTrack` is track-wide, so
 *   expiring it on a chromosome change is the per-locus re-approval the button
 *   exists to avoid.
 *
 * Returns `prev` itself when nothing moved, which is what lets a caller assign
 * the fields back unconditionally: a volatile is `observable.ref`, so writing an
 * identical value notifies nobody.
 */
export function nextGateState(prev: GateState, event: GateEvent): GateState {
  switch (event.kind) {
    case 'viewportMoved': {
      return prev
    }
    case 'forceLoad': {
      return { ...prev, forceLoadTrack: event.approved }
    }
    case 'invalidated': {
      return {
        ...prev,
        byteEstimate: undefined,
        gateMeasuredViewportKey: undefined,
      }
    }
    case 'measurement': {
      const { issued, currentTierKey, bytes } = event
      const { viewport, gated, tierKey } = issued
      if (
        viewport === undefined ||
        (tierKey !== undefined && tierKey !== currentTierKey)
      ) {
        return prev
      }
      return {
        ...prev,
        gateMeasuredViewportKey: gated
          ? viewport.key
          : prev.gateMeasuredViewportKey,
        byteEstimate:
          bytes === undefined
            ? prev.byteEstimate
            : nextByteEstimate(prev.byteEstimate, { bytes, viewport }),
      }
    }
  }
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
  measurement: { bytes: number; viewport: GateViewport },
): ByteEstimate {
  const { bytes, viewport } = measurement
  const base = { bytes, measuredSpanBp: viewport.spanBp }
  // A zero baseline, of span or of bytes, cannot carry a ratio
  if (
    previous === undefined ||
    previous.measuredSpanBp <= 0 ||
    previous.bytes <= 0
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

/**
 * Resolve the effective byte budget: the adapter's self-reported limit, else the
 * display's configured default, times {@link SUB_FLOOR_BYTE_BUDGET_FACTOR} when
 * the span is below {@link AUTO_FORCE_LOAD_BP}. A non-positive adapter limit
 * means "no opinion" (e.g. htsget/no-index adapters report 0) and is skipped —
 * without this guard a 0 would gate every request as too-large, and a negative
 * sentinel (-1) would survive `|| undefined` (truthy) and do the same.
 *
 * All three inputs are read on the main thread (`gateByteLimit`), so the banner
 * and the worker budget resolve one number. There is deliberately no force-load
 * tier: force-load is a boolean "render this track regardless" (`gateExempt`),
 * not a raised ceiling
 * (agent-docs/architecture-decision-records/adr-074-force-load-is-one-boolean-per-track.md).
 * The span tier is not that ceiling wearing a hat: it is static rather than
 * derived from a measurement, single-axis by construction, and never expires.
 */
export function resolveByteLimit({
  adapterFetchSizeLimit,
  configFetchSizeLimit,
  belowForceLoadFloor,
}: {
  adapterFetchSizeLimit?: number
  configFetchSizeLimit: number
  // required: a caller that forgot the floor term would silently skip the
  // sub-floor budget raise
  belowForceLoadFloor: boolean
}) {
  const base = adapterByteLimit(adapterFetchSizeLimit, configFetchSizeLimit)
  return belowForceLoadFloor ? base * SUB_FLOOR_BYTE_BUDGET_FACTOR : base
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

// Module-private and frozen: one shared object is returned to every caller that
// isn't gating, so an accidental write would be a cross-display one.
const NOT_TOO_LARGE: Readonly<RegionTooLargeStatus> = Object.freeze({
  tooLarge: false,
  reason: '',
})

/**
 * The comparison half of the verdict: which axis is over budget, and the banner
 * text for it. Bytes take precedence over density for both.
 *
 * Deliberately knows nothing about *whether* each axis applies — force-load, the
 * opt-in, and the `AUTO_FORCE_LOAD_BP` floor on the density axis live in
 * `gateActive` / `densityGateActive` on `RegionTooLargeMixin`, which are also
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
  // `overByteBudget` rather than the comparison written out here, because the
  // worker's in-fetch short-circuit makes the same one and the two reaching it
  // separately is how a rejection with no banner happens. This function's own
  // job is the axis precedence and the wording.
  if (overByteBudget(estimatedFetchBytes, byteLimit)) {
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
