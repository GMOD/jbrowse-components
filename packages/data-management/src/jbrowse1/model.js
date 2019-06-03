import { readConfObject } from '@gmod/jbrowse-core/configuration'
import connectionModelFactory from '@gmod/jbrowse-core/BaseConnectionModel'
import { flow, types } from 'mobx-state-tree'

import { fetchJb1 } from './jb1ConfigLoad'
import { convertTrackConfig, createRefSeqsAdapter } from './jb1ToJb2'

export default function modelFactory(pluginManager) {
  return types.compose(
    'JBrowse1Connection',
    connectionModelFactory(pluginManager),
    types.model().actions(self => ({
      connect: flow(function* connect(connectionConf) {
        self.clear()
        const assemblyName = readConfObject(connectionConf, 'assemblyName')
        self.addEmptyAssembly(assemblyName)
        if (readConfObject(connectionConf, 'useAssemblySequence'))
          self.assemblies.get(assemblyName).setDefaultSequence(true)
        const dataDirLocation = readConfObject(
          connectionConf,
          'dataDirLocation',
        )
        const config = yield fetchJb1(dataDirLocation)
        const adapter = yield createRefSeqsAdapter(config.refSeqs)
        self.assemblies.get(assemblyName).setSequence({
          type: 'ReferenceSequence',
          adapter,
        })
        config.tracks.forEach(track => {
          const jb2Track = convertTrackConfig(track, config.dataRoot)
          self.assemblies
            .get(assemblyName)
            .addTrackConf(jb2Track.type, jb2Track)
        })
      }),
    })),
  )
}
