import {
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import { getSession, getEnv } from '@jbrowse/core/util'

function hasAnyOverlap<T>(a1: T[] = [], a2: T[] = []) {
  return !!a1.find(value => a2.includes(value))
}

export function relevantTracksForView(
  tracks: AnyConfigurationModel[],
  self: { view: { type: string } },
  assemblyName: string,
) {
  const { assemblyManager } = getSession(self)
  const { pluginManager } = getEnv(self)
  const assembly = assemblyManager.get(assemblyName)
  if (!assembly) {
    return []
  }
  const { allAliases } = assembly
  const { displayTypes } = pluginManager.getViewType(self.view.type)
  const viewDisplays = displayTypes.map((d: { name: string }) => d.name)
  return tracks
    .filter(conf =>
      hasAnyOverlap(allAliases, readConfObject(conf, 'assemblyNames')),
    )
    .filter(conf => {
      const trackType = pluginManager.getTrackType(conf?.type)
      const trackDisplays = trackType.displayTypes.map(d => d.name)
      return hasAnyOverlap(viewDisplays, trackDisplays)
    })
}
