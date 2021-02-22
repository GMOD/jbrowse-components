import { types, SnapshotOrInstance, cast } from 'mobx-state-tree'
import PluginManager from '../../PluginManager'
import { ConfigurationReference } from '../../configuration/configurationSchema'
import baseConnectionConfig from './baseConnectionConfig'

export default (pluginManager: PluginManager) => {
  const MSTTrackType = pluginManager.pluggableConfigSchemaType('track')
  type ConnectionTrackType = SnapshotOrInstance<typeof MSTTrackType>
  return types
    .model('Connection', {
      name: types.identifier,
      tracks: types.array(MSTTrackType),
      configuration: ConfigurationReference(baseConnectionConfig),
    })
    .actions(self => ({
      connect(_configuration: SnapshotOrInstance<typeof self.configuration>) {
        throw new Error(
          '"connect" is abstract, please implement it in your connection',
        )
      },
    }))
    .actions(self => ({
      afterAttach() {
        if (!self.tracks.length) {
          self.connect(self.configuration)
        }
      },
      addTrackConf(trackConf: ConnectionTrackType) {
        const length = self.tracks.push(trackConf)
        return self.tracks[length - 1]
      },
      addTrackConfs(trackConfs: ConnectionTrackType[]) {
        const length = self.tracks.push(...trackConfs)
        return self.tracks.slice(length - 1 - trackConfs.length, length - 1)
      },
      setTrackConfs(trackConfs: ConnectionTrackType[]) {
        self.tracks = cast(trackConfs)
        return self.tracks
      },
      clear() {},
    }))
}
