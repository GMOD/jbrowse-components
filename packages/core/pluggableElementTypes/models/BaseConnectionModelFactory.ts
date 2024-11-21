import { cast, types } from 'mobx-state-tree'
import {
  AnyConfigurationModel,
  ConfigurationReference,
} from '../../configuration'
import PluginManager from '../../PluginManager'

import configSchema from './baseConnectionConfig'

type TrackConf = AnyConfigurationModel | Record<string, unknown>

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

      /**
       * #property
       */
      configuration: ConfigurationReference(configSchema),
    })
    .actions(() => ({
      /**
       * #action
       */
      connect(_arg: AnyConfigurationModel) {},
    }))
    .actions(self => ({
      afterAttach() {
        if (self.tracks.length === 0) {
          self.connect(self.configuration)
        }
      },
      /**
       * #action
       */
      addTrackConf(trackConf: TrackConf) {
        const length = self.tracks.push(trackConf)
        return self.tracks[length - 1]
      },
      /**
       * #action
       */
      addTrackConfs(trackConfs: TrackConf[]) {
        self.tracks.push(...trackConfs)
      },
      /**
       * #action
       */
      setTrackConfs(trackConfs: AnyConfigurationModel[]) {
        self.tracks = cast(trackConfs)
      },
      /**
       * #action
       */
      clear() {},
    }))
}

export type BaseConnectionModel = ReturnType<typeof stateModelFactory>
export default stateModelFactory
