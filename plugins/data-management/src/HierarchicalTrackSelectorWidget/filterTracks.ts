import { readConfObject } from '@jbrowse/core/configuration'
import { getEnv, getSession, notEmpty } from '@jbrowse/core/util'

import { hasAllOverlap, hasAnyOverlap } from './util'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export function filterTracks(
  tracks: AnyConfigurationModel[],
  self: {
    view?: {
      type: string
      trackSelectorAnyOverlap?: boolean
    }
    assemblyNames: string[]
  },
) {
  const { assemblyManager } = getSession(self)
  const { pluginManager } = getEnv(self)
  const { view } = self

  if (!view) {
    return []
  }
  const viewAssemblyNames = self.assemblyNames
    .map(a => assemblyManager.getCanonicalAssemblyName(a))
    .filter(notEmpty)
  return tracks
    .filter(c => {
      const trackConfigAssemblyNames = readConfObject(c, 'assemblyNames') as
        | string[]
        | undefined
      const trackCanonicalAssemblyNames = trackConfigAssemblyNames
        ?.map(name => assemblyManager.getCanonicalAssemblyName(name))
        .filter(notEmpty)
      return view.trackSelectorAnyOverlap
        ? hasAnyOverlap(trackCanonicalAssemblyNames, viewAssemblyNames)
        : hasAllOverlap(trackCanonicalAssemblyNames, viewAssemblyNames)
    })
    .filter(c => {
      const { displayTypes } = pluginManager.getViewType(view.type)!
      const compatDisplays = displayTypes.map(d => d.name)
      const trackDisplays = c.displays.map((d: { type: string }) => d.type)
      return hasAnyOverlap(compatDisplays, trackDisplays)
    })
}
