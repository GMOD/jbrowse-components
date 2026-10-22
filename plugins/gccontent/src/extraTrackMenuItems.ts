import { addExtraTrackMenuItems } from '@jbrowse/core/ui/buildExtraTrackMenuItems'
import {
  addAndShowTrack,
  isSessionWithAddSessionTrack,
  makeTrackId,
} from '@jbrowse/core/util'
import { getConfAssemblyNames } from '@jbrowse/core/util/tracks'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * Adds "Add GC content track" to the reference sequence track's menu, in the
 * track selector and under the in-view menu's Track actions. The new track
 * reads the sequence of the assembly it is shown against.
 */
export default function GCContentExtraTrackMenuItemsF(
  pluginManager: PluginManager,
) {
  addExtraTrackMenuItems(pluginManager, ({ session, config, view }) =>
    config.type === 'ReferenceSequenceTrack' &&
    isSessionWithAddSessionTrack(session)
      ? {
          label: 'Add GC content track',
          onClick: () => {
            const name = 'GC content'
            addAndShowTrack(
              session,
              {
                trackId: makeTrackId({ name }),
                type: 'GCContentTrack',
                name,
                assemblyNames: getConfAssemblyNames(config),
                adapter: { type: 'GCContentAdapter' },
              },
              view,
            )
          },
        }
      : undefined,
  )
}
