import { readConfObject } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'
import { isBaseSession } from './BaseSession'
import type { SessionWithReferenceManagementType } from './ReferenceManagement'
import type { BaseRootModelType } from '../RootModel/BaseRootModel'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseConnectionModel } from '@jbrowse/core/pluggableElementTypes/models/BaseConnectionModelFactory'
import type { BaseConnectionConfigModel } from '@jbrowse/core/pluggableElementTypes/models/baseConnectionConfig'
import type { IAnyStateTreeNode, Instance } from 'mobx-state-tree'

// locals

/**
 * #stateModel ConnectionManagementSessionMixin
 */
export function ConnectionManagementSessionMixin(pluginManager: PluginManager) {
  return types
    .model({
      /**
       * #property
       */
      connectionInstances: types.array(
        pluginManager.pluggableMstType(
          'connection',
          'stateModel',
        ) as BaseConnectionModel,
      ),
    })
    .views(self => ({
      /**
       * #getter
       */
      get connections(): BaseConnectionConfigModel[] {
        const { jbrowse } = self as typeof self & Instance<BaseRootModelType>
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
        const type = configuration.type as string
        if (!type) {
          throw new Error('track configuration has no `type` listed')
        }
        const name = readConfObject(configuration, 'name')
        const connectionType = pluginManager.getConnectionType(type)
        if (!connectionType) {
          throw new Error(`unknown connection type ${type}`)
        }
        const length = self.connectionInstances.push({
          ...initialSnapshot,
          name,
          // @ts-expect-error unsure why ts doesn't like `type` here, but is
          // needed
          type,
          configuration,
        })
        return self.connectionInstances[length - 1]
      },

      /**
       * #action
       */
      prepareToBreakConnection(configuration: AnyConfigurationModel) {
        const root = self as typeof self &
          Instance<SessionWithReferenceManagementType>
        const callbacksToDeref: (() => void)[] = []
        const derefTypeCount: Record<string, number> = {}
        const name = readConfObject(configuration, 'name')
        const connection = self.connectionInstances.find(c => c.name === name)
        if (!connection) {
          return undefined
        }
        for (const track of connection.tracks) {
          const ref = root.getReferring(track)
          root.removeReferring(ref, track, callbacksToDeref, derefTypeCount)
        }
        return [
          () => {
            callbacksToDeref.forEach(cb => {
              cb()
            })
            this.breakConnection(configuration)
          },
          derefTypeCount,
        ]
      },

      /**
       * #action
       */
      breakConnection(configuration: AnyConfigurationModel) {
        const name = readConfObject(configuration, 'name')
        const connection = self.connectionInstances.find(c => c.name === name)
        if (!connection) {
          throw new Error(`no connection found with name ${name}`)
        }
        self.connectionInstances.remove(connection)
      },

      /**
       * #action
       */
      deleteConnection(configuration: AnyConfigurationModel) {
        const { jbrowse } = self as typeof self & Instance<BaseRootModelType>
        return jbrowse.deleteConnectionConf(configuration)
      },

      /**
       * #action
       */
      addConnectionConf(connectionConf: AnyConfigurationModel) {
        const { jbrowse } = self as typeof self & Instance<BaseRootModelType>
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
