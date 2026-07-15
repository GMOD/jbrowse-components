import { readConfObject } from '@jbrowse/core/configuration'
import { getEnv, getSession, notEmpty } from '@jbrowse/core/util'

import { containsAll, intersects } from './util.ts'

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
    const viewDisplaysSet = new Set(
      pluginManager
        .getViewType(view.type)
        .displayTypes.map((d: { name: string }) => d.name),
    )
    return tracks.filter(c => {
      const trackConfigAssemblyNames = readConfObject(c, 'assemblyNames') as
        string[] | undefined
      const trackCanonicalAssemblyNames = trackConfigAssemblyNames
        ?.map(name => assemblyManager.getCanonicalAssemblyName(name))
        .filter(notEmpty)
      if (viewAssemblyNames.length > 0) {
        // by default a track shows only if it supports every assembly the view
        // displays; any-overlap mode relaxes this to sharing any one assembly
        const assemblyMatch = view.trackSelectorAnyOverlap
          ? intersects(trackCanonicalAssemblyNames, viewAssemblyNames)
          : containsAll(trackCanonicalAssemblyNames, viewAssemblyNames)
        if (!assemblyMatch) {
          return false
        }
      }
      return (
        viewDisplaysSet.size === 0 ||
        pluginManager
          .getTrackType(c.type)
          .displayTypes.some(d => viewDisplaysSet.has(d.name))
      )
    })
  }
  return []
}
