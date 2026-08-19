import { readConfObject } from '@jbrowse/core/configuration'
import { canonicalAssemblyNames } from '@jbrowse/core/util/tracks'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  AssemblyNameResolver,
  SessionAssemblies,
} from '@jbrowse/core/util/tracks'

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
 * Every synteny dataset that reaches `assembly`, paired with the assemblies it
 * reaches — its other endpoints. The single derivation behind both "extend the
 * stack from this row" pickers: the add-row dialog's options and
 * {@link getConnectedAssemblies}' names.
 *
 * Both feed their result into a row, so both need the same two things and
 * neither can skip either:
 *
 * - **canonical names**, because the row's assembly Select is populated from
 *   the session's own names and an alias read off a track config would be a
 *   value matching no option, which MUI renders as an empty field;
 * - **`assemblyManager.has`**, because a track config is free to name an
 *   assembly the session has no configuration for — a hub whose assemblies were
 *   never loaded, a config one was removed from — and such a row is not merely
 *   blank but a broken view: its init fails with "Assembly X not found", which
 *   sets the view's error, and `showImportForm` reads that error. See
 *   SessionAssemblies for why the screen is `has` rather than
 *   `getCanonicalAssemblyName(...) !== undefined`.
 *
 * A self-alignment's other endpoint is the anchor itself, reported as such: it
 * is live by construction (so it needs no screening), it makes the dataset an
 * offerable option, and it is distinguishable from a dataset whose only other
 * endpoint the screen just removed — which must not be offered at all.
 */
export function connectedEndpoints(
  tracks: AnyConfigurationModel[],
  assembly: string,
  assemblyManager: SessionAssemblies,
) {
  const [canonicalAssembly = assembly] = canonicalAssemblyNames(
    [assembly],
    assemblyManager,
  )
  return {
    canonicalAssembly,
    // An anchor with no name reaches nothing, and says so here rather than
    // through getSyntenyTracks, whose empty *request* deliberately matches
    // every synteny track: a row that has not loaded its regions yet names no
    // assembly, and the add-row dialog asking about it used to be answered with
    // the whole session's datasets.
    datasets: !canonicalAssembly
      ? []
      : getSyntenyTracks(tracks, [assembly], assemblyManager).map(track => {
          const others = canonicalAssemblyNames(
            readConfObject(track, 'assemblyNames') as string[],
            assemblyManager,
          ).filter(name => name !== canonicalAssembly)
          return {
            track,
            newAssemblies: others.length
              ? others.filter(name => assemblyManager.has(name))
              : [canonicalAssembly],
          }
        }),
  }
}

/**
 * Assemblies reachable from `assembly` by a single synteny dataset. Used to
 * default a newly added synteny row to an assembly that is actually connected
 * to the row above, so the new pair is launchable instead of immediately
 * flagged as unconfigured.
 */
export function getConnectedAssemblies(
  tracks: AnyConfigurationModel[],
  assembly: string,
  assemblyManager: SessionAssemblies,
) {
  const { canonicalAssembly, datasets } = connectedEndpoints(
    tracks,
    assembly,
    assemblyManager,
  )
  return [...new Set(datasets.flatMap(d => d.newAssemblies))].filter(
    // a self-alignment reports the anchor as its endpoint, and connects the
    // assembly to nothing new
    name => name !== canonicalAssembly,
  )
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
