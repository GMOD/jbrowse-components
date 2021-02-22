import { types, SnapshotOrInstance, cast } from 'mobx-state-tree'
import PluginManager from '../../PluginManager'
import {
  AnyConfigurationModel,
  ConfigurationReference,
} from '../../configuration/configurationSchema'
import baseConnectionConfig from './baseConnectionConfig'

export default (pluginManager: PluginManager) => {
  return types
    .model('Connection', {
      name: types.identifier,
      tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
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
      addTrackConf(trackConf: AnyConfigurationModel) {
        const length = self.tracks.push(trackConf)
        return self.tracks[length - 1]
      },
      addTrackConfs(
        trackConfs: NonNullable<SnapshotOrInstance<typeof self.tracks>>,
      ) {
        const length = self.tracks.push(...trackConfs)
        return self.tracks.slice(length - 1 - trackConfs.length, length - 1)
      },
      setTrackConfs(trackConfs: SnapshotOrInstance<typeof self.tracks>) {
        self.tracks = cast(trackConfs)
        return self.tracks
      },
      clear() {},
    }))
}
