import { toLocale } from '@jbrowse/core/util'

// The one home for coordinate -> location text in this plugin.
//
// Coordinates are 0-based half-open; printed locations are 1-based inclusive.
// The conversion is asymmetric — a `start` gains 1, an `end` does not — and a
// bare number doesn't say which side it is. So call the function named for the
// side you hold rather than reaching for `toLocale` directly.

/** `refName:pos` for the FIRST base of a 0-based half-open interval. */
export function formatStartLocation(refName: string, start: number) {
  return `${refName}:${toLocale(start + 1)}`
}

/** `refName:pos` for the LAST base of a 0-based half-open interval. */
export function formatEndLocation(refName: string, end: number) {
  return `${refName}:${toLocale(end)}`
}

/**
 * `refName:first-last` for a 0-based half-open interval — a read, a sashimi
 * intron, an SA-tag record. Matches `formatCigarTooltip`, "Copy location", the
 * SAM export, and `BaseFeatureDetail`, so a hover can't disagree by one with
 * the click-through.
 */
export function formatLocationRange(
  refName: string,
  start: number,
  end: number,
) {
  return `${refName}:${toLocale(start + 1)}-${toLocale(end)}`
}

/**
 * The same range as `formatLocationRange`, as a locstring for `navToLoc` (no
 * thousands separators for a parser to strip). `padBp` widens both sides so the
 * landed view frames the feature; the start clamps to 1.
 */
export function toNavLocString(
  refName: string,
  start: number,
  end: number,
  padBp = 0,
) {
  return `${refName}:${Math.max(1, start + 1 - padBp)}-${end + padBp}`
}
