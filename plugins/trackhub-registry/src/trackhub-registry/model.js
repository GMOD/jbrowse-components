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
          const session = getSession(self)
          fetch(
            `https://www.trackhubregistry.org/api/search/trackdb/${trackDbId}`,
          )
            .then(rawResponse => rawResponse.json())
            .then(trackDb => {
              // eslint-disable-next-line no-underscore-dangle
              const assemblyName = trackDb._source.assembly.name
              const assembly = session.assemblyManager.get(assemblyName)
              if (!assembly) {
                throw new Error(`No assembly "${assemblyName}" found`)
              }
              const assemblyConf = assembly.configuration
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
              session.notify(
                `There was a problem connecting to the Track Hub Registry hub "${self.name}": ${error}`,
                'error',
              )
              session.breakConnection(self.configuration)
            })
        },
      })),
  )
}
