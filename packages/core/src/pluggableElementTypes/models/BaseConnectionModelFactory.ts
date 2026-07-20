import { cast, isAlive, types } from '@jbrowse/mobx-state-tree'

import {
  ConfigurationReference,
  readConfObject,
} from '../../configuration/index.ts'
import configSchema from './baseConnectionConfig.ts'

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

      /**
       * #property
       * set when the connection is being re-established on session load (its
       * open tracks are already restored from `connectionTrackConfigs`), so
       * `doConnect` suppresses first-connect side effects like launching a view
       * or a success snackbar. Runtime-only: connection instances aren't
       * serialized.
       */
      silent: types.optional(types.boolean, false),
    })
    .volatile(() => ({
      /**
       * #volatile
       * true while `connect()` is fetching this connection's tracks; drives a
       * loading affordance in the track selector. Distinct from an empty
       * `tracks` array, which is also the state of a connection that loaded
       * successfully but has no tracks.
       */
      loading: false,
    }))
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
    .actions(self => ({
      /**
       * #action
       * no-op hook; concrete connections (UCSC/JB2 track hubs, etc.) override
       * this to fetch and populate their `tracks`. Returns a promise so
       * `afterAttach` can clear the loading flag once the fetch settles.
       */
      connect(): Promise<void> {
        return Promise.resolve()
      },
      /**
       * #action
       */
      setLoading(loading: boolean) {
        self.loading = loading
      },
    }))
    .actions(self => ({
      afterAttach() {
        if (self.tracks.length === 0) {
          self.setLoading(true)
          // connect() is overridden to return the (lazy) fetch promise; clear
          // the loading flag once it settles. On failure doConnect breaks the
          // connection (destroying this node), so guard with isAlive.
          void self.connect().finally(() => {
            if (isAlive(self)) {
              self.setLoading(false)
            }
          })
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
    }))
}

export type BaseConnectionModel = ReturnType<typeof stateModelFactory>
export default stateModelFactory
