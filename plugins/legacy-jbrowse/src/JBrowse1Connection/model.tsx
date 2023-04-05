import {
  ConfigurationReference,
  readConfObject,
} from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import { types } from 'mobx-state-tree'
import configSchema from './configSchema'

import { fetchJb1 } from './jb1ConfigLoad'
import { convertTrackConfig } from './jb1ToJb2'
import PluginManager from '@jbrowse/core/PluginManager'

export default function (pluginManager: PluginManager) {
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
      connect() {
        const dataDirLocation = readConfObject(
          self.configuration,
          'dataDirLocation',
        )
        const session = getSession(self)
        fetchJb1(dataDirLocation)
          .then(config => {
            const assemblyName = readConfObject(
              self.configuration,
              'assemblyNames',
            )[0]
            if (!assemblyName) {
              throw new Error('assembly name required for JBrowse 1 connection')
            }
            const assemblyConf = session.assemblies.find(
              assembly => readConfObject(assembly, 'name') === assemblyName,
            )
            if (!assemblyConf) {
              throw new Error(`Assembly "${assemblyName}" not found`)
            }
            const sequenceAdapter = readConfObject(assemblyConf, [
              'sequence',
              'adapter',
            ])

            // @ts-expect-error
            const jb2Tracks = config.tracks?.map(jb1Track => {
              const jb2Track = convertTrackConfig(
                jb1Track,
                config.dataRoot || '',
                sequenceAdapter,
              )

              // @ts-expect-error
              jb2Track.assemblyNames = [assemblyName]
              return jb2Track
            })

            self.setTrackConfs(jb2Tracks)
          })
          .catch(error => {
            console.error(error)
            session.notify(
              `There was a problem connecting to the JBrowse 1 data directory "${self.name}". Please make sure you have entered a valid location. The error that was thrown is: "${error}"`,
              'error',
            )
            session.breakConnection(self.configuration)
          })
      },
    }))
}
