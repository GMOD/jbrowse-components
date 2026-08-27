import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import { getSession } from '@jbrowse/core/util'
import { isAlive, types } from '@jbrowse/mobx-state-tree'

import configSchema from './configSchema.ts'

import type { Track } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #stateModel JBrowse1Connection
 * Connection that imports tracks from a legacy JBrowse 1 data directory,
 * composed on the base connection model.
 */
export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      'JBrowse1Connection',
      BaseConnectionModelFactory(pluginManager),
      types.model({
        configuration: ConfigurationReference(configSchema),
        type: types.literal('JBrowse1Connection'),
      }),
    )

    .actions(self => ({
      async connect() {
        const session = getSession(self)
        try {
          const dataDirLocation = getConf(self, 'dataDirLocation')
          const { fetchJb1 } = await import('./jb1ConfigLoad.ts')
          const { convertTrackConfig } = await import('./jb1ToJb2.ts')
          const config = await fetchJb1(dataDirLocation)
          const assemblyName = getConf(self, 'assemblyNames')[0]
          if (!assemblyName) {
            throw new Error('assembly name required for JBrowse 1 connection')
          }
          // a JBrowse 1 sequence store describes the assembly, which the
          // connection is given rather than supplying. Its ReferenceSequenceTrack
          // schema declares neither assemblyNames nor category, so passing one
          // through would stamp two slots JBrowse ignores onto a second copy of
          // a sequence the assembly already has
          const jb2Tracks = (config.tracks as Track[])
            .map(jb1Track =>
              convertTrackConfig(jb1Track, config.dataRoot || ''),
            )
            .filter(conf => conf.type !== 'ReferenceSequenceTrack')
            .map(conf => ({ ...conf, assemblyNames: [assemblyName] }))

          // the node can be destroyed during the awaits above (e.g. a React
          // StrictMode double-mount disposes the first rootModel)
          if (isAlive(self)) {
            self.setTrackConfs(jb2Tracks)
          }
        } catch (error) {
          console.error(error)
          session.notifyError(
            `There was a problem connecting to the JBrowse 1 data directory "${self.name}". Please make sure you have entered a valid location. The error that was thrown is: "${error}"`,
            error,
          )
          session.breakConnection?.(self.configuration)
        }
      },
    }))
}
