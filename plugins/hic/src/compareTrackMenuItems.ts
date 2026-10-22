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

/** The other Hi-C tracks on `mine`'s assembly, each a control it can be compared with. */
export function comparableTracks(
  session: AbstractSessionModel,
  mine: TrackConfigEntry,
) {
  const assemblies = getConfAssemblyNamesOrNone(mine)
  return allSessionTracks(session)
    .map(toTrackConfigEntry)
    .filter(
      t =>
        t.type === 'HicTrack' &&
        t.trackId !== mine.trackId &&
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
    adapter: {
      ...(typeof mine.adapter === 'object' && mine.adapter !== null
        ? mine.adapter
        : {}),
      controlAdapter: other.adapter,
    },
    displays: [
      {
        type: 'LinearHicDisplay',
        displayId: `${trackId}-LinearHicDisplay`,
        color: 'observed/control',
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
    const others =
      mine.type === 'HicTrack' && isSessionWithAddSessionTrack(session)
        ? comparableTracks(session, mine)
        : []
    return others.length && isSessionWithAddSessionTrack(session)
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
