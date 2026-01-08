import { cast, types } from '@jbrowse/mobx-state-tree'

import configSchema from './baseConnectionConfig.ts'
import { ConfigurationReference } from '../../configuration/index.ts'

import type PluginManager from '../../PluginManager.ts'
import type { AnyConfigurationModel } from '../../configuration/index.ts'

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
        for (const trackConf of trackConfs) {
          self.tracks.push(trackConf)
        }
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
