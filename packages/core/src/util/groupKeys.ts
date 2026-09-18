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

/**
 * The text a field value groups, colors and labels by: a missing value is the
 * `''` catch-all, and a multi-valued attribute joins, so two features carrying
 * the same list land together.
 */
export function valueText(value: unknown): string {
  return value === undefined || value === null
    ? ''
    : Array.isArray(value)
      ? value.map(String).join(',')
      : String(value)
}

function groupKeyRank(key: string) {
  return key === '' ? 1 : key === OVERFLOW_GROUP_KEY ? 2 : 0
}

const NUMERIC = /^-?\d+(\.\d+)?$/
const DIGIT_RUNS = /\d+|\D+/g

function compareRuns(a: string, b: string) {
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
  return runsA.length - runsB.length
}

/**
 * Numbers first by value, then every other key run by run with digit runs by
 * magnitude, so -1 before 1 and chr2 before chr10. The two classes never
 * interleave: a signed or decimal number read run by run orders differently
 * than by value, and letting them mix made the order intransitive.
 */
export function compareGroupKeys(a: string, b: string) {
  const rankDiff = groupKeyRank(a) - groupKeyRank(b)
  if (rankDiff !== 0 || a === b) {
    return rankDiff
  }
  const numA = NUMERIC.test(a)
  const numB = NUMERIC.test(b)
  if (numA !== numB) {
    return numA ? -1 : 1
  }
  if (numA) {
    const diff = Number(a) - Number(b)
    if (diff !== 0) {
      return diff < 0 ? -1 : 1
    }
  }
  return compareRuns(a, b)
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
 * Which section each key stacks into once the cap applies: the first
 * `MAX_GROUPS` keys in `compare` order keep their own and the rest fold into
 * the overflow section. The catch-all `''` is held out of the merge, since
 * "lacking the value" is an answer users look for.
 */
export function capGroupKeys(
  keys: Iterable<string>,
  compare: (a: string, b: string) => number = compareGroupKeys,
) {
  const ordered = [...new Set(keys)].sort(compare)
  const hasUntagged = ordered.includes('')
  const named = ordered.filter(key => key !== '')
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
