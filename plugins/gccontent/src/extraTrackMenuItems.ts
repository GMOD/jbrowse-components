import { readConfObject } from '@jbrowse/core/configuration'
import { addExtraTrackMenuItems } from '@jbrowse/core/ui/buildExtraTrackMenuItems'
import { isSessionWithAddTracks } from '@jbrowse/core/util'
import { getConfAssemblyNames } from '@jbrowse/core/util/tracks'

import { makeGCContentTrackConf } from './makeGCContentTrackConf.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * Adds an "Add GC content track" item to the reference sequence track's menu in
 * the hierarchical track selector (where there's no open display to host the
 * action). Uses the shared Core-extraTrackMenuItems extension point so the
 * track-selector code stays decoupled from this plugin.
 */
export default function GCContentExtraTrackMenuItemsF(
  pluginManager: PluginManager,
) {
  addExtraTrackMenuItems(pluginManager, (items, { session, config, view }) =>
    readConfObject(config, 'type') === 'ReferenceSequenceTrack' &&
    isSessionWithAddTracks(session)
      ? [
          ...items,
          {
            label: 'Add GC content track',
            onClick: () => {
              const conf = makeGCContentTrackConf({
                assemblyNames: getConfAssemblyNames(config),
                sequenceAdapter: readConfObject(config, 'adapter'),
                gcMode: 'content',
                adminMode: !!session.adminMode,
              })
              session.addTrackConf(conf)
              view?.showTrack(conf.trackId)
            },
          },
        ]
      : items,
  )
}
