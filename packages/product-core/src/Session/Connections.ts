import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import { asSession } from '../siblingCast.ts'
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
        const { jbrowse } = asSession(self)
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
         * Remove a live connection instance. Tolerant of an already-dormant
         * connection (its instance is stripped from the session on reload).
         * Leaves persisted open-track configs alone — the connect() error path
         * calls this and the user's already-open tracks must survive a transient
         * failure. Full removal goes through `deleteConnection`.
         */
        breakConnection(configuration: AnyConfigurationModel) {
          const { connectionId } = configuration
          const connection = self.connectionInstances.find(
            c => c.connectionId === connectionId,
          )
          if (connection) {
            self.connectionInstances.remove(connection)
          }
        },

        /**
         * #action
         * Close every track a connection contributed — the live instance's
         * tracks plus any persisted open-track configs (a dormant connection,
         * never expanded this session, still renders its opened tracks from
         * `connectionTrackConfigs`) — from all views/widgets, drop the live
         * instance, and drop the persisted configs. The session is left as if the
         * connection had never loaded.
         */
        teardownConnection(configuration: AnyConfigurationModel) {
          const { connectionId } = configuration
          const connection = self.connectionInstances.find(
            c => c.connectionId === connectionId,
          )
          const trackIds = [
            ...new Set([
              ...(connection?.tracks.map(
                (t: AnyConfigurationModel) => t.trackId,
              ) ?? []),
              ...Object.entries(self.connectionTrackConfigs)
                .filter(([, e]) => e.connectionId === connectionId)
                .map(([trackId]) => trackId),
            ]),
          ]
          const referring = session.getReferringMultiple(trackIds)
          for (const trackId of trackIds) {
            session.dereferenceTrack(trackId, referring.get(trackId) ?? [])
          }
          this.breakConnection(configuration)
          // closing the tracks above prunes their configs via hideTrack; this
          // mops up any orphaned entry that had no open view
          const remaining = Object.fromEntries(
            Object.entries(self.connectionTrackConfigs).filter(
              ([, e]) => e.connectionId !== connectionId,
            ),
          )
          if (
            Object.keys(remaining).length !==
            Object.keys(self.connectionTrackConfigs).length
          ) {
            self.connectionTrackConfigs = remaining
          }
        },

        /**
         * #action
         * Fully remove a connection: tear down its tracks and live instance, then
         * delete its config.
         */
        deleteConnection(configuration: AnyConfigurationModel) {
          this.teardownConnection(configuration)
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
            for (const conn of self.connectionInstances) {
              const track = conn.tracks.find(
                (t: AnyConfigurationModel) => t.trackId === trackId,
              )
              if (track) {
                this.setConnectionTrackConfig(
                  trackId,
                  conn.connectionId,
                  structuredClone(getSnapshot(track)),
                )
                break
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
            this.setConnectionTrackConfig(
              trackConf.trackId,
              existing.connectionId,
              trackConf,
            )
          }
        },

        /**
         * #action
         * Upsert one opened connection track's persisted config.
         */
        setConnectionTrackConfig(
          trackId: string,
          connectionId: string,
          config: Record<string, unknown>,
        ) {
          self.connectionTrackConfigs = {
            ...self.connectionTrackConfigs,
            [trackId]: { connectionId, config },
          }
        },

        /**
         * #action
         * Drop a connection track's persisted config once no open view still
         * references it, so the session doesn't accumulate closed tracks.
         */
        pruneConnectionTrackConfig(trackId: string) {
          if (
            trackId in self.connectionTrackConfigs &&
            session.getReferring(trackId).length === 0
          ) {
            const { [trackId]: _removed, ...rest } = self.connectionTrackConfigs
            self.connectionTrackConfigs = rest
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
          // makeConnection is idempotent (returns the existing live instance if
          // one matches), so no separate liveness check is needed
          const conf = self.connections.find(
            c => c.connectionId === connectionId,
          )
          if (conf) {
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
