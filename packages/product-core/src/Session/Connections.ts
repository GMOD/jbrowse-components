/** MST props, views, actions, etc related to managing connections */

import PluginManager from '@jbrowse/core/PluginManager'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { IAnyStateTreeNode, Instance, types } from 'mobx-state-tree'
import type { SessionWithReferenceManagementType } from './ReferenceManagement'
import type { BaseRootModelType } from '../RootModel/BaseRootModel'
import { BaseConnectionConfigModel } from '@jbrowse/core/pluggableElementTypes/models/baseConnectionConfig'
import { BaseConnectionModel } from '@jbrowse/core/pluggableElementTypes/models/BaseConnectionModelFactory'
import { isBaseSession } from './BaseSession'

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
        const { type } = configuration
        if (!type) {
          throw new Error('track configuration has no `type` listed')
        }
        const name = readConfObject(configuration, 'name')
        const connectionType = pluginManager.getConnectionType(type)
        if (!connectionType) {
          throw new Error(`unknown connection type ${type}`)
        }
        const connectionData = {
          ...initialSnapshot,
          name,
          type,
          configuration,
        }
        const length = self.connectionInstances.push(connectionData)
        return self.connectionInstances[length - 1]
      },

      /**
       * #action
       */
      prepareToBreakConnection(configuration: AnyConfigurationModel) {
        const root = self as typeof self &
          Instance<SessionWithReferenceManagementType>
        const callbacksToDereferenceTrack: Function[] = []
        const dereferenceTypeCount: Record<string, number> = {}
        const name = readConfObject(configuration, 'name')
        const connection = self.connectionInstances.find(c => c.name === name)
        if (connection) {
          connection.tracks.forEach(track => {
            const referring = root.getReferring(track)
            root.removeReferring(
              referring,
              track,
              callbacksToDereferenceTrack,
              dereferenceTypeCount,
            )
          })
          const safelyBreakConnection = () => {
            callbacksToDereferenceTrack.forEach(cb => cb())
            this.breakConnection(configuration)
          }
          return [safelyBreakConnection, dereferenceTypeCount]
        }
        return undefined
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
      addConnectionConf(connectionConf: BaseConnectionConfigModel) {
        const { jbrowse } = self as typeof self & Instance<BaseRootModelType>
        return jbrowse.addConnectionConf(connectionConf)
      },

      /**
       * #action
       */
      clearConnections() {
        self.connectionInstances.length = 0
      },
    }))
}

/** Session mixin MST type for a session that has connections */
export type SessionWithConnectionsType = ReturnType<
  typeof ConnectionManagementSessionMixin
>

/** Instance of a session that has connections: `connectionInstances`, `makeConnection()`, etc. */
export type SessionWithConnections = Instance<SessionWithConnectionsType>

/** Type guard for SessionWithConnections */
export function isSessionWithConnections(
  session: IAnyStateTreeNode,
): session is SessionWithConnections {
  return isBaseSession(session) && 'connectionInstances' in session
}
