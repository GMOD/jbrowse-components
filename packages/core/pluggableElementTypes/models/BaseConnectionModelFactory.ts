import { types, SnapshotOrInstance, cast } from 'mobx-state-tree'
import PluginManager from '../../PluginManager'
import { AnyConfigurationModel } from '../../configuration/configurationSchema'

export default (pluginManager: PluginManager) => {
  return types
    .model('Connection', {
      name: types.identifier,
      tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
    })
    .actions(self => ({
      afterAttach() {
        // @ts-ignore
        self.connect(self.configuration)
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
