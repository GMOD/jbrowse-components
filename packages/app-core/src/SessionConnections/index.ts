import { types } from '@jbrowse/mobx-state-tree'
import { ConnectionManagementSessionMixin } from '@jbrowse/product-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseConnectionConfigModel } from '@jbrowse/core/pluggableElementTypes/models/baseConnectionConfig'
import type {
  BaseSession,
  SessionWithSessionTracks,
} from '@jbrowse/product-core'

/**
 * #stateModel SessionConnectionsMixin
 * #category session
 */
export function SessionConnectionsMixin(pluginManager: PluginManager) {
  return types
    .compose(
      'SessionConnectionsManagement',
      ConnectionManagementSessionMixin(pluginManager),
      types.model({
        /**
         * #property
         */
        sessionConnections: types.array(
          pluginManager.pluggableConfigSchemaType('connection'),
        ),
      }),
    )
    .actions(s => {
      const self = s as typeof s & BaseSession & SessionWithSessionTracks
      const superDeleteConnection = self.deleteConnection
      const superAddConnectionConf = self.addConnectionConf
      return {
        /**
         * #action
         */
        addConnectionConf(connectionConf: BaseConnectionConfigModel) {
          if (self.adminMode) {
            return superAddConnectionConf(connectionConf)
          } else {
            const { connectionId, type } = connectionConf
            if (!type) {
              throw new Error(`unknown connection type "${type}"`)
            }
            const connection = self.sessionConnections.find(
              c => c.connectionId === connectionId,
            )
            if (connection) {
              return connection
            } else {
              const length = self.sessionConnections.push(connectionConf)
              return self.sessionConnections[length - 1]
            }
          }
        },

        /**
         * #action
         */
        deleteConnection(configuration: AnyConfigurationModel) {
          if (self.adminMode) {
            return superDeleteConnection(configuration)
          } else {
            const { connectionId } = configuration
            const idx = self.sessionConnections.findIndex(
              c => c.connectionId === connectionId,
            )
            return idx === -1
              ? undefined
              : self.sessionConnections.splice(idx, 1)
          }
        },
      }
    })
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const { sessionConnections, ...rest } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(sessionConnections.length ? { sessionConnections } : {}),
      } as typeof snap
    })
}
