import { readConfObject } from '@jbrowse/core/configuration'
import { addExtraTrackMenuItems } from '@jbrowse/core/ui/buildExtraTrackMenuItems'
import {
  addAndShowTrack,
  isSessionWithAddSessionTrack,
} from '@jbrowse/core/util'
import { getConfAssemblyNames } from '@jbrowse/core/util/tracks'

import { makeGCContentTrackConf } from './makeGCContentTrackConf.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * Adds "Add GC content track" to the reference sequence track's menu, in the
 * track selector and under the in-view menu's Track actions. The new track
 * takes the window, step and mode of the reference track's own GC content
 * display, which are slots on its config.
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
            const gcDisplay = (
              config.displays as AnyConfigurationModel[] | undefined
            )?.find(d => d.type === 'LinearGCContentDisplay')
            const conf = makeGCContentTrackConf({
              assemblyNames: getConfAssemblyNames(config),
              sequenceAdapter: readConfObject(config, 'adapter'),
              ...(gcDisplay
                ? {
                    gcMode: readConfObject(gcDisplay, 'gcMode'),
                    windowSize: readConfObject(gcDisplay, 'windowSize'),
                    windowDelta: readConfObject(gcDisplay, 'windowDelta'),
                  }
                : { gcMode: 'content' as const }),
            })
            addAndShowTrack(session, conf, view)
          },
        }
      : undefined,
  )
}
