import { isAlive, types } from '@jbrowse/mobx-state-tree'

import {
  ConfigurationReference,
  readConfObject,
} from '../../configuration/index.ts'
import { getNotificationSink } from '../../util/sessionServices.ts'
import { expandLooseTrackConfig } from '../../util/tracks.ts'
import configSchema from './baseConnectionConfig.ts'

import type PluginManager from '../../PluginManager.ts'
import type { TrackConfigEntry } from '../../configuration/index.ts'

/**
 * #stateModel BaseConnectionModel
 * Holds the tracks a connection has loaded. Each connection type overrides
 * `connect` to fetch them from its source.
 */
function stateModelFactory(pluginManager: PluginManager) {
  return types
    .model('Connection', {
      /**
       * #property
       */
      tracks: types.frozen<TrackConfigEntry[]>([]),

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
    .actions(self => {
      const trackTypes = pluginManager.getElementTypeRecord('track')
      const isOfAKnownType = (
        conf: Record<string, unknown>,
      ): conf is TrackConfigEntry =>
        typeof conf.trackId === 'string' &&
        typeof conf.type === 'string' &&
        trackTypes.has(conf.type)
      let refused: Record<string, unknown>[] = []
      // Once per connect and after connect's own snackbar, which would cover it
      function reportRefused() {
        if (refused.length > 0) {
          const types = [...new Set(refused.map(({ type }) => `${type}`))]
          getNotificationSink(self).notify(
            `${self.name}: left out ${refused.length} ${refused.length === 1 ? 'track' : 'tracks'} of a type this JBrowse has no plugin for: ${types.join(', ')}`,
            'warning',
          )
          refused = []
        }
      }
      function admit(trackConfs: Record<string, unknown>[]) {
        const expanded = trackConfs.map(conf =>
          expandLooseTrackConfig(conf, pluginManager),
        )
        refused.push(...expanded.filter(conf => !isOfAKnownType(conf)))
        return expanded.filter(isOfAKnownType)
      }
      return {
        afterAttach() {
          if (self.tracks.length === 0) {
            self.setLoading(true)
            // connect() is overridden to return the (lazy) fetch promise; clear
            // the loading flag once it settles. On failure doConnect breaks the
            // connection (destroying this node), so guard with isAlive.
            void self.connect().finally(() => {
              if (isAlive(self)) {
                self.setLoading(false)
                reportRefused()
              }
            })
          }
        },
        /**
         * #action
         */
        addTrackConf(trackConf: Record<string, unknown>) {
          const [admitted] = admit([trackConf])
          if (admitted) {
            self.tracks = [...self.tracks, admitted]
          }
          return admitted
        },
        /**
         * #action
         * Appends the tracks, expanding a loose `{ trackId, uri }` one as
         * `jbrowse.tracks` does. One whose type comes from a plugin this
         * JBrowse does not have is left out, and a warning names those types
         * once `connect` settles.
         */
        addTrackConfs(trackConfs: Record<string, unknown>[]) {
          self.tracks = [...self.tracks, ...admit(trackConfs)]
        },
        /**
         * #action
         */
        setTrackConfs(trackConfs: Record<string, unknown>[]) {
          self.tracks = admit(trackConfs)
        },
      }
    })
}

export type BaseConnectionModel = ReturnType<typeof stateModelFactory>
export default stateModelFactory
