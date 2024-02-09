import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { getEnv, getSession, notEmpty } from '@jbrowse/core/util'
import { hasAllOverlap, hasAnyOverlap } from './util'

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
  const { displayTypes } = pluginManager.getViewType(view.type)
  const viewDisplays = displayTypes.map((d: { name: string }) => d.name)
  return tracks
    .filter(c => {
      const trackAssemblyNames = readConfObject(c, 'assemblyNames') as string[]
      const trackAssemblies = trackAssemblyNames
        ?.map(name => assemblyManager.get(name))
        .filter(notEmpty)
      return view.trackSelectorAnyOverlap
        ? hasAnyOverlap(trackAssemblies, trackListAssemblies)
        : hasAllOverlap(trackAssemblies, trackListAssemblies)
    })

    .filter(conf => {
      const trackType = pluginManager.getTrackType(conf?.type)
      const trackDisplays = trackType.displayTypes.map(d => d.name)
      return hasAnyOverlap(viewDisplays, trackDisplays)
    })
}
