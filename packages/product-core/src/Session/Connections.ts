import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import { isBaseSession } from './BaseSession.ts'

import type { BaseSession } from './BaseSession.ts'
import type { SessionWithReferenceManagementType } from './ReferenceManagement.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseConnectionConfigModel } from '@jbrowse/core/pluggableElementTypes/models/baseConnectionConfig'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

/**
 * Persisted config of a connection track the user has opened. Keyed by trackId
 * in `connectionTrackConfigs`. `connectionId` records provenance so the track
 * can be grouped under its connection and re-hydrated on demand.
 */
export interface ConnectionTrackConfigEntry {
  connectionId: string
  config: Record<string, unknown>
}

/**
 * #stateModel ConnectionManagementSessionMixin
 */
export function ConnectionManagementSessionMixin(pluginManager: PluginManager) {
  return types
    .model({
      /**
       * #property
       */
      connectionInstances: types.stripDefault(
        types.array(pluginManager.pluggableMstType('connection', 'stateModel')),
        [],
      ),
      /**
       * #property
       * Persisted configs of connection tracks the user has opened, keyed by
       * trackId. Unlike `connectionInstances` (stripped from snapshots, holds
       * the whole fetched hub), this holds only the tracks in use, so an open
       * connection track resolves synchronously on session load without
       * re-establishing the connection.
       */
      connectionTrackConfigs: types.stripDefault(
        types.frozen<Record<string, ConnectionTrackConfigEntry>>(),
        {},
      ),
    })
    .views(self => ({
      /**
       * #getter
       */
      get connections(): BaseConnectionConfigModel[] {
        const { jbrowse } = self as typeof self & BaseSession
        return jbrowse.connections
      },
    }))
    .actions(self => {
      // this mixin is always composed onto a base session with a jbrowse config
      // and reference-management helpers; alias once instead of re-casting self
      const session = self as typeof self &
        BaseSession &
        Instance<SessionWithReferenceManagementType>
      return {
        /**
         * #action
         */
        makeConnection(
          configuration: AnyConfigurationModel,
          initialSnapshot = {},
        ) {
          const { type, connectionId } = configuration
          if (!type) {
            throw new Error('connection configuration has no `type` listed')
          }
          const existing = self.connectionInstances.find(
            c => c.connectionId === connectionId,
          )
          if (existing) {
            return existing
          } else {
            const length = self.connectionInstances.push({
              ...initialSnapshot,
              type,
              configuration,
            })
            return self.connectionInstances[length - 1]
          }
        },

        /**
         * #action
         */
        prepareToBreakConnection(
          configuration: AnyConfigurationModel,
        ): [() => void, Record<string, number>] | undefined {
          const callbacksToDeref: (() => void)[] = []
          const derefTypeCount: Record<string, number> = {}
          const { connectionId } = configuration
          const connection = self.connectionInstances.find(
            c => c.connectionId === connectionId,
          )
          if (!connection) {
            return undefined
          }
          const referringByTrackId = session.getReferringMultiple(
            connection.tracks,
          )
          for (const track of connection.tracks) {
            const refs = referringByTrackId.get(track.trackId) ?? []
            session.removeReferring(
              refs,
              track,
              callbacksToDeref,
              derefTypeCount,
            )
          }
          return [
            () => {
              for (const cb of callbacksToDeref) {
                cb()
              }
              this.breakConnection(configuration)
            },
            derefTypeCount,
          ]
        },

        /**
         * #action
         */
        breakConnection(configuration: AnyConfigurationModel) {
          const { connectionId } = configuration
          const connection = self.connectionInstances.find(
            c => c.connectionId === connectionId,
          )
          if (!connection) {
            throw new Error(`no connection found with id ${connectionId}`)
          }
          self.connectionInstances.remove(connection)
        },

        /**
         * #action
         */
        deleteConnection(configuration: AnyConfigurationModel) {
          return session.jbrowse.deleteConnectionConf(configuration)
        },

        /**
         * #action
         */
        addConnectionConf(connectionConf: AnyConfigurationModel) {
          return session.jbrowse.addConnectionConf(connectionConf)
        },

        /**
         * #action
         */
        clearConnections() {
          self.connectionInstances.clear()
        },

        /**
         * #action
         * Snapshot a just-opened connection track's config into
         * `connectionTrackConfigs` so it survives session reload. No-op if the
         * track isn't connection-provided or is already captured (edits go
         * through `updateConnectionTrackConfig`).
         */
        captureConnectionTrack(trackId: string) {
          if (!(trackId in self.connectionTrackConfigs)) {
            const conn = self.connectionInstances.find(c =>
              c.tracks.some(
                (t: AnyConfigurationModel) => t.trackId === trackId,
              ),
            )
            const track = conn?.tracks.find(
              (t: AnyConfigurationModel) => t.trackId === trackId,
            )
            if (conn && track) {
              self.connectionTrackConfigs = {
                ...self.connectionTrackConfigs,
                [trackId]: {
                  connectionId: conn.connectionId,
                  config: structuredClone(getSnapshot(track)),
                },
              }
            }
          }
        },

        /**
         * #action
         * Persist an edit to an opened connection track. The full config is
         * stored (not a delta): the connection's fetched "base" isn't present at
         * load, so only a complete config resolves synchronously.
         */
        updateConnectionTrackConfig(
          trackConf: Record<string, unknown> & { trackId: string },
        ) {
          const existing = self.connectionTrackConfigs[trackConf.trackId]
          if (existing) {
            self.connectionTrackConfigs = {
              ...self.connectionTrackConfigs,
              [trackConf.trackId]: {
                connectionId: existing.connectionId,
                config: trackConf,
              },
            }
          }
        },

        /**
         * #action
         * Drop a connection track's persisted config once no open view still
         * references it, so the session doesn't accumulate closed tracks.
         */
        pruneConnectionTrackConfig(trackId: string) {
          if (trackId in self.connectionTrackConfigs) {
            // getReferring compares track configs by trackId, so a {trackId}
            // shim suffices to test whether any view still holds this track
            const refs = session.getReferring({
              trackId,
            })
            if (refs.length === 0) {
              const { [trackId]: _removed, ...rest } =
                self.connectionTrackConfigs
              self.connectionTrackConfigs = rest
            }
          }
        },

        /**
         * #action
         * Lazily establish a single connection by id if it isn't already live —
         * used when its category is expanded in the track selector. Fetches
         * silently (no view launch / success snackbar); already-open tracks keep
         * rendering from `connectionTrackConfigs` meanwhile. Idempotent.
         */
        hydrateConnection(connectionId: string) {
          const isLive = self.connectionInstances.some(
            c => c.connectionId === connectionId,
          )
          const conf = self.connections.find(
            c => c.connectionId === connectionId,
          )
          if (!isLive && conf) {
            this.makeConnection(conf, { silent: true })
          }
        },
      }
    })
}

/** Session mixin MST type for a session that has connections */
export type SessionWithConnectionsType = ReturnType<
  typeof ConnectionManagementSessionMixin
>

/** Instance of a session that has connections: `connectionInstances`,
 * `makeConnection()`, etc. */
export type SessionWithConnections = Instance<SessionWithConnectionsType>

/** Type guard for SessionWithConnections */
export function isSessionWithConnections(
  session: IAnyStateTreeNode,
): session is SessionWithConnections {
  return isBaseSession(session) && 'connectionInstances' in session
}
