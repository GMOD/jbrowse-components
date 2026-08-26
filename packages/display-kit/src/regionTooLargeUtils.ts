import { adapterByteLimit, overByteBudget } from '@jbrowse/core/rpc/byteBudget'
import { getDisplayStr } from '@jbrowse/core/util/numericUtils'

/**
 * The span below which the density axis stops gating and the byte budget is
 * multiplied by {@link SUB_FLOOR_BYTE_BUDGET_FACTOR}. Compared only in
 * `aboveForceLoadFloor`.
 */
export const AUTO_FORCE_LOAD_BP = 20_000

/**
 * The byte budget's multiplier below {@link AUTO_FORCE_LOAD_BP}: what one index
 * bin costs on the deepest file in the repo. A policy dial —
 * agent-docs/reference/REGION_TOO_LARGE.md § "The sub-floor budget tier".
 */
export const SUB_FLOOR_BYTE_BUDGET_FACTOR = 2

/**
 * The byte budget a gated display resolves when neither its own
 * `fetchSizeLimit` slot nor the measured adapter's declares one — the tightest
 * tier in the system, and the same number
 * `regionTooLargeConfigSchemaFields.fetchSizeLimit` defaults to. That table has
 * to keep its own literal (`scripts/gatedBudgets.ts` reads the number out of the
 * source), so `regionTooLargeUtils.test.ts` pins the two together.
 */
export const BASE_FETCH_SIZE_LIMIT = 1_000_000

const ZOOM_EVIDENCE_SPAN_RATIO = 0.5
const ZOOM_EVIDENCE_BYTE_RATIO = 0.9

/** One measurement of what a fetch would cost, at the viewport it describes. */
export interface ByteEstimate {
  /** Never undefined: an unmeasurable fetch leaves the whole estimate unset. */
  bytes: number
  /** The visible span at measurement, kept only to compare two measurements. */
  measuredSpanBp: number
  /**
   * A materially smaller span came back materially unchanged, so "zoom in to
   * see features" cannot work for this file. Evidence, never predicted.
   */
  zoomIneffective: boolean
}

/** What a measurement is about, captured before it is requested. */
export interface GateViewport {
  spanBp: number
  /**
   * The measurement's identity: the stretch of genome on screen and the
   * settings it is asked under, which is what `gateMeasurementStale` compares.
   * `RegionTooLargeMixin.gateViewport` builds it and says why the settings are
   * in there.
   */
  key: string
}

/** The gate as it stood when a fetch was issued; its result is judged by this. */
export interface GateFetchState {
  viewport: GateViewport | undefined
  gated: boolean
  /** `byteGateAdapterKey` at issue; undefined when the display never gates. */
  tierKey: string | undefined
}

/** Everything a sequence of gate events moves. */
export interface GateState {
  byteEstimate: ByteEstimate | undefined
  gateMeasuredViewportKey: string | undefined
  forceLoadTrack: boolean
}

export type GateEvent =
  | {
      kind: 'measurement'
      issued: GateFetchState
      currentTierKey: string | undefined
      /** absent when the fetch measured no bytes */
      bytes?: number
    }
  | { kind: 'invalidated' }
  | { kind: 'forceLoad'; approved: boolean }
  /** changes nothing, so a walk over events can assert that it doesn't */
  | { kind: 'viewportMoved' }

/**
 * The commit protocol, pure so `nextGateState.test.ts` can walk event
 * sequences: a measurement is judged by the tier it was issued against, a
 * fetch the gate sat out stamps no viewport, an absent `bytes` leaves the last
 * estimate alone, and an approval outlives an invalidation. Returns `prev`
 * itself when nothing moved.
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
 * Fold a fresh measurement into the stored one. `zoomIneffective` needs two
 * points: a span at most half the previous one whose bytes are still over 90%
 * of it. A zero baseline of span or bytes starts over.
 */
export function nextByteEstimate(
  previous: ByteEstimate | undefined,
  measurement: { bytes: number; viewport: GateViewport },
): ByteEstimate {
  const { bytes, viewport } = measurement
  const base = { bytes, measuredSpanBp: viewport.spanBp }
  if (
    previous === undefined ||
    previous.measuredSpanBp <= 0 ||
    previous.bytes <= 0
  ) {
    return { ...base, zoomIneffective: false }
  }
  const zoomedInMaterially =
    viewport.spanBp / previous.measuredSpanBp <= ZOOM_EVIDENCE_SPAN_RATIO
  return {
    ...base,
    zoomIneffective: zoomedInMaterially
      ? bytes / previous.bytes > ZOOM_EVIDENCE_BYTE_RATIO
      : previous.zoomIneffective,
  }
}

export const TOO_MANY_FEATURES_REASON = 'Too many features'

export function bytesTooLargeReason(bytes: number) {
  return `Requested too much data (${getDisplayStr(bytes)})`
}

/**
 * The gate's byte budget: the adapter's declared limit (a non-positive one
 * means no opinion), else the display's, else {@link BASE_FETCH_SIZE_LIMIT},
 * times {@link SUB_FLOOR_BYTE_BUDGET_FACTOR} below the floor. Force-load is not
 * a tier here; it bypasses the comparison.
 *
 * **A budget nobody declared falls back closed.** `configFetchSizeLimit` comes
 * from `getConf`, which answers `undefined` for a slot the composing display's
 * schema never declared — silently, as it always does. An undefined budget
 * propagates to `measureRegionBytes`, which returns `{}` and measures nothing,
 * so the gate is off with nothing to see. A wrongly-tight banner is visible,
 * diagnosable and has an escape on the banner itself; a wrongly-open gate is a
 * silent multi-GB download. It does not throw, because a schema-authoring slip
 * should not crash a display and the `undefined` surfaces far from the author.
 */
export function resolveByteLimit({
  adapterFetchSizeLimit,
  configFetchSizeLimit,
  belowForceLoadFloor,
}: {
  adapterFetchSizeLimit?: number
  configFetchSizeLimit: number | undefined
  belowForceLoadFloor: boolean
}) {
  const configured = adapterByteLimit(
    configFetchSizeLimit,
    BASE_FETCH_SIZE_LIMIT,
  )
  const base = adapterByteLimit(adapterFetchSizeLimit, configured)
  return belowForceLoadFloor ? base * SUB_FLOOR_BYTE_BUDGET_FACTOR : base
}

export interface RegionTooLargeStatus {
  tooLarge: boolean
  reason: string
  /** Which axis tripped; `zoomCanReleaseGate` branches on it. */
  axis?: 'bytes' | 'density'
}

const NOT_TOO_LARGE: Readonly<RegionTooLargeStatus> = Object.freeze({
  tooLarge: false,
  reason: '',
})

/**
 * The comparison half of the verdict: bytes against the budget, then density.
 * Whether an axis may act is the caller's question — it passes `undefined` /
 * `false` for an axis that is off.
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

/**
 * Whether the data a display already holds may answer this run, or whether the
 * gate outranks it.
 *
 * While `regionTooLarge` holds, every "already have it" gate is void — the
 * per-region family's `covered`, the global family's `signatureCurrent`. Held
 * data answers nothing while the banner hides it, and the fetch is the only
 * re-measure, so a return to a viewport whose data is still loaded has to fetch
 * or the banner can never be released.
 *
 * `held` is a thunk, so a caller's own short-circuit survives: the per-region
 * plan reads `isCacheValid` only for a block it already found covered, and
 * evaluating it eagerly would widen that autorun's dependency set.
 *
 * The one skip that outranks this is `gateSkipsMeasuredViewport`, applied by
 * both callers above their fetch — without it a still-refused display spins on
 * the `fetchGeneration` bump.
 */
export function heldDataAnswers(gateBlocked: boolean, held: () => boolean) {
  return !gateBlocked && held()
}
