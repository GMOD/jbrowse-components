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
  const trackListAssemblies = self.assemblyNames
    .map(a => assemblyManager.get(a))
    .filter(notEmpty)
  return tracks
    .filter(c => {
      const trackAssemblyNames = readConfObject(c, 'assemblyNames') as
        | string[]
        | undefined
      const trackAssemblies = trackAssemblyNames
        ?.map(name => assemblyManager.get(name))
        .filter(notEmpty)
      return view.trackSelectorAnyOverlap
        ? hasAnyOverlap(trackAssemblies, trackListAssemblies)
        : hasAllOverlap(trackAssemblies, trackListAssemblies)
    })
    .filter(c => {
      const { displayTypes } = pluginManager.getViewType(view.type)!
      const compatDisplays = displayTypes.map(d => d.name)
      const trackDisplays = c.displays.map((d: { type: string }) => d.type)
      return hasAnyOverlap(compatDisplays, trackDisplays)
    })
}
