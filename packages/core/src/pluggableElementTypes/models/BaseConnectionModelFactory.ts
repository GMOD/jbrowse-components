import { cast, isAlive, types } from '@jbrowse/mobx-state-tree'

import {
  ConfigurationReference,
  readConfObject,
} from '../../configuration/index.ts'
import { getNotificationSink } from '../../util/sessionServices.ts'
import configSchema from './baseConnectionConfig.ts'

import type PluginManager from '../../PluginManager.ts'
import type { AnyConfigurationModel } from '../../configuration/index.ts'

type TrackConf = AnyConfigurationModel | Record<string, unknown>

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
    .actions(self => {
      const trackTypes = pluginManager.getElementTypeRecord('track')
      const hasNoPlugin = ({ type }: TrackConf) =>
        typeof type === 'string' && !trackTypes.has(type)
      let refused: TrackConf[] = []
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
        addTrackConf(trackConf: TrackConf) {
          const length = self.tracks.push(trackConf)
          return self.tracks[length - 1]
        },
        /**
         * #action
         * Appends the tracks. One whose type comes from a plugin this JBrowse
         * does not have is left out, and a warning names those types once
         * `connect` settles.
         */
        addTrackConfs(trackConfs: TrackConf[]) {
          // Sorted out by name before any node is built: a push the track union
          // refuses builds and then destroys every node ahead of the refused
          // one, which on a 5,000-track hub ran a 4 GB heap out of memory.
          refused.push(...trackConfs.filter(hasNoPlugin))
          const buildable = trackConfs.filter(conf => !hasNoPlugin(conf))
          // Append in chunks rather than one push per track: MST reconciles the
          // array on every mutation, and on an 8k-track hub a push per track
          // measured ~14.7s against ~10.8s for a single assignment, with chunks
          // of 500 matching the single-assignment number. Chunked rather than
          // one spread of the whole array so the argument count stays bounded
          // no matter how large the hub is. What remains is per-config MST node
          // creation, roughly 1ms per track.
          for (let i = 0; i < buildable.length; i += 500) {
            self.tracks.push(...buildable.slice(i, i + 500))
          }
        },
        /**
         * #action
         */
        setTrackConfs(trackConfs: TrackConf[]) {
          self.tracks = cast(trackConfs)
        },
      }
    })
}

export type BaseConnectionModel = ReturnType<typeof stateModelFactory>
export default stateModelFactory
