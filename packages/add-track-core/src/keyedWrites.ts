/**
 * A settings object whose members name the values of one of its members, as
 * `rows.sort` names the values of `rows.field`: the `keyed` members are stale
 * once `keyedBy` changes. Declared on a config schema as its `writes`.
 */
export interface KeyedWrites {
  keyedBy: string
  keyed: readonly string[]
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
 * toggle turns them.
 */
export function changesKeyedField(
  writes: KeyedWrites,
  prior: Record<string, unknown>,
  next: Record<string, unknown>,
) {
  const from = prior[writes.keyedBy]
  const to = next[writes.keyedBy]
  return (
    typeof to === 'string' &&
    typeof from === 'string' &&
    from !== '' &&
    to !== '' &&
    from !== to
  )
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
