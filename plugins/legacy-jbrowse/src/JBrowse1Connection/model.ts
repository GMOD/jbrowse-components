import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import { getSession } from '@jbrowse/core/util'
import { types } from 'mobx-state-tree'

// locals
import configSchema from './configSchema'
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
          const { fetchJb1 } = await import('./jb1ConfigLoad')
          const { convertTrackConfig } = await import('./jb1ToJb2')
          const config = await fetchJb1(dataDirLocation)
          const assemblyName = getConf(self, 'assemblyNames')[0]
          if (!assemblyName) {
            throw new Error('assembly name required for JBrowse 1 connection')
          }
          const conf = session.assemblies.find(
            a => readConfObject(a, 'name') === assemblyName,
          )
          if (!conf) {
            throw new Error(`Assembly "${assemblyName}" not found`)
          }
          const sequenceAdapter = readConfObject(conf, ['sequence', 'adapter'])

          // @ts-expect-error
          const jb2Tracks = config.tracks?.map(jb1Track => ({
            ...convertTrackConfig(
              jb1Track,
              config.dataRoot || '',
              sequenceAdapter,
            ),
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
