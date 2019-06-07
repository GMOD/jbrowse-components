import { readConfObject } from '@gmod/jbrowse-core/configuration'
import connectionModelFactory from '@gmod/jbrowse-core/BaseConnectionModel'
import { flow, types } from 'mobx-state-tree'
import { generateTracks } from './tracks'

export default function modelFactory(pluginManager) {
  return types.compose(
    'UCSCTrackHubConnection',
    connectionModelFactory(pluginManager),
    types.model().actions(self => ({
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
        const assemblyName = trackDb.assembly.name
        self.addEmptyAssembly(assemblyName)
        generateTracks(trackDb).forEach(track =>
          self.assemblies.get(assemblyName).addTrackConf(track.type, track),
        )
      }),
    })),
  )
}
