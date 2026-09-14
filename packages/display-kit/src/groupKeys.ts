/**
 * The ordering every in-track group-by shares, whatever partitioned the
 * features: named groups first, then the `''` catch-all a dimension files its
 * unanswerable features under, then the overflow bucket a capped partition
 * merged its tail into.
 */

// '\0' cannot collide with a real tag value or refName, and the rank below
// pins it dead last so a merged tail never displaces a named group.
export const OVERFLOW_GROUP_KEY = '\u0000overflow'

function groupKeyRank(key: string) {
  return key === '' ? 1 : key === OVERFLOW_GROUP_KEY ? 2 : 0
}

const ALL_DIGITS = /^\d+$/

/**
 * Two all-digit keys compare by magnitude, so numeric tag values order 1, 2,
 * 10. Everything else is code-point rather than localeCompare, which stays
 * deterministic and puts '+' before '-'. A display merging groups across
 * regions applies this same order, since one region's sort cannot place a
 * group absent from it.
 */
export function compareGroupKeys(a: string, b: string) {
  const rankDiff = groupKeyRank(a) - groupKeyRank(b)
  if (rankDiff !== 0) {
    return rankDiff
  }
  if (ALL_DIGITS.test(a) && ALL_DIGITS.test(b)) {
    const na = Number(a)
    const nb = Number(b)
    if (na !== nb) {
      return na < nb ? -1 : 1
    }
  }
  return a === b ? 0 : a < b ? -1 : 1
}

/**
 * The overflow bucket's chip. Says MERGED because that lane is the one entry
 * in a stack that is not a value, and this label is the only place a reader
 * is told the cap fired at all.
 */
export function overflowLabel(count: number) {
  return `${count} merged values`
}

/**
 * A group's stable identity: its sort key and the label its chip shows.
 */
export interface GroupId {
  key: string
  label: string
}
