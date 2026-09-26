import { readConfObject } from '@jbrowse/core/configuration'
import { addExtraTrackMenuItems } from '@jbrowse/core/ui/buildExtraTrackMenuItems'
import {
  addAndShowTrack,
  isSessionWithAddSessionTrack,
} from '@jbrowse/core/util'
import { getConfAssemblyNames } from '@jbrowse/core/util/tracks'

import { makeGCContentTrackConf } from './makeGCContentTrackConf.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * Adds "Add GC content track" to the reference sequence track's menu, in the
 * track selector and under the in-view menu's Track actions.
 */
export default function GCContentExtraTrackMenuItemsF(
  pluginManager: PluginManager,
) {
  addExtraTrackMenuItems(pluginManager, ({ session, config, view }) =>
    readConfObject(config, 'type') === 'ReferenceSequenceTrack' &&
    isSessionWithAddSessionTrack(session)
      ? {
          label: 'Add GC content track',
          onClick: () => {
            const conf = makeGCContentTrackConf({
              assemblyNames: getConfAssemblyNames(config),
              sequenceAdapter: readConfObject(config, 'adapter'),
              gcMode: 'content',
            })
            addAndShowTrack(session, conf, view)
          },
        }
      : undefined,
  )
}
