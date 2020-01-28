import {
  ConfigurationReference,
  readConfObject,
} from '@gmod/jbrowse-core/configuration'
import connectionModelFactory from '@gmod/jbrowse-core/BaseConnectionModel'
import { types } from 'mobx-state-tree'
import configSchema from './configSchema'

import { fetchJb1 } from './jb1ConfigLoad'
import { convertTrackConfig } from './jb1ToJb2'

export default function(pluginManager) {
  return types.compose(
    'JBrowse1Connection',
    connectionModelFactory(pluginManager),
    types
      .model({
        configuration: ConfigurationReference(configSchema),
        type: types.literal('JBrowse1Connection'),
      })
      .actions(self => ({
        connect() {
          const dataDirLocation = readConfObject(
            self.configuration,
            'dataDirLocation',
          )
          fetchJb1(dataDirLocation)
            .then(config => {
              const assemblyName = readConfObject(
                self.configuration,
                'assemblyName',
              )
              const jb2Tracks = config.tracks.map(jb1Track => {
                const jb2Track = convertTrackConfig(jb1Track, config.dataRoot)
                jb2Track.assemblyNames = [assemblyName]
                return jb2Track
              })
              self.setTrackConfs(jb2Tracks)
            })
            .catch(error => {
              console.error(error)
            })
        },
      })),
  )
}
