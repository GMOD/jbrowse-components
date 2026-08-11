import { readConfObject } from '@jbrowse/core/configuration'
import { getEnv, getSession } from '@jbrowse/core/util'

import { containsAll, intersects } from './util.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// by default a track shows only if it supports every assembly the view displays;
// any-overlap mode relaxes this to sharing any one assembly
function assemblyMatches(
  trackAssemblyNames: string[] | undefined,
  viewAssemblyNames: string[],
  anyOverlap: boolean | undefined,
) {
  return anyOverlap
    ? intersects(trackAssemblyNames, viewAssemblyNames)
    : containsAll(trackAssemblyNames, viewAssemblyNames)
}

// Assembly names as the aliases resolve them, so a track configured against
// `hg38` still matches a view on `GRCh38`. A name the assembly manager doesn't
// know is kept as written rather than dropped: dropped, an unknown assembly
// means "matches nothing" on the track side but "no constraint at all" on the
// view side, which is the more dangerous of the two — a view whose assembly
// hasn't registered yet (or never will) then offers every track in the session,
// for every other assembly. Kept, both sides compare the same raw string and
// the filter degrades to exact-name matching. Empty names are dropped; a
// half-initialized synteny level pads its assembly pair with them.
function canonicalNames(
  names: string[],
  getCanonicalAssemblyName: (name: string) => string | undefined,
) {
  return names
    .filter(name => !!name)
    .map(name => getCanonicalAssemblyName(name) ?? name)
}

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
  const canonical = (names: string[]) =>
    canonicalNames(names, name =>
      assemblyManager.getCanonicalAssemblyName(name),
    )
  const viewAssemblyNames = canonical(self.assemblyNames)
  const viewDisplays = viewDisplayNames(pluginManager, view.type)
  return tracks.filter(c => {
    const trackAssemblyNames = readConfObject(c, 'assemblyNames') as
      | string[]
      | undefined
    return (
      (viewAssemblyNames.length === 0 ||
        assemblyMatches(
          trackAssemblyNames && canonical(trackAssemblyNames),
          viewAssemblyNames,
          view.trackSelectorAnyOverlap,
        )) &&
      viewCanDisplayTrack(pluginManager, viewDisplays, c.type)
    )
  })
}
