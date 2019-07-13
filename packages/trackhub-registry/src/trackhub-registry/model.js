import {
  ConfigurationReference,
  readConfObject,
} from '@gmod/jbrowse-core/configuration'
import connectionModelFactory from '@gmod/jbrowse-core/BaseConnectionModel'
import { flow, types } from 'mobx-state-tree'
import configSchema from './configSchema'
import { generateTracks } from './tracks'

export default function(pluginManager) {
  return types.compose(
    'UCSCTrackHubConnection',
    connectionModelFactory(pluginManager),
    types
      .model({ configuration: ConfigurationReference(configSchema) })
      .actions(self => ({
        connect: flow(function* connect(connectionConf) {
          self.clear()
          const trackDbId = readConfObject(connectionConf, 'trackDbId')
          let rawResponse
          try {
            rawResponse = yield fetch(
              `https://www.trackhubregistry.org/api/search/trackdb/${trackDbId}`,
            )
          } catch (error) {
            console.error(error)
            return
          }
          const trackDb = yield rawResponse.json()
          self.setTrackConfs(generateTracks(trackDb))
        }),
      })),
  )
}
