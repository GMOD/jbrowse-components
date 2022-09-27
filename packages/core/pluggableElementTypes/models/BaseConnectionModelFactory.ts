import { cast, types } from 'mobx-state-tree'
import { AnyConfigurationModel } from '../../configuration'
import PluginManager from '../../PluginManager'

export default (pluginManager: PluginManager) => {
  return types
    .model('Connection', {
      name: types.identifier,
      tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
    })
    .actions(self => ({
      afterAttach() {
        if (!self.tracks.length) {
          // @ts-ignore
          self.connect(self.configuration)
        }
      },
      addTrackConf(trackConf: AnyConfigurationModel) {
        const length = self.tracks.push(trackConf)
        return self.tracks[length - 1]
      },
      addTrackConfs(trackConfs: AnyConfigurationModel[]) {
        const length = self.tracks.push(...trackConfs)
        return self.tracks.slice(length - 1 - trackConfs.length, length - 1)
      },
      setTrackConfs(trackConfs: AnyConfigurationModel[]) {
        self.tracks = cast(trackConfs)
        return self.tracks
      },
      clear() {},
    }))
}
