import { readConfObject } from '@gmod/jbrowse-core/configuration'
import connectionModelFactory from '@gmod/jbrowse-core/BaseConnectionModel'
import { flow, types } from 'mobx-state-tree'

import { fetchJb1 } from './jb1ConfigLoad'
import { convertTrackConfig, createRefSeqsAdapter } from './jb1ToJb2'

export default function(pluginManager) {
  return types.compose(
    'JBrowse1Connection',
    connectionModelFactory(pluginManager),
    types.model().actions(self => ({
      connect: flow(function* connect(connectionConf) {
        const dataDirLocation = readConfObject(
          connectionConf,
          'dataDirLocation',
        )
        const config = yield fetchJb1(dataDirLocation)
        const adapter = yield createRefSeqsAdapter(config.refSeqs)
        const jb2Tracks = config.tracks.map(track =>
          convertTrackConfig(track, config.dataRoot),
        )
        const assemblyName = readConfObject(connectionConf, 'assemblyName')
        const defaultSequence = !!readConfObject(
          connectionConf,
          'useAssemblySequence',
        )
        self.addAssembly({
          assemblyName,
          tracks: jb2Tracks,
          sequence: {
            type: 'ReferenceSequenceTrack',
            adapter,
          },
          defaultSequence,
        })
      }),
    })),
  )
}
