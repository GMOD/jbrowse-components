import { STRAND_DOMAIN, STRAND_FIELD, strandLabel } from './strandScale.ts'

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

const NUMERIC = /^-?\d+(\.\d+)?$/
const DIGIT_RUNS = /\d+|\D+/g

/**
 * Two numeric keys compare by magnitude, so numeric tag values order 1, 2,
 * 10 and a signed field orders -1 before 1. Any other pair compares run by
 * run, a digit run by magnitude and the rest by code point, so chr2 files
 * before chr10 and HP1 before HP10 while '+' stays before '-'. Code point
 * rather than localeCompare keeps the order deterministic across locales. A
 * display merging groups across regions applies this same order, since one
 * region's sort cannot place a group absent from it.
 */
export function compareGroupKeys(a: string, b: string) {
  const rankDiff = groupKeyRank(a) - groupKeyRank(b)
  if (rankDiff !== 0) {
    return rankDiff
  }
  if (a === b) {
    return 0
  }
  if (NUMERIC.test(a) && NUMERIC.test(b)) {
    const na = Number(a)
    const nb = Number(b)
    if (na !== nb) {
      return na < nb ? -1 : 1
    }
  }
  const runsA = a.match(DIGIT_RUNS) ?? []
  const runsB = b.match(DIGIT_RUNS) ?? []
  const shared = Math.min(runsA.length, runsB.length)
  for (let i = 0; i < shared; i++) {
    const x = runsA[i]!
    const y = runsB[i]!
    if (x === y) {
      continue
    }
    if (/^\d/.test(x) && /^\d/.test(y)) {
      const nx = Number(x)
      const ny = Number(y)
      if (nx !== ny) {
        return nx < ny ? -1 : 1
      }
      return x.length < y.length ? -1 : 1
    }
    return x < y ? -1 : 1
  }
  return runsA.length < runsB.length ? -1 : 1
}

/**
 * The order a facet stacks its sections in. `domain` is the channel's
 * declared order: the keys it lists come first, in that order, and the rest
 * follow under `compareGroupKeys`. Every categorical channel in the tree
 * reads its domain this way, so a listed value is a placement and an
 * unlisted one is not an error.
 */
export function groupKeyComparator(domain?: readonly string[]) {
  if (!domain?.length) {
    return compareGroupKeys
  }
  const rank = new Map<string, number>()
  domain.forEach((key, i) => {
    if (!rank.has(key)) {
      rank.set(key, i)
    }
  })
  return (a: string, b: string) => {
    const ra = rank.get(a) ?? Infinity
    const rb = rank.get(b) ?? Infinity
    return ra !== rb ? (ra < rb ? -1 : 1) : compareGroupKeys(a, b)
  }
}

/**
 * The domain a re-pick keeps: a grouping set from a menu or dialog names no
 * domain, so one landing in the key space the current grouping already
 * occupies carries the current order along. A reorder names its own domain
 * and passes through, an empty one included.
 */
export function carryGroupDomain<
  T extends { type: string; domain?: readonly string[] },
>(next: T | undefined, current: T | undefined): T | undefined {
  return next !== undefined &&
    next.domain === undefined &&
    current?.domain !== undefined &&
    groupKeySpaceOf(next) === groupKeySpaceOf(current)
    ? { ...next, domain: current.domain }
    : next
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
 * The chip a facet section shows: a strand by name, any other field's value
 * as `field: value`, and its catch-all as `field: none`.
 */
export function facetSectionLabel(field: string, key: string) {
  return (
    (field === STRAND_FIELD ? strandLabel(key) : undefined) ??
    `${field}: ${key === '' ? 'none' : key}`
  )
}

/**
 * #api
 * The key row a feature with nothing in a categorical field lands on, so the
 * legend says why a mark is grey, or a disc, rather than listing a blank
 * value. The same catch-all `facetSectionLabel` chips `field: none`, named for
 * a key rather than for a section.
 */
export const NO_VALUE_LABEL = '(no value)'

/**
 * The order a facet stacks its sections in, its defaults filled in: the
 * declared `domain`, or forward, reverse and unstranded for a strand facet
 * that declares none. Raw strand keys sort `-1, 0, 1` under
 * `compareGroupKeys`, which stacks the reverse band first and reads as an
 * accident of the encoding.
 */
export function facetSectionOrder(
  field: string,
  domain: readonly string[] = [],
) {
  return domain.length === 0 && field === STRAND_FIELD ? STRAND_DOMAIN : domain
}

/**
 * Which section each key stacks into once the cap applies: the first
 * `MAX_GROUPS` keys in `domain` order keep their own, the rest fold into the
 * overflow section, so a key the domain places never merges behind one it
 * does not. The catch-all `''` is held out of the merge, since "lacking the
 * value" is a distinct answer users look for and it sorts into the very tail
 * this merges. Two callers with the same key set get the same answer, so a
 * layout and a reading of that layout agree on the sections without sharing
 * state.
 */
export function capGroupKeys(
  keys: Iterable<string>,
  domain?: readonly string[],
) {
  const ordered = [...new Set(keys)].sort(groupKeyComparator(domain))
  const hasUntagged = ordered.includes('')
  const named = ordered.filter(key => key !== '')
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

/**
 * Identity of the key space a grouping hands out keys in: the dimension plus
 * whatever parameter it takes (a tag, an attribute). A key means nothing on
 * its own, since `''` is both the ungrouped section and every dimension's
 * catch-all, so anything keyed by group key is dropped when this moves. The
 * `domain` only orders the keys and is no part of the space, so a reorder
 * keeps what a reader hid.
 */
export function groupKeySpaceOf(
  groupBy:
    | { type: string; domain?: readonly string[]; [param: string]: unknown }
    | undefined,
) {
  if (groupBy === undefined) {
    return ''
  }
  const { type, ...params } = groupBy
  return [
    type,
    ...Object.entries(params)
      .filter(([k, v]) => k !== 'domain' && typeof v === 'string')
      .map(([, v]) => v),
  ].join('\0')
}
