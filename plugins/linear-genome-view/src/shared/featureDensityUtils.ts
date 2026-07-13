import { AUTO_FORCE_LOAD_BP } from '../LinearGenomeView/index.ts'

export function getDisplayStr(totalBytes: number) {
  if (Math.floor(totalBytes / 1000000) > 0) {
    return `${Number.parseFloat((totalBytes / 1000000).toPrecision(3))} Mb`
  } else if (Math.floor(totalBytes / 1000) > 0) {
    return `${Number.parseFloat((totalBytes / 1000).toPrecision(3))} Kb`
  } else {
    return `${Math.floor(totalBytes)} bytes`
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
 * Scale a captured byte estimate from the span it was measured over
 * (`captureBp`) to the currently visible span (`visibleBp`). The estimate is
 * roughly proportional to span, so scaling makes the too-large verdict a pure
 * function of the current view — it self-releases on zoom-in instead of a large
 * zoomed-out estimate staying above the limit forever and gating refetch. The
 * derived `regionTooLarge` getter on the canvas and LD displays feeds the result
 * to `evaluateRegionTooLarge`. Returns undefined when there's no estimate yet;
 * falls back to the raw estimate when the capture span is unknown.
 */
export function scaleByteEstimate({
  bytes,
  captureBp,
  visibleBp,
}: {
  bytes?: number
  captureBp?: number
  visibleBp: number
}) {
  if (!bytes) {
    return undefined
  }
  return captureBp ? (bytes * visibleBp) / captureBp : bytes
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
  bytes,
  byteLimit,
  densityTooLarge,
  alwaysRender,
}: {
  visibleBp: number
  bytes?: number
  byteLimit?: number
  densityTooLarge?: boolean
  alwaysRender?: boolean
}): RegionTooLargeStatus {
  // Self-summarizing adapters (e.g. BigWig) cap returned data at screen
  // resolution, so no region is ever too large regardless of span or threshold.
  if (alwaysRender || visibleBp < AUTO_FORCE_LOAD_BP) {
    return NOT_TOO_LARGE
  }
  if (bytes !== undefined && byteLimit !== undefined && bytes > byteLimit) {
    return { tooLarge: true, reason: bytesTooLargeReason(bytes) }
  }
  if (densityTooLarge) {
    return { tooLarge: true, reason: TOO_MANY_FEATURES_REASON }
  }
  return NOT_TOO_LARGE
}
