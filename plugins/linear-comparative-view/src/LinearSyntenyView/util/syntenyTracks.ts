import { readConfObject } from '@jbrowse/core/configuration'
import { getTrackName } from '@jbrowse/core/util/tracks'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * Synteny tracks in the session whose `assemblyNames` include every one of the
 * given assemblies. The shared primitive behind both the import form's
 * per-level track selector and the "add assembly row" dialog.
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

export interface AddRowOption {
  trackId: string
  name: string
  // assembly added as the new bottom row — the dataset's other endpoint
  newAssembly: string
}

/**
 * Options for the "add assembly row" dialog: each synteny dataset referencing
 * `terminalAssembly` becomes one option, whose new assembly is the dataset's
 * other endpoint. The dataset is the unit of extension, so picking it implies
 * the assembly to add.
 */
export function getAddRowOptions(
  session: {
    tracks: AnyConfigurationModel[]
    assemblies: AnyConfigurationModel[]
  },
  terminalAssembly: string,
): AddRowOption[] {
  return getSyntenyTracks(session.tracks, [terminalAssembly]).map(track => {
    const assemblyNames = readConfObject(track, 'assemblyNames') as string[]
    return {
      trackId: readConfObject(track, 'trackId') as string,
      name: getTrackName(track, session),
      newAssembly:
        assemblyNames.find(name => name !== terminalAssembly) ??
        terminalAssembly,
    }
  })
}
