import { readConfObject } from '@jbrowse/core/configuration'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * Synteny tracks in the session whose `assemblyNames` include every one of the
 * given assemblies. Shared by the linear-synteny and dotplot import forms (the
 * per-level/per-pair track selectors) and the "add assembly row" dialog.
 */
export function getSyntenyTracks(
  tracks: AnyConfigurationModel[],
  assemblies: string[],
) {
  return tracks.filter(track => {
    const assemblyNames = readConfObject(track, 'assemblyNames') as string[]
    return (
      track.type.includes('Synteny') &&
      assemblies.every(name => assemblyNames.includes(name))
    )
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
) {
  const names = new Set<string>()
  for (const track of getSyntenyTracks(tracks, [assembly])) {
    for (const name of readConfObject(track, 'assemblyNames') as string[]) {
      if (name !== assembly) {
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
