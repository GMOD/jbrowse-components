import { cast, types } from 'mobx-state-tree'
import { AnyConfigurationModel } from '../../configuration'
import PluginManager from '../../PluginManager'

/**
 * #stateModel BaseConnectionModel
 */
function stateModelFactory(pluginManager: PluginManager) {
  return types
    .model('Connection', {
      /**
       * #property
       */
      name: types.identifier,
      /**
       * #property
       */
      tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
    })
    .actions(self => ({
      afterAttach() {
        if (self.tracks.length === 0) {
          // @ts-expect-error
          self.connect(self.configuration)
        }
      },
      /**
       * #action
       */
      addTrackConf(trackConf: AnyConfigurationModel) {
        const length = self.tracks.push(trackConf)
        return self.tracks[length - 1]
      },
      /**
       * #action
       */
      addTrackConfs(trackConfs: AnyConfigurationModel[]) {
        const length = self.tracks.push(...trackConfs)
        return self.tracks.slice(length - 1 - trackConfs.length, length - 1)
      },
      /**
       * #action
       */
      setTrackConfs(trackConfs: AnyConfigurationModel[]) {
        self.tracks = cast(trackConfs)
        return self.tracks
      },
      /**
       * #action
       */
      clear() {},
    }))
}

export default stateModelFactory
