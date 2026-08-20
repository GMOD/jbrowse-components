import { makeStringDict } from './stringDict.ts'

/**
 * Rewrite one dictionary-encoded refName lane out of a comparative adapter's
 * namespace and into the assembly's canonical one.
 *
 * A comparative RPC answers about the OTHER axis as well as the one it was
 * asked for, so the refNames it hands back are new information rather than an
 * echo of the request — and they arrive in the file's spelling while everything
 * on the main thread they meet (`dynamicBlocks`, `displayedRegions`,
 * `assembly.refNames`) is canonical. `agent-docs/reference/REFNAME_NAMESPACES.md`
 * is the rule; `getCanonicalRefNameFn` is the resolver, one per axis.
 *
 * RE-INTERNS, and that is the whole reason this is not a `.map()` in place. The
 * dictionary's entries are distinct while they are adapter-space, because the
 * worker interned them there; the rename can collapse two of them onto one
 * canonical name, and it takes only one aliased spelling to do it — a file
 * naming one contig `chr1` on some rows and `1` on others, against an assembly
 * canonicalizing `1`, arrives as two entries and leaves as one. Duplicates break
 * every reader that resolves a name to an id ONCE and then compares integers —
 * `pickFollowFeature` and `followWindowMapping` both do, via `dict.indexOf` —
 * since `indexOf` finds the first duplicate and every feature carrying the
 * second silently stops matching.
 *
 * `ids` comes back untouched in the ordinary case: the interner hands out ids in
 * first-seen order, so they are unchanged unless a collapse actually happened,
 * and the per-feature pass is paid only by the file that needs it.
 *
 * `remap` is the old id -> new id map the collapse is applied through, handed
 * back for the lanes this function cannot see. A payload can carry more than one
 * array keyed by the dictionary's ids — `OffscreenMateData` has a per-contig
 * `counts` beside its per-feature `mateRefNameIds` — and a collapse has to SUM
 * those rather than reindex them, which is why they cannot just be passed in as
 * a second `ids`.
 */
export function renameDictLane({
  dict,
  ids,
  canonical,
}: {
  dict: string[]
  ids: Uint32Array
  canonical: (refName: string) => string
}): { dict: string[]; ids: Uint32Array; remap: number[] } {
  const interned = makeStringDict()
  const remap = dict.map(name => interned.idFor(canonical(name)))
  if (interned.dict.length === dict.length) {
    return { dict: interned.dict, ids, remap }
  }
  const renamed = new Uint32Array(ids.length)
  for (let i = 0; i < ids.length; i++) {
    renamed[i] = remap[ids[i]!]!
  }
  return { dict: interned.dict, ids: renamed, remap }
}
