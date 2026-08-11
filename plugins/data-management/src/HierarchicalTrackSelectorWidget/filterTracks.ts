import { readConfObject } from '@jbrowse/core/configuration'
import { getEnv, getSession } from '@jbrowse/core/util'
import {
  canonicalAssemblyNames,
  viewCanDisplayTrack,
  viewDisplayNames,
} from '@jbrowse/core/util/tracks'

import { containsAll } from './util.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * The tracks a view can be offered: those that support every assembly it
 * displays, and that declare a display it can draw.
 */
export function filterTracks(
  tracks: AnyConfigurationModel[],
  self: {
    view?: { type: string }
    assemblyNames: string[]
  },
) {
  const { assemblyManager } = getSession(self)
  const { pluginManager } = getEnv(self)
  const { view } = self
  if (!view) {
    return []
  }
  const canonical = (names: string[]) =>
    canonicalAssemblyNames(names, assemblyManager)
  const viewAssemblyNames = canonical(self.assemblyNames)
  const viewDisplays = viewDisplayNames(pluginManager, view.type)
  return tracks.filter(c => {
    const trackAssemblyNames = readConfObject(c, 'assemblyNames') as
      | string[]
      | undefined
    return (
      // a view that declares no assemblies (one still initializing) constrains
      // nothing; otherwise the track must cover every one of them
      (viewAssemblyNames.length === 0 ||
        containsAll(
          trackAssemblyNames && canonical(trackAssemblyNames),
          viewAssemblyNames,
        )) &&
      viewCanDisplayTrack(pluginManager, viewDisplays, c.type)
    )
  })
}
