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
    'UCSCTrackHubConnection',
    connectionModelFactory(pluginManager),
    types
      .model({ configuration: ConfigurationReference(configSchema) })
      .actions(self => ({
        connect(connectionConf) {
          self.clear()
          const trackDbId = readConfObject(connectionConf, 'trackDbId')
          fetch(
            `https://www.trackhubregistry.org/api/search/trackdb/${trackDbId}`,
          )
            .then(rawResponse => rawResponse.json())
            .then(trackDb => {
              self.setTrackConfs(generateTracks(trackDb))
            })
            .catch(error => {
              console.error(error)
            })
        },
      })),
  )
}
