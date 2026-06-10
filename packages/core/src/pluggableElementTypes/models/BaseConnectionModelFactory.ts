import { cast, types } from '@jbrowse/mobx-state-tree'

import configSchema from './baseConnectionConfig.ts'
import { ConfigurationReference, readConfObject } from '../../configuration/index.ts'

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
      tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),

      /**
       * #property
       */
      configuration: ConfigurationReference(configSchema),
    })
    .views(self => ({
      /**
       * #getter
       * the connection's unique id, resolved from its configuration (the config
       * is the source of truth; connection names are not guaranteed unique)
       */
      get connectionId(): string {
        return self.configuration.connectionId
      },
      /**
       * #getter
       */
      get name(): string {
        return readConfObject(self.configuration, 'name')
      },
    }))
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
      setTrackConfs(trackConfs: TrackConf[]) {
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
