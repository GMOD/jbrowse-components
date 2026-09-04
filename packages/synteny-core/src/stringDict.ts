/**
 * A per-feature string lane, dictionary-encoded: `ids[i]` indexes `dict`.
 *
 * Both comparative workers ship their per-feature strings this way, and the
 * reason is the RPC boundary rather than memory. A `string[]` is the only part of
 * either payload that isn't a zero-copy transfer — everything else is an
 * ArrayBuffer in the transfer list — and the clone cost is per ELEMENT, not per
 * distinct value: measured at 500k features, one lane costs ~44ms to
 * structured-clone whether its values are all distinct or all the same. Five
 * lanes is ~220ms per fetch, against ~0ms for five transferred Uint32Arrays plus
 * a dictionary of a few dozen strings.
 *
 * So it pays for any lane whose cardinality is bounded by something other than
 * the feature count — a scaffold count, an assembly count, a handful of gene
 * symbols, or nothing at all (a PAF names no features, so its name dictionary
 * holds one empty string). It does NOT pay for a lane of genuinely distinct
 * values per feature: `featureIds` stays a `string[]` because a dictionary of
 * 500k distinct strings costs the same clone plus an index array.
 */
export interface StringDict {
  dict: string[]
  idFor(value: string): number
}

/**
 * What a record with no name packs into its name lane. A `Feature`'s missing
 * name is `undefined`, but a dictionary lane holds strings — so the packers
 * write this sentinel, and everything downstream that asks "is this record
 * named" (the contig votes' evidence rule, a fixture harness) resolves it
 * through {@link unnamedNameId} rather than restating the convention.
 */
export const UNNAMED = ''

/** the name lane's id for {@link UNNAMED} — -1 where every record is named,
 * which is not a valid id and so matches no record */
export function unnamedNameId(nameDict: string[]) {
  return nameDict.indexOf(UNNAMED)
}

/**
 * Growable string interner. One per lane — sharing one across lanes only makes
 * the ids less local without shrinking anything, since a dictionary is bounded
 * by its lane's cardinality either way.
 */
export function makeStringDict(): StringDict {
  const ids = new Map<string, number>()
  const dict: string[] = []
  // The last value this lane saw, which skips the string hash a `Map.get`
  // costs when the next one is the same. The workers call `idFor` five times
  // per feature, and two of those lanes are the assembly on each axis — one
  // value for the whole fetch.
  //
  // The refName lanes do NOT hit it, and that is worth saying rather than
  // assuming otherwise: the features were sorted into draw order by on-screen
  // size just before this, so consecutive ribbons come from all over the
  // genome. Nor does a gene-level track's name lane, where every value is
  // distinct — see below.
  //
  // `lastValue` starts undefined rather than `''` because `''` is a real value
  // in these lanes (a feature with no name), and seeding it would answer that
  // value's first query with an id nothing had assigned.
  let lastValue: string | undefined
  let lastId = 0
  return {
    dict,
    idFor(value: string) {
      if (value === lastValue) {
        return lastId
      }
      let id = ids.get(value)
      if (id === undefined) {
        id = dict.length
        dict.push(value)
        ids.set(value, id)
      }
      lastValue = value
      lastId = id
      return id
    },
  }
}
