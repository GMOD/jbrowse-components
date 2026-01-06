import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import { getSession } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

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
          // @ts-expect-error
          const jb2Tracks = config.tracks?.map(jb1Track => ({
            ...convertTrackConfig(jb1Track, config.dataRoot || ''),
            assemblyNames: [assemblyName],
          }))

          self.setTrackConfs(jb2Tracks)
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
