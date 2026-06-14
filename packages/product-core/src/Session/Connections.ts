import { types } from '@jbrowse/mobx-state-tree'

import { isBaseSession } from './BaseSession.ts'

import type { BaseSession } from './BaseSession.ts'
import type { SessionWithReferenceManagementType } from './ReferenceManagement.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseConnectionConfigModel } from '@jbrowse/core/pluggableElementTypes/models/baseConnectionConfig'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

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
    .actions(self => ({
      /**
       * #action
       */
      makeConnection(
        configuration: AnyConfigurationModel,
        initialSnapshot = {},
      ) {
        const { type } = configuration
        if (!type) {
          throw new Error('connection configuration has no `type` listed')
        }
        self.connectionInstances.push({
          ...initialSnapshot,
          type,
          configuration,
        })
        return self.connectionInstances.at(-1)
      },

      /**
       * #action
       */
      prepareToBreakConnection(
        configuration: AnyConfigurationModel,
      ): [() => void, Record<string, number>] | undefined {
        const root = self as typeof self &
          Instance<SessionWithReferenceManagementType>
        const callbacksToDeref: (() => void)[] = []
        const derefTypeCount: Record<string, number> = {}
        const { connectionId } = configuration
        const connection = self.connectionInstances.find(
          c => c.connectionId === connectionId,
        )
        if (!connection) {
          return undefined
        }
        const referringByTrackId = root.getReferringMultiple(connection.tracks)
        for (const track of connection.tracks) {
          const refs = referringByTrackId.get(track.trackId) ?? []
          root.removeReferring(refs, track, callbacksToDeref, derefTypeCount)
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
        const { jbrowse } = self as typeof self & BaseSession
        return jbrowse.deleteConnectionConf(configuration)
      },

      /**
       * #action
       */
      addConnectionConf(connectionConf: AnyConfigurationModel) {
        const { jbrowse } = self as typeof self & BaseSession
        return jbrowse.addConnectionConf(connectionConf)
      },

      /**
       * #action
       */
      clearConnections() {
        self.connectionInstances.clear()
      },
    }))
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
