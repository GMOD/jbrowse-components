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
 * Growable string interner. One per lane — sharing one across lanes only makes
 * the ids less local without shrinking anything, since a dictionary is bounded
 * by its lane's cardinality either way.
 */
export function makeStringDict(): StringDict {
  const ids = new Map<string, number>()
  const dict: string[] = []
  // The last value this lane saw, which is very often the next one too: a
  // feature's assembly lane is one value for the whole fetch, and its refName
  // lane changes only where the sort crosses a contig. Hitting this skips the
  // string hash a `Map.get` costs — the workers call `idFor` five times per
  // feature, which made it 7.8% of a whole-genome synteny fetch's profile.
  //
  // A `''` seed is not a false hit: `''` is a real value in these lanes (an
  // unnamed feature) and `lastId` is only consulted after the first `idFor`
  // has set it.
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
