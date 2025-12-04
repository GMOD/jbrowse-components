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
  const { displayTypes } = pluginManager.getViewType(view.type)!
  const viewDisplays = displayTypes.map((d: { name: string }) => d.name)
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

    .filter(conf => {
      const trackType = pluginManager.getTrackType(conf.type)!
      const trackDisplays = trackType.displayTypes.map(d => d.name)
      return hasAnyOverlap(viewDisplays, trackDisplays)
    })
}
