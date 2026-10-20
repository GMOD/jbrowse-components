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
  oneOf?: readonly (string | number)[]
  valid?: boolean
}

/**
 * Where a field's values live, as the caller resolves it:
 * - `number`: one number per record, NaN for a missing value
 * - `labels`: one index per record into `labels`, out of range for a missing
 *   value (a dictionary-coded string lane)
 * - `get`: a reader over record objects, `undefined` or `null` for a missing
 *   value
 */
export type PredicateLane =
  | { kind: 'number'; values: ArrayLike<number> }
  | { kind: 'labels'; ids: ArrayLike<number>; labels: readonly string[] }
  | { kind: 'get'; get: (index: number) => unknown }

type Test = (index: number) => boolean

const NEVER: Test = () => false

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

function getTest(p: FieldPredicate, get: (index: number) => unknown): Test {
  const listed = equalsOf(p)
  const like = listed?.[0] ?? p.gte ?? p.gt ?? p.lte ?? p.lt
  const inBounds = boundsOf(p, n => n)
  const members = listed && new Set(listed.map(v => coerce(v, like)))
  const { valid } = p
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

function compileOne(p: FieldPredicate, lane: PredicateLane | undefined): Test {
  if (!lane) {
    // a field no record carries: every value is missing
    return p.valid === false && p.equal === undefined && !p.oneOf
      ? boundsOf(p, n => n)
        ? NEVER
        : () => true
      : NEVER
  }
  return lane.kind === 'number'
    ? numberTest(p, lane.values)
    : lane.kind === 'labels'
      ? labelsTest(p, lane.ids, lane.labels)
      : getTest(p, lane.get)
}

/**
 * The records a predicate list admits, as a test by record index, or
 * undefined when the list tests nothing, so a caller skips the loop. A
 * predicate naming no test admits every record.
 */
export function compilePredicates(
  predicates: readonly FieldPredicate[],
  laneOf: (field: string) => PredicateLane | undefined,
): Test | undefined {
  const tests = predicates
    .filter(p => testsSomething(p))
    .map(p => compileOne(p, laneOf(p.field)))
  if (tests.length === 0) {
    return undefined
  }
  if (tests.length === 1) {
    return tests[0]
  }
  return index => tests.every(t => t(index))
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
