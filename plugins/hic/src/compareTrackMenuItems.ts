import { addExtraTrackMenuItems } from '@jbrowse/core/ui/buildExtraTrackMenuItems'
import {
  addAndShowTrack,
  isSessionWithAddSessionTrack,
  makeTrackId,
} from '@jbrowse/core/util'
import {
  allSessionTracks,
  getConfAssemblyNamesOrNone,
  isSameAssemblyName,
  toTrackConfigEntry,
} from '@jbrowse/core/util/tracks'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { TrackConfigEntry } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

const nameOf = (t: TrackConfigEntry) =>
  typeof t.name === 'string' ? t.name : t.trackId

const adapterOf = (t: TrackConfigEntry): Record<string, unknown> =>
  typeof t.adapter === 'object' && t.adapter !== null ? { ...t.adapter } : {}

const isComparison = (t: TrackConfigEntry) =>
  adapterOf(t).controlAdapter != null

/**
 * The other Hi-C tracks on `mine`'s assembly, each a control it can be
 * compared with. A comparison takes no part on either side: as `other` its own
 * control would ride along unread, and as `mine` the new control would replace
 * the one its name says it divides by.
 */
export function comparableTracks(
  session: AbstractSessionModel,
  mine: TrackConfigEntry,
) {
  if (isComparison(mine)) {
    return []
  }
  const assemblies = getConfAssemblyNamesOrNone(mine)
  return allSessionTracks(session)
    .map(toTrackConfigEntry)
    .filter(
      t =>
        t.type === 'HicTrack' &&
        t.trackId !== mine.trackId &&
        !isComparison(t) &&
        getConfAssemblyNamesOrNone(t).some(a =>
          assemblies.some(b =>
            isSameAssemblyName(a, b, session.assemblyManager),
          ),
        ),
    )
}

/**
 * A track of `mine` over `other`: `mine`'s adapter with `other`'s as its
 * `controlAdapter`, drawn as observed/control.
 */
export function comparisonTrackConf(
  mine: TrackConfigEntry,
  other: TrackConfigEntry,
) {
  const name = `${nameOf(mine)} / ${nameOf(other)}`
  const trackId = makeTrackId({ name })
  return {
    type: 'HicTrack',
    trackId,
    name,
    assemblyNames: getConfAssemblyNamesOrNone(mine),
    adapter: { ...adapterOf(mine), controlAdapter: adapterOf(other) },
    displays: [
      {
        type: 'LinearHicDisplay',
        displayId: `${trackId}-LinearHicDisplay`,
        encoding: { color: 'observed/control' },
      },
    ],
  }
}

/**
 * "Compare with..." on a Hi-C track's menu, in the track selector and the
 * view: a new session track of this map over another condition's. The
 * configured tracks are left as they are, and nothing is published into the
 * config every visitor is served.
 */
export default function HicCompareTrackMenuItemsF(
  pluginManager: PluginManager,
) {
  addExtraTrackMenuItems(pluginManager, ({ session, config, view }) => {
    const mine = toTrackConfigEntry(config)
    if (mine.type !== 'HicTrack' || !isSessionWithAddSessionTrack(session)) {
      return undefined
    }
    const others = comparableTracks(session, mine)
    return others.length
      ? {
          label: 'Compare with...',
          helpText:
            'Open a track of this map over another condition, red where contacts were gained and blue where they were lost.',
          subMenu: others.map(other => ({
            label: nameOf(other),
            onClick: () => {
              addAndShowTrack(session, comparisonTrackConf(mine, other), view)
            },
          })),
        }
      : undefined
  })
}
