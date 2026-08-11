import { readConfObject } from '@jbrowse/core/configuration'
import { getEnv, getSession } from '@jbrowse/core/util'
import { canonicalAssemblyNames } from '@jbrowse/core/util/tracks'

import { containsAll } from './util.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * The display type names a view can render, as a lookup set.
 */
export function viewDisplayNames(
  pluginManager: PluginManager,
  viewType: string,
) {
  return new Set(
    pluginManager
      .getViewType(viewType)
      .displayTypes.map((d: { name: string }) => d.name),
  )
}

/**
 * Whether a view rendering `viewDisplays` can open this track at all — does the
 * track type declare a display the view draws. The question `showTrackGeneric`
 * asks through `pickDisplayForView`, so a track the selector offers is one that
 * can actually be turned on. A view type registering no displays constrains
 * nothing.
 *
 * Reads the *track type's* registered displays rather than the config's own
 * `displays` array, which is both cheaper and the only form available on an
 * un-hydrated frozen track config (ADR-032). The two agree:
 * `preprocessTrackConfigSnapshot` fills in a stub display for every display the
 * track type registers.
 */
export function viewCanDisplayTrack(
  pluginManager: PluginManager,
  viewDisplays: Set<string>,
  trackType: string,
) {
  return (
    viewDisplays.size === 0 ||
    pluginManager
      .getTrackType(trackType)
      .displayTypes.some(d => viewDisplays.has(d.name))
  )
}

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
