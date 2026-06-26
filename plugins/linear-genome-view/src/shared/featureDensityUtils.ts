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
 * display's configured default. An adapter limit of 0 means "no opinion" (e.g.
 * htsget/no-index adapters) and is skipped — without this guard a 0 would gate
 * every request as too-large. Single source of truth for all three paths.
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
  return (
    userByteSizeLimit ??
    (adapterFetchSizeLimit || undefined) ??
    configFetchSizeLimit
  )
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
