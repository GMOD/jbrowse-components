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
  /**
   * What `keyedBy` holds where nothing writes it: the schema's declared
   * default where that names values, as the multi-row display's `rows.field`
   * is `type`. The schema fills it in from the slot, never stated beside it,
   * so every reader of the declaration, the CLI's manifest included, compares
   * and reads the field in force.
   */
  unwritten?: string
}

export function isKeyedWrites(writes: unknown): writes is KeyedWrites {
  return (
    typeof writes === 'object' &&
    writes !== null &&
    'keyedBy' in writes &&
    'keyed' in writes
  )
}

const isMembers = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// The field a config's members draw: as written, else the declaration's
// `unwritten`, `null` resetting to it
function fieldInForce(writes: KeyedWrites, members: Record<string, unknown>) {
  return members[writes.keyedBy] ?? writes.unwritten
}

/**
 * A keyed object's snapshot, or nothing written, as drawn: its field in
 * force where the declaration has an `unwritten` and the snapshot states no
 * field. Any other value is returned as given.
 */
export function keyedInForce(writes: KeyedWrites, value: unknown) {
  const members = value ?? {}
  return writes.unwritten !== undefined &&
    isMembers(members) &&
    members[writes.keyedBy] == null
    ? { ...members, [writes.keyedBy]: writes.unwritten }
    : value
}

/**
 * Whether writing `next` over `prior` changes the field the keyed members
 * name, each read in force (`unwritten` where one writes none, or `null`
 * resetting it). An empty field names no values, so a write from one or to
 * one changes nothing: the arrangement waits while rows are off, as wiggle's
 * overlay toggle turns them, and a write between a value and the one it
 * refines (`refines`) changes nothing either. Under `emptyChanges` any write
 * `next` states of another value changes it, empty (`''`, `null`, unset)
 * included.
 */
export function changesKeyedField(
  writes: KeyedWrites,
  prior: Record<string, unknown>,
  next: Record<string, unknown>,
) {
  const from = fieldInForce(writes, prior)
  const to = Object.hasOwn(next, writes.keyedBy)
    ? fieldInForce(writes, next)
    : undefined
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
 * `prior` as a write of `next` leaves it before its members merge in: every
 * keyed member gone when the write changes the field, the ones `next` states
 * included, so a stated member lands over nothing rather than merging into
 * the old field's value (a `tree: { provenance }` keeps no old newick).
 */
export function keyedBase<V>(
  writes: KeyedWrites,
  prior: Record<string, V>,
  next: Record<string, unknown>,
): Record<string, V> {
  return changesKeyedField(writes, prior, next)
    ? Object.fromEntries(
        Object.entries(prior).filter(
          ([member]) => !writes.keyed.includes(member),
        ),
      )
    : prior
}
