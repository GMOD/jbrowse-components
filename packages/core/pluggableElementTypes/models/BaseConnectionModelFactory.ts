import { cast, types } from 'mobx-state-tree'
import {
  AnyConfigurationModel,
  ConfigurationReference,
} from '../../configuration'
import PluginManager from '../../PluginManager'

import configSchema from './baseConnectionConfig'

/**
 * #stateModel BaseConnectionModel
 */
function stateModelFactory(pluginManager: PluginManager) {
  return types
    .model('Connection', {
      /**
       * #property
       */
      configuration: ConfigurationReference(configSchema),

      /**
       * #property
       */
      name: types.identifier,

      /**
       * #property
       */
      tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
    })
    .actions(() => ({
      /**
       * #action
       */
      connect(_arg: AnyConfigurationModel) {},
    }))
    .actions(self => ({
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

      afterAttach() {
        if (self.tracks.length === 0) {
          self.connect(self.configuration)
        }
      },

      /**
       * #action
       */
      clear() {},

      /**
       * #action
       */
      setTrackConfs(trackConfs: AnyConfigurationModel[]) {
        self.tracks = cast(trackConfs)
        return self.tracks
      },
    }))
}

export type BaseConnectionModel = ReturnType<typeof stateModelFactory>
export default stateModelFactory
