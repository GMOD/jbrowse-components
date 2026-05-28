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
