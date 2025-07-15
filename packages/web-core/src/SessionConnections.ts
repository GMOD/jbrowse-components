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
        /**
         * #method
         */
        hasConnectionConf(connectionConf: BaseConnectionConfigModel) {},
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
}
