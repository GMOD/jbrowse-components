import {
  ConfigurationReference,
  readConfObject,
} from '@gmod/jbrowse-core/configuration'
import connectionModelFactory from '@gmod/jbrowse-core/BaseConnectionModel'
import { types } from 'mobx-state-tree'
import configSchema from './configSchema'
import { generateTracks } from './tracks'

export default function(pluginManager) {
  return types.compose(
    'TheTrackHubRegistryConnection',
    connectionModelFactory(pluginManager),
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
              self.setTrackConfs(generateTracks(trackDb, assemblyName))
            })
            .catch(error => {
              console.error(error)
            })
        },
      })),
  )
}
