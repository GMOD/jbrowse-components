import type { AssemblyManager } from '@jbrowse/core/util'

/**
 * Resolve a name spelled the way a comparative adapter's file spells it into
 * the assembly's canonical name — the return direction of the rename
 * `renameRegionsForAdapter` applies going out.
 *
 * `agent-docs/reference/REFNAME_NAMESPACES.md` is the rule for when this is
 * needed: an RPC answer that names a location the caller did not request
 * arrives in the file's spelling, and every main-thread thing it meets is
 * canonical.
 *
 * NOT `getAdapterToCanonicalRefNameMap`, which is the same direction as a
 * serializable map. That one is for a WORKER, which has no assemblyManager and
 * so has to be handed the answers; against a live assembly, reading the alias
 * table is both simpler and one fewer thing to get wrong:
 *
 * - **No adapter round-trip.** The map needs `getRefNames` off the adapter (an
 *   RPC, memoized after the first) purely to learn which of the assembly's names
 *   the file uses, which is a question this direction does not have to ask.
 * - **Total.** The map is the inverse of `loadRefNameMap`'s
 *   `result[canonical(fileName)] = fileName`, keyed by canonical name, so it
 *   keeps ONE file spelling per contig — a file naming one contig both `chr1`
 *   and `1` loses whichever `getRefNames` reported first, and the name it
 *   dropped comes back adapter-space with nothing to say so. (Such a file is
 *   half-broken going the other way too, for the same reason: the region the
 *   worker is asked for is renamed to the surviving spelling and the rows under
 *   the other one are never fetched. So this is an asymmetry removed rather
 *   than a bug fixed — the fix for that one belongs in core.)
 * - **Assembly names, not regions.** A caller resolving after an await would
 *   otherwise be reading `displayedRegions` — MST nodes its own fetch can
 *   outlive, where a read throws.
 *
 * The one thing it is not: NARROWER. The map only ever renames names the
 * adapter reported, and this renames any name the assembly has an alias for. On
 * a file naming a contig something that is an alias of a DIFFERENT contig of
 * this assembly, that is a wrong rename where the map had a silent miss. Both
 * are wrong on that input, it is pathological either way, and it is the same
 * input `renameRegionsForAdapter` already mis-maps going out.
 *
 * Identity for an unnamed assembly and for any name the assembly does not know,
 * so it never invents a rename.
 */
export async function getCanonicalRefNameFn({
  assemblyManager,
  assemblyName,
}: {
  assemblyManager: AssemblyManager
  assemblyName: string | undefined
}): Promise<(refName: string) => string> {
  if (!assemblyName) {
    return refName => refName
  }
  // require, not wait: the caller named this assembly, so an unresolvable name
  // is a rename that cannot be done rather than one that is not needed. Silently
  // handing back identity leaves every out-of-request name adapter-space, which
  // reads as a window with nothing aligned under it.
  const assembly = await assemblyManager.requireAssembly(assemblyName)
  return refName => assembly.getCanonicalRefName2(refName)
}
