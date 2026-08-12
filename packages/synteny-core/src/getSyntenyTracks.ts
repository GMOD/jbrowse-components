import { readConfObject } from '@jbrowse/core/configuration'
import { canonicalAssemblyNames } from '@jbrowse/core/util/tracks'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AssemblyNameResolver } from '@jbrowse/core/util/tracks'

/**
 * The assembly-manager slice the "can the session open this?" screens need.
 *
 * `has`, deliberately, and not `getCanonicalAssemblyName(name) !== undefined`:
 * that reads `assemblyNameMap`, which is built from assembly *models*, so it
 * answers no during the window where a config exists and the manager's
 * afterAttach autorun hasn't built its model yet — which is exactly when an
 * import form first renders. `has` also consults `assemblyNamesList`, read off
 * the configs, so it covers both. See assemblyManager's own note on the pair.
 */
export interface SessionAssemblies extends AssemblyNameResolver {
  has: (assemblyName: string) => boolean
}

function countByName(names: string[]) {
  const counts = new Map<string, number>()
  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return counts
}

/**
 * Whether two assembly lists name the same assemblies with the same
 * multiplicity, ignoring order (a synteny track answers in either direction).
 * Used to tell whether an uploaded track's baked `assemblyNames` still match
 * the row pair it is attached to — position-indexed selections go stale when a
 * row is removed or an assembly is changed under them.
 */
export function sameAssemblySet(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false
  }
  const counts = countByName(a)
  return [...countByName(b)].every(
    ([name, count]) => counts.get(name) === count,
  )
}

/**
 * Cheap type test, no config read. Gates the `readConfObject` in every scan
 * below: resolving `assemblyNames` on every track in the session is wasted work
 * for the non-synteny majority.
 */
export function isSyntenyTrack(track: AnyConfigurationModel) {
  return track.type.includes('Synteny')
}

/**
 * Synteny tracks in the session whose `assemblyNames` cover every one of the
 * given assemblies, counting multiplicity: a duplicated request like `[a, a]`
 * (a self-alignment row pair) only matches a track that references `a` twice,
 * not an arbitrary `a`↔`b` cross-species track that happens to include `a`.
 * Shared by the linear-synteny and dotplot import forms (the per-level/per-pair
 * track selectors) and the "add assembly row" dialog.
 *
 * Both sides resolve through the assembly manager's aliases, as the track
 * selector's own filter does: the rows name assemblies canonically (they come
 * from a dropdown of the session's) while a track config is free to name an
 * alias, and comparing the two raw leaves a perfectly good synteny track
 * invisible to the import form that exists to find it.
 */
export function getSyntenyTracks(
  tracks: AnyConfigurationModel[],
  assemblies: string[],
  assemblyManager: AssemblyNameResolver,
) {
  const needed = [
    ...countByName(canonicalAssemblyNames(assemblies, assemblyManager)),
  ]
  return tracks.filter(track => {
    if (!isSyntenyTrack(track)) {
      return false
    }
    const available = countByName(
      canonicalAssemblyNames(
        readConfObject(track, 'assemblyNames') as string[],
        assemblyManager,
      ),
    )
    return needed.every(([name, count]) => (available.get(name) ?? 0) >= count)
  })
}

/**
 * Assemblies reachable from `assembly` by a single synteny dataset — the other
 * endpoint of every synteny track that references it. Used to default a newly
 * added synteny row to an assembly that is actually connected to the row above,
 * so the new pair is launchable instead of immediately flagged as unconfigured.
 */
export function getConnectedAssemblies(
  tracks: AnyConfigurationModel[],
  assembly: string,
  assemblyManager: SessionAssemblies,
) {
  // canonical throughout: the caller feeds these back into an assembly dropdown
  // whose options are the session's own names, so an alias read off a track
  // config would be an option that matches nothing
  const [canonicalAssembly] = canonicalAssemblyNames(
    [assembly],
    assemblyManager,
  )
  const names = new Set<string>()
  for (const track of getSyntenyTracks(tracks, [assembly], assemblyManager)) {
    for (const name of canonicalAssemblyNames(
      readConfObject(track, 'assemblyNames') as string[],
      assemblyManager,
    )) {
      // Only assemblies the session can actually open. A track config is free
      // to name one the session has no configuration for — a hub whose
      // assemblies were never loaded, a config one was removed from — and the
      // caller feeds this into a row that becomes an AssemblySelector value.
      // A value that is not one of the Select's options renders as an empty
      // field, so "Add row" produced an unnamed row rather than the connected
      // default it exists to give. See SessionAssemblies for why this is `has`.
      if (name !== canonicalAssembly && assemblyManager.has(name)) {
        names.add(name)
      }
    }
  }
  return [...names]
}

/**
 * The preferred track id if it is still one of the given synteny tracks,
 * otherwise the first available. Keeps a stale or empty preference from
 * resolving to a track that doesn't belong to the pair.
 */
export function pickSyntenyTrackId(
  preferredTrackId: string,
  syntenyTracks: AnyConfigurationModel[],
) {
  return syntenyTracks.some(track => track.trackId === preferredTrackId)
    ? preferredTrackId
    : syntenyTracks[0]?.trackId
}
