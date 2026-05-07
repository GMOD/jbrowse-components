import { readConfObject } from '@jbrowse/core/configuration'
import { getEnv, getSession, notEmpty } from '@jbrowse/core/util'

import { hasAllOverlap, hasAnyOverlap } from './util.ts'

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

  if (view) {
    const viewAssemblyNames = self.assemblyNames
      .map(a => assemblyManager.getCanonicalAssemblyName(a))
      .filter(notEmpty)
    const { displayTypes } = pluginManager.getViewType(view.type)!
    const viewDisplaysSet = new Set(
      displayTypes.map((d: { name: string }) => d.name),
    )
    return tracks.filter(c => {
      const trackConfigAssemblyNames = readConfObject(c, 'assemblyNames') as
        | string[]
        | undefined
      const trackCanonicalAssemblyNames = trackConfigAssemblyNames
        ?.map(name => assemblyManager.getCanonicalAssemblyName(name))
        .filter(notEmpty)
      if (viewAssemblyNames.length > 0) {
        const assemblyMatch = view.trackSelectorAnyOverlap
          ? hasAnyOverlap(trackCanonicalAssemblyNames, viewAssemblyNames)
          : hasAllOverlap(trackCanonicalAssemblyNames, viewAssemblyNames)
        if (!assemblyMatch) {
          return false
        }
      }
      if (viewDisplaysSet.size === 0) {
        return true
      }
      const trackType = pluginManager.getTrackType(c.type)!
      return trackType.displayTypes.some(d => viewDisplaysSet.has(d.name))
    })
  }
  return []
}
