import {
  ConfigurationReference,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import { getSession } from '@jbrowse/core/util'
import { types } from 'mobx-state-tree'
import configSchema from './configSchema'
import { generateTracks } from './tracks'

export default function (pluginManager) {
  return types.compose(
    'TheTrackHubRegistryConnection',
    BaseConnectionModelFactory(pluginManager),
    types
      .model({
        type: types.literal('TheTrackHubRegistryConnection'),
        configuration: ConfigurationReference(configSchema),
      })
      .actions(self => ({
        connect(connectionConf) {
          self.clear()
          const trackDbId = readConfObject(connectionConf, 'trackDbId')
          fetch(
            `https://www.trackhubregistry.org/api/search/trackdb/${trackDbId}`,
          )
            .then(rawResponse => rawResponse.json())
            .then(trackDb => {
              const assemblyName = readConfObject(
                self.configuration,
                'assemblyName',
              )
              const session = getSession(self)
              const assemblyConf = session.assemblies.find(
                assembly => readConfObject(assembly, 'name') === assemblyName,
              )
              const sequenceAdapter = readConfObject(assemblyConf, [
                'sequence',
                'adapter',
              ])
              self.setTrackConfs(
                generateTracks(trackDb, assemblyName, sequenceAdapter),
              )
            })
            .catch(error => {
              console.error(error)
            })
        },
      })),
  )
}
