import { ConnectionManagementSessionMixin } from '@jbrowse/product-core'
import { types } from 'mobx-state-tree'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseConnectionConfigModel } from '@jbrowse/core/pluggableElementTypes/models/baseConnectionConfig'
import type {
  BaseSession,
  SessionWithSessionTracks,
} from '@jbrowse/product-core'

/**
 * #stateModel WebSessionConnectionsMixin
 * #category session
 */
export function WebSessionConnectionsMixin(pluginManager: PluginManager) {
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
        addConnectionConf(connectionConf: BaseConnectionConfigModel) {
          if (self.adminMode) {
            return superAddConnectionConf(connectionConf)
          }
          const { connectionId, type } = connectionConf
          if (!type) {
            throw new Error(`unknown connection type ${type}`)
          }
          const connection = self.sessionTracks.find(
            c => c.connectionId === connectionId,
          )
          if (connection) {
            return connection
          }
          const length = self.sessionConnections.push(connectionConf)
          return self.sessionConnections[length - 1]
        },

        deleteConnection(configuration: AnyConfigurationModel) {
          let deletedConn: unknown
          if (self.adminMode) {
            deletedConn = superDeleteConnection(configuration)
          }
          if (!deletedConn) {
            const { connectionId } = configuration
            const idx = self.sessionConnections.findIndex(
              c => c.connectionId === connectionId,
            )
            if (idx === -1) {
              return undefined
            }
            return self.sessionConnections.splice(idx, 1)
          }
          return deletedConn
        },
      }
    })
}
