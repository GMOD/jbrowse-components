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
              const jb2Tracks = config.tracks.map(track =>
                convertTrackConfig(track, config.dataRoot),
              )
              self.setTrackConfs(jb2Tracks)
            })
            .catch(error => {
              console.error(error)
            })
        },
      })),
  )
}
