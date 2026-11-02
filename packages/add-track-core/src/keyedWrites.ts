/**
 * A settings object whose members name the values of one of its members, as
 * `rows.sort` names the values of `rows.field`: the `keyed` members are stale
 * once `keyedBy` changes. Declared on a config schema as its `writes`.
 */
export interface KeyedWrites {
  keyedBy: string
  keyed: readonly string[]
  /**
   * Whether emptying `keyedBy`, or filling it, changes it too. By default an
   * empty value names no values and changes nothing, so `rows.field` keeps
   * its arrangement across wiggle's overlay toggle; a provenance describes
   * the one newick beside it, so `rows.tree` declares this.
   */
  emptyChanges?: boolean
  /**
   * The values of `keyedBy` that refine another, finer to coarser, as
   * `{ haplotype: 'sample' }`: a finer row names the coarser row it refines,
   * so the keyed members carry across a write between the two, in either
   * direction, and a read interprets them at the field in force.
   */
  refines?: Readonly<Record<string, string>>
}

export function isKeyedWrites(writes: unknown): writes is KeyedWrites {
  return (
    typeof writes === 'object' &&
    writes !== null &&
    'keyedBy' in writes &&
    'keyed' in writes
  )
}

/**
 * Whether writing `next` over `prior` changes the field the keyed members
 * name. An empty field names no values, so a write from one or to one changes
 * nothing: the arrangement waits while rows are off, as wiggle's overlay
 * toggle turns them, and a write between a value and the one it refines
 * (`refines`) changes nothing either. Under `emptyChanges` any write `next`
 * states of another value changes it, empty (`''`, `null`, unset) included.
 */
export function changesKeyedField(
  writes: KeyedWrites,
  prior: Record<string, unknown>,
  next: Record<string, unknown>,
) {
  const from = prior[writes.keyedBy]
  const to = next[writes.keyedBy]
  return writes.emptyChanges
    ? Object.hasOwn(next, writes.keyedBy) && emptied(from) !== emptied(to)
    : typeof to === 'string' &&
        typeof from === 'string' &&
        from !== '' &&
        to !== '' &&
        from !== to &&
        !refinesEither(writes, from, to)
}

function refinesEither(writes: KeyedWrites, a: string, b: string) {
  const refines = writes.refines ?? {}
  return (
    (Object.hasOwn(refines, a) && refines[a] === b) ||
    (Object.hasOwn(refines, b) && refines[b] === a)
  )
}

/**
 * Why `writes.refines` cannot stand over a `keyedBy` whose values are
 * `values` (all of them, or undefined for a field of any value): a value it
 * names that the field lacks, a value refining itself, or a chain, a value
 * both refining and refined. Undefined where it stands.
 */
export function refinesProblem(
  writes: KeyedWrites,
  values: readonly string[] | undefined,
) {
  const pairs = Object.entries(writes.refines ?? {})
  const coarser = new Set(pairs.map(([, to]) => to))
  const unknown = values
    ? pairs.flat().filter(value => !values.includes(value))
    : []
  const self = pairs.find(([from, to]) => from === to)
  const chained = pairs.find(([from]) => coarser.has(from))
  return unknown.length > 0
    ? `names ${[...new Set(unknown)].join(', ')}, which ${writes.keyedBy} cannot be`
    : self
      ? `has ${self[0]} refine itself`
      : chained
        ? `chains ${chained[0]}, which both refines ${chained[1]} and is refined`
        : undefined
}

// `''`, `null` and unset as the one empty value
function emptied(value: unknown) {
  return value === undefined || value === null ? '' : value
}

/**
 * The keyed members a write of `next` over `prior` unsets: those naming the
 * old field's values that `next` does not itself state.
 */
export function staleKeyedMembers(
  writes: KeyedWrites,
  prior: Record<string, unknown>,
  next: Record<string, unknown>,
) {
  return changesKeyedField(writes, prior, next)
    ? writes.keyed.filter(member => !Object.hasOwn(next, member))
    : []
}

/**
 * `prior` as a write of `next` leaves it before its members merge in: the
 * keyed members gone when the write changes the field.
 */
export function keyedBase<V>(
  writes: KeyedWrites,
  prior: Record<string, V>,
  next: Record<string, unknown>,
): Record<string, V> {
  const stale = new Set(staleKeyedMembers(writes, prior, next))
  return stale.size > 0
    ? Object.fromEntries(
        Object.entries(prior).filter(([member]) => !stale.has(member)),
      )
    : prior
}
