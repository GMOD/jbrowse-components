/**
 * Vega-Lite's field predicate (ADR-238): the `field` of each record and the
 * tests its value must pass, every one given. A comparison on a missing value
 * is false; `valid: false` selects the missing values.
 *
 * `compilePredicates` resolves each field once, before the loop, to a lane the
 * caller hands it, so the test it returns is a typed read and a compare per
 * record.
 *
 * Worked example: over a synteny payload whose `identity` lane is a
 * Float32Array, `[{ field: 'identity', gte: 0.9 }]` compiles to
 * `i => identity[i] >= Math.fround(0.9)`, NaN failing.
 */
export interface FieldPredicate {
  field: string
  equal?: string | number | boolean
  lt?: number
  lte?: number
  gt?: number
  gte?: number
  oneOf?: readonly (string | number | boolean)[]
  valid?: boolean
}

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

// A value read off an object is compared in the type of the constant it is
// tested against, so a GFF attribute "12" passes `gte: 10` and `equal: 12`.
function coerce(value: unknown, like: unknown) {
  return typeof like === 'number'
    ? Number(value)
    : typeof like === 'boolean'
      ? value === true || value === 'true'
      : String(value)
}

function numberTest(p: FieldPredicate, values: ArrayLike<number>): Test {
  const round = values instanceof Float32Array ? Math.fround : (n: number) => n
  const inBounds = boundsOf(p, round)
  const listed = equalsOf(p)
  const members = listed && new Set(listed.map(v => round(Number(v))))
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
  const inBounds = boundsOf(p, n => n)
  const listed = equalsOf(p)
  const members = listed && new Set(listed.map(String))
  const passes = labels.map(
    label =>
      (!inBounds || inBounds(Number(label))) &&
      (!members || members.has(label)),
  )
  const { valid } = p
  const count = labels.length
  return index => {
    const id = ids[index]!
    const missing = !(id >= 0 && id < count)
    if (valid !== undefined && missing === valid) {
      return false
    }
    return missing ? valid === false && !inBounds && !members : passes[id]!
  }
}

function getTest<T>(p: FieldPredicate, get: (item: T) => unknown): Test<T> {
  const listed = equalsOf(p)
  const like = listed?.[0] ?? p.gte ?? p.gt ?? p.lte ?? p.lt
  const inBounds = boundsOf(p, n => n)
  const members = listed && new Set(listed.map(v => coerce(v, like)))
  const { valid } = p
  // the common case, a bound on a number field, skips the coercion and the
  // set: a number reads straight into the bounds
  if (inBounds && !members && valid === undefined) {
    const { gte } = p
    if (
      gte !== undefined &&
      p.gt === undefined &&
      p.lt === undefined &&
      p.lte === undefined
    ) {
      return index => {
        const raw = get(index)
        return typeof raw === 'number'
          ? raw >= gte
          : raw !== undefined && raw !== null && Number(raw) >= gte
      }
    }
    return index => {
      const raw = get(index)
      return typeof raw === 'number'
        ? inBounds(raw)
        : raw !== undefined && raw !== null && inBounds(Number(raw))
    }
  }
  return index => {
    const raw = get(index)
    const missing = raw === undefined || raw === null
    if (valid !== undefined && missing === valid) {
      return false
    }
    if (missing) {
      return valid === false && !inBounds && !members
    }
    return (
      (!inBounds || inBounds(Number(raw))) &&
      (!members || members.has(coerce(raw, like)))
    )
  }
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
    return p.valid === false && p.equal === undefined && !p.oneOf
      ? boundsOf(p, n => n)
        ? NEVER
        : () => true
      : NEVER
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

/** Whether a predicate states any test, which an empty `{ field }` does not. */
export function testsSomething(p: FieldPredicate) {
  return (
    p.equal !== undefined ||
    p.lt !== undefined ||
    p.lte !== undefined ||
    p.gt !== undefined ||
    p.gte !== undefined ||
    p.oneOf !== undefined ||
    p.valid !== undefined
  )
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
