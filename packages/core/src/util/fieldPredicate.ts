import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { testsSomething } from './fieldPredicateType.ts'
import { isMissing, valueText } from './groupKeys.ts'
import { isJexl } from './jexlStrings.ts'
import { numericValue } from './numericValue.ts'

import type { FieldPredicate } from './fieldPredicateType.ts'

export { testsSomething } from './fieldPredicateType.ts'
export type { FieldPredicate } from './fieldPredicateType.ts'

/**
 * Where a field's values live, as the caller resolves it:
 * - `number`: one number per record, NaN for a missing value
 * - `labels`: one index per record into `labels`, out of range for a missing
 *   value (a dictionary-coded string lane)
 * - `get`: a reader over record objects, `undefined` or `null` for a missing
 *   value
 * - `bits`: a boolean that is one bit of a word, such as a SAM flag. Every
 *   `equal` test on bits of one `word` reader fuses into one mask compare,
 *   so a flag filter costs one read and two ANDs however many flags it names
 */
export type PredicateLane<T = number> =
  | { kind: 'number'; values: ArrayLike<number> }
  | { kind: 'labels'; ids: ArrayLike<number>; labels: readonly string[] }
  | { kind: 'get'; get: (item: T) => unknown }
  | { kind: 'bits'; word: (item: T) => number; mask: number }

// What a compiled list tests: a record index for the typed lanes, or the
// record itself where the caller holds one (a BAM read), which spares each
// lane a lookup by index
type Test<T = number> = (item: T) => boolean

const NEVER = () => false

// Bounds as one interval, so a predicate with both ends tests both in one
// closure. A Float32 lane rounds them to its precision: 0.9 reads back from
// a Float32Array as 0.89999997615, below a Float64 0.9, and `gte: 0.9` would
// drop the alignments it names.
function boundsOf(p: FieldPredicate, round: (n: number) => number) {
  const lo = Math.max(
    p.gte === undefined ? -Infinity : round(p.gte),
    p.gt === undefined ? -Infinity : round(p.gt),
  )
  const hi = Math.min(
    p.lte === undefined ? Infinity : round(p.lte),
    p.lt === undefined ? Infinity : round(p.lt),
  )
  const loOpen = p.gt !== undefined && round(p.gt) >= lo
  const hiOpen = p.lt !== undefined && round(p.lt) <= hi
  return lo === -Infinity && hi === Infinity
    ? undefined
    : (v: number) => (loOpen ? v > lo : v >= lo) && (hiOpen ? v < hi : v <= hi)
}

function equalsOf(p: FieldPredicate) {
  const listed = [
    ...(p.equal === undefined ? [] : [p.equal]),
    ...(p.oneOf ?? []),
  ]
  return p.equal === undefined && p.oneOf === undefined ? undefined : listed
}

// A value as a number, `numericValue` with the two common types inline:
// a record's number reads as itself and its text converts, blank text
// being no number
function numberOf(raw: unknown) {
  if (typeof raw === 'number') {
    return raw
  }
  if (typeof raw === 'string') {
    const n = +raw
    return n === 0 && raw.trim() === '' ? Number.NaN : n
  }
  return numericValue(raw)
}

// `isMissing`, with the two common types inline
function missingOf(raw: unknown) {
  return typeof raw === 'string'
    ? raw === ''
    : typeof raw === 'number'
      ? false
      : isMissing(raw)
}

function asBoolean(raw: unknown) {
  return raw === true || raw === 'true'
    ? true
    : raw === false || raw === 'false'
      ? false
      : undefined
}

// What an `equal` or `oneOf` list admits, each member in its own type: a
// number against the value's number, text against its text, and a boolean
// against a boolean or its text, so `oneOf: [1, 'NA']` admits 1 and 'NA' and
// nothing else. A list of one type tests that type alone.
function membersTest(
  listed: readonly (string | number | boolean)[],
): (raw: unknown) => boolean {
  const numbers = new Set<number>()
  const texts = new Set<string>()
  const booleans = new Set<boolean | undefined>()
  for (const v of listed) {
    if (typeof v === 'number') {
      numbers.add(v)
    } else if (typeof v === 'boolean') {
      booleans.add(v)
    } else {
      texts.add(v)
    }
  }
  const byNumber = (raw: unknown) => numbers.has(numberOf(raw))
  const byText = (raw: unknown) =>
    texts.has(typeof raw === 'string' ? raw : valueText(raw))
  const byBoolean = (raw: unknown) => booleans.has(asBoolean(raw))
  const kinds = [
    ...(numbers.size > 0 ? [byNumber] : []),
    ...(texts.size > 0 ? [byText] : []),
    ...(booleans.size > 0 ? [byBoolean] : []),
  ]
  return kinds.length === 1
    ? kinds[0]!
    : raw => kinds.some(admits => admits(raw))
}

// The whole test on one value read off a record, the reference every lane
// kind agrees with
function valueTest(p: FieldPredicate): (raw: unknown) => boolean {
  const listed = equalsOf(p)
  const inBounds = boundsOf(p, n => n)
  const members = listed && membersTest(listed)
  const { valid } = p
  if (!inBounds && members && valid === undefined) {
    // a missing value reads as NaN, which no number member holds
    return listed.every(v => typeof v === 'number')
      ? members
      : raw => !missingOf(raw) && members(raw)
  }
  if (!inBounds && !members && valid !== undefined) {
    return raw => missingOf(raw) !== valid
  }
  return raw => {
    const missing = missingOf(raw)
    if (valid !== undefined && missing === valid) {
      return false
    }
    if (missing) {
      return valid === false && !inBounds && !members
    }
    return (!inBounds || inBounds(numberOf(raw))) && (!members || members(raw))
  }
}

function numberTest(p: FieldPredicate, values: ArrayLike<number>): Test {
  const round = values instanceof Float32Array ? Math.fround : (n: number) => n
  const inBounds = boundsOf(p, round)
  const listed = equalsOf(p)
  const members =
    listed &&
    new Set(
      listed
        .map(numberOf)
        // eslint-disable-next-line no-self-compare -- text is no number
        .filter(n => n === n)
        .map(round),
    )
  const { valid } = p
  return index => {
    const v = values[index]!
    // eslint-disable-next-line no-self-compare -- NaN is the missing value
    const missing = v !== v
    if (valid !== undefined && missing === valid) {
      return false
    }
    if (missing) {
      return valid === false && !inBounds && !members
    }
    return (!inBounds || inBounds(v)) && (!members || members.has(v))
  }
}

function labelsTest(
  p: FieldPredicate,
  ids: ArrayLike<number>,
  labels: readonly string[],
): Test {
  // every per-record test becomes one lookup: which labels pass, decided once
  const test = valueTest(p)
  const passes = labels.map(test)
  const absent = test(undefined)
  const count = labels.length
  return index => {
    const id = ids[index]!
    return id >= 0 && id < count ? passes[id]! : absent
  }
}

function getTest<T>(p: FieldPredicate, get: (item: T) => unknown): Test<T> {
  const inBounds = boundsOf(p, n => n)
  // the common case, a bound on a number field, reads a number straight
  // into the bounds
  if (inBounds && p.equal === undefined && !p.oneOf && p.valid === undefined) {
    const { gte } = p
    if (
      gte !== undefined &&
      p.gt === undefined &&
      p.lt === undefined &&
      p.lte === undefined
    ) {
      return index => {
        const raw = get(index)
        return numberOf(raw) >= gte
      }
    }
    return index => {
      const raw = get(index)
      return inBounds(numberOf(raw))
    }
  }
  const test = valueTest(p)
  return index => test(get(index))
}

// The value a bit lane holds for a predicate that is not a plain `equal`
function bitGet<T>(word: (item: T) => number, mask: number) {
  return (item: T) => (word(item) & mask) !== 0
}

// A predicate on a bit lane that only asks for the bit set or clear, the
// shape the fused mask compare takes
function bitWanted(p: FieldPredicate) {
  const listed = equalsOf(p)
  return listed?.length === 1 &&
    typeof listed[0] === 'boolean' &&
    p.gt === undefined &&
    p.gte === undefined &&
    p.lt === undefined &&
    p.lte === undefined &&
    p.valid === undefined
    ? listed[0]
    : undefined
}

// Every bit test on one word reader as one compare: the bits that must be
// set, and the bits that must be clear
function fusedBits<T>(
  word: (item: T) => number,
  mustSet: number,
  mustClear: number,
): Test<T> {
  return item => {
    const w = word(item)
    return (w & mustSet) === mustSet && (w & mustClear) === 0
  }
}

function allOf<T>(tests: Test<T>[]): Test<T> {
  const [a, b, c, d] = tests as [Test<T>, Test<T>, Test<T>, Test<T>]
  switch (tests.length) {
    case 1:
      return a
    case 2:
      return item => a(item) && b(item)
    case 3:
      return item => a(item) && b(item) && c(item)
    case 4:
      return item => a(item) && b(item) && c(item) && d(item)
  }
  return item => {
    for (const t of tests) {
      if (!t(item)) {
        return false
      }
    }
    return true
  }
}

function compileOne<T>(
  p: FieldPredicate,
  lane: PredicateLane<T> | undefined,
): Test<T> {
  if (!lane) {
    // a field no record carries: every value is missing
    return valueTest(p)(undefined) ? () => true : NEVER
  }
  // a typed lane is read by index, so its item is the record index
  return lane.kind === 'number'
    ? (numberTest(p, lane.values) as Test<unknown>)
    : lane.kind === 'labels'
      ? (labelsTest(p, lane.ids, lane.labels) as Test<unknown>)
      : lane.kind === 'bits'
        ? getTest(p, bitGet(lane.word, lane.mask))
        : getTest(p, lane.get)
}

/**
 * The records a predicate list admits, as a test by record index, or
 * undefined when the list tests nothing, so a caller skips the loop. A
 * predicate naming no test admits every record.
 */
export function compilePredicates<T = number>(
  predicates: readonly FieldPredicate[],
  laneOf: (field: string) => PredicateLane<T> | undefined,
): Test<T> | undefined {
  const words = new Map<
    (item: T) => number,
    { mustSet: number; mustClear: number }
  >()
  const tests: Test<T>[] = []
  for (const p of predicates) {
    if (!testsSomething(p)) {
      continue
    }
    const lane = laneOf(p.field)
    const wanted = lane?.kind === 'bits' ? bitWanted(p) : undefined
    if (lane?.kind === 'bits' && wanted !== undefined) {
      const masks = words.get(lane.word) ?? { mustSet: 0, mustClear: 0 }
      if (wanted) {
        masks.mustSet |= lane.mask
      } else {
        masks.mustClear |= lane.mask
      }
      words.set(lane.word, masks)
    } else {
      tests.push(compileOne(p, lane))
    }
  }
  // the fused flag compares go first: they are the cheapest and, on reads,
  // the ones that drop the most
  const fused = [...words].map(([word, { mustSet, mustClear }]) =>
    fusedBits(word, mustSet, mustClear),
  )
  const all = [...fused, ...tests]
  return all.length === 0 ? undefined : allOf(all)
}

/**
 * The fields `predicates` test that `holdsValue` says no record carries: a
 * typo, or a column the track's records lack. Each one hides every record, so
 * a display asks only once a filter has emptied a region that held records.
 * An entry selecting missing values, or testing nothing, is never unread.
 */
export function unreadFields(
  predicates: readonly FieldPredicate[],
  holdsValue: (field: string) => boolean,
) {
  return [
    ...new Set(
      predicates
        .filter(p => testsSomething(p) && p.valid !== false)
        .map(p => p.field),
    ),
  ].filter(field => !holdsValue(field))
}

/**
 * `unreadFields` over records read as a filter reads them, `get(field)`, where
 * a `jexl:` field and one `computed` names (a field the display derives) always
 * hold a value. Undefined with nothing fetched, and empty without a scan where
 * the filter kept a record.
 */
export function unreadRecordFields(
  predicates: readonly FieldPredicate[],
  fetched: readonly { get: (field: string) => unknown }[],
  kept: number,
  computed: (field: string) => boolean = () => false,
) {
  return fetched.length === 0
    ? undefined
    : kept > 0
      ? []
      : unreadFields(
          predicates,
          field =>
            isJexl(field) ||
            computed(field) ||
            fetched.some(record => !isMissing(record.get(field))),
        )
}

/**
 * The fields every region that fetched records found unread: each region's
 * `unreadFields`, empty where its filter admitted a record, undefined where it
 * fetched none. A field one region holds is that region's data, not a typo.
 */
export function unreadInEveryRegion(
  lists: readonly (readonly string[] | undefined)[],
) {
  const fetched = lists.filter(list => list !== undefined)
  return (fetched[0] ?? []).filter(field =>
    fetched.every(list => list.includes(field)),
  )
}

/** The notice a display gives for a filter field none of its records carry. */
export function unreadFieldNotice(field: string, record: string) {
  return `The filter tests "${field}", which no loaded ${record} carries, so it hides every ${record}. Check the field name, or remove the entry.`
}

/**
 * The tightest lower bound the predicates put on `field`, or undefined: what
 * a display with a dedicated cut for one field (the synteny view's length
 * uniform) reads, beside the full test.
 */
export function lowerBoundOf(
  predicates: readonly FieldPredicate[],
  field: string,
) {
  let bound: number | undefined
  for (const p of predicates) {
    if (p.field === field) {
      for (const b of [p.gte, p.gt]) {
        if (b !== undefined && (bound === undefined || b > bound)) {
          bound = b
        }
      }
    }
  }
  return bound
}

/**
 * A floor on one number: a value passes at `min` itself unless `strict`.
 */
export interface Floor {
  min: number
  strict: boolean
}

/**
 * The tightest floor the predicates put on `field`, `gt` beating a `gte` of
 * the same bound, or undefined where none names one.
 */
export function floorOf(
  predicates: readonly FieldPredicate[],
  field: string,
): Floor | undefined {
  let floor: Floor | undefined
  for (const p of predicates) {
    if (p.field === field) {
      for (const [min, strict] of [
        [p.gte, false],
        [p.gt, true],
      ] as const) {
        if (
          min !== undefined &&
          (floor === undefined ||
            min > floor.min ||
            (min === floor.min && strict))
        ) {
          floor = { min, strict }
        }
      }
    }
  }
  return floor
}

/** Whether `value` clears `floor`. */
export function passesFloor(value: number, { min, strict }: Floor) {
  return strict ? value > min : value >= min
}

/**
 * The predicate list with `field`'s lower bound set to `gte`, or removed with
 * undefined; a predicate left testing nothing drops out. What a slider on one
 * field writes.
 */
export function withLowerBound(
  predicates: readonly FieldPredicate[],
  field: string,
  gte: number | undefined,
): FieldPredicate[] {
  let placed = gte === undefined
  const next = predicates.flatMap(p => {
    if (p.field !== field) {
      return [p]
    }
    const { gt: _gt, gte: _gte, ...rest } = p
    const updated: FieldPredicate =
      placed || gte === undefined ? rest : { ...rest, gte }
    placed = true
    return testsSomething(updated) ? [updated] : []
  })
  return placed ? next : [...next, { field, gte }]
}

/**
 * The tightest upper bound the predicates put on `field`, or undefined: the
 * ceiling a slider on one field reads, as `lowerBoundOf` reads the floor.
 */
export function upperBoundOf(
  predicates: readonly FieldPredicate[],
  field: string,
) {
  let bound: number | undefined
  for (const p of predicates) {
    if (p.field === field) {
      for (const b of [p.lte, p.lt]) {
        if (b !== undefined && (bound === undefined || b < bound)) {
          bound = b
        }
      }
    }
  }
  return bound
}

/**
 * The predicate list with `field`'s upper bound set to `lte`, or removed with
 * undefined; the ceiling a slider on one field writes.
 */
export function withUpperBound(
  predicates: readonly FieldPredicate[],
  field: string,
  lte: number | undefined,
): FieldPredicate[] {
  let placed = lte === undefined
  const next = predicates.flatMap(p => {
    if (p.field !== field) {
      return [p]
    }
    const { lt: _lt, lte: _lte, ...rest } = p
    const updated: FieldPredicate =
      placed || lte === undefined ? rest : { ...rest, lte }
    placed = true
    return testsSomething(updated) ? [updated] : []
  })
  return placed ? next : [...next, { field, lte }]
}

/**
 * A `filter` list's entries off a list node or a snapshot, never through
 * `readConfObject`, which would evaluate a `jexl:` field. A bare string entry
 * no schema has lifted yet is the expression that must hold,
 * `{ field, equal: true }`.
 */
export function predicatesOf(list: unknown): FieldPredicate[] {
  const entries = isStateTreeNode(list) ? getSnapshot(list) : list
  return Array.isArray(entries)
    ? entries.map(entry =>
        typeof entry === 'string'
          ? { field: entry, equal: true }
          : (entry as FieldPredicate),
      )
    : []
}

/**
 * Whether a predicate is a `jexl:` expression that must hold, as a bare string
 * entry writes one.
 */
export function isExpressionEntry(p: FieldPredicate) {
  return (
    p.field.startsWith('jexl:') &&
    p.equal === true &&
    p.lt === undefined &&
    p.lte === undefined &&
    p.gt === undefined &&
    p.gte === undefined &&
    p.oneOf === undefined &&
    p.valid === undefined
  )
}

/**
 * The list with `field`'s entries replaced by `entries`, in the place the
 * field's first entry held, or after the rest; every other entry kept.
 */
export function replaceField(
  predicates: readonly FieldPredicate[],
  field: string,
  entries: readonly FieldPredicate[],
): FieldPredicate[] {
  const at = predicates.findIndex(p => p.field === field)
  const rest = predicates.filter(p => p.field !== field)
  return at === -1
    ? [...rest, ...entries]
    : [...rest.slice(0, at), ...entries, ...rest.slice(at)]
}

/** The entries on `field`, in list order. */
export function entriesOn(
  predicates: readonly FieldPredicate[],
  field: string,
): FieldPredicate[] {
  return predicates.filter(p => p.field === field)
}

function sameEntries(
  a: readonly FieldPredicate[],
  b: readonly FieldPredicate[],
) {
  return (
    a.length === b.length &&
    a.every((p, i) => JSON.stringify(p) === JSON.stringify(b[i]))
  )
}

/**
 * The written list with `field`'s entries replaced, by field over the slot's
 * `defaults` (ADR-240): `undefined` returns the field to its defaults, and an
 * empty list clears it, which over a field with defaults writes the bare
 * `{ field }` that removes them. Entries equal to the defaults are left
 * unwritten. Every other field keeps what was written.
 */
export function withField(
  written: readonly FieldPredicate[],
  field: string,
  entries: readonly FieldPredicate[] | undefined,
  defaults: readonly FieldPredicate[] = [],
): FieldPredicate[] {
  const fieldDefaults = entriesOn(defaults, field)
  return replaceField(
    written,
    field,
    entries === undefined || sameEntries(entries, fieldDefaults)
      ? []
      : entries.length === 0
        ? fieldDefaults.length > 0
          ? [{ field }]
          : []
        : entries,
  )
}

/** Entries by field, `undefined` returning a field to its defaults. */
export type FieldsPatch = Readonly<
  Record<string, readonly FieldPredicate[] | undefined>
>

/** `withField` over several fields at once. */
export function withFields(
  written: readonly FieldPredicate[],
  patch: FieldsPatch,
  defaults: readonly FieldPredicate[] = [],
): FieldPredicate[] {
  let next = [...written]
  for (const [field, entries] of Object.entries(patch)) {
    next = withField(next, field, entries, defaults)
  }
  return next
}
