/**
 * The ordering every in-track group-by shares, whatever partitioned the
 * features: named groups first, then the `''` catch-all a dimension files its
 * unanswerable features under, then the overflow bucket a capped partition
 * merged its tail into.
 */

// '\0' cannot collide with a real tag value or refName, and the rank below
// pins it dead last so a merged tail never displaces a named group.
export const OVERFLOW_GROUP_KEY = '\u0000overflow'

// Hard ceiling on the sections one grouping may stack; the tail past it merges
// into the overflow section. A backstop for the dimensions that are not a
// closed set, a tag or an attribute, whose value space is the file's.
export const MAX_GROUPS = 40

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
 * Which section each key stacks into once the cap applies: the first
 * `MAX_GROUPS` keys in order keep their own, the rest fold into the overflow
 * section. The catch-all `''` is held out of the merge and re-pinned ahead of
 * the overflow bucket, since "lacking the value" is a distinct answer users
 * look for and it sorts into the very tail this merges. Two callers with the
 * same key set get the same answer, which is what lets a layout and a reading
 * of that layout agree on the sections without sharing state.
 */
export function capGroupKeys(keys: Iterable<string>) {
  const ordered = [...new Set(keys)].sort(compareGroupKeys)
  const hasUntagged = ordered.at(-1) === ''
  const named = hasUntagged ? ordered.slice(0, -1) : ordered
  // > not >=, so the cap only fires when it genuinely merges 2+ groups.
  const merged =
    ordered.length > MAX_GROUPS
      ? named.slice(MAX_GROUPS - (hasUntagged ? 2 : 1))
      : []
  const mergedSet = new Set(merged)
  return {
    mergedCount: merged.length,
    sectionOf: (key: string) => (mergedSet.has(key) ? OVERFLOW_GROUP_KEY : key),
  }
}

/**
 * A group's stable identity: its sort key and the label its chip shows.
 */
export interface GroupId {
  key: string
  label: string
}
