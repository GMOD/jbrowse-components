import { types } from 'mobx-state-tree'

import { Session as CoreSession } from '@jbrowse/product-core'
import type { BaseSession } from '@jbrowse/product-core/src/Session/Base'

import PluginManager from '@jbrowse/core/PluginManager'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { BaseConnectionConfigModel } from '@jbrowse/core/pluggableElementTypes/models/baseConnectionConfig'
import { SessionWithSessionTracks } from '@jbrowse/product-core/src/Session/SessionTracks'

export default function SessionConnections(pluginManager: PluginManager) {
  return types
    .compose(
      'SessionConnectionsManagement',
      CoreSession.Connections(pluginManager),
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
      const super_deleteConnection = self.deleteConnection
      const super_addConnectionConf = self.addConnectionConf
      return {
        addConnectionConf(connectionConf: BaseConnectionConfigModel) {
          if (self.adminMode) {
            return super_addConnectionConf(connectionConf)
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
          let deletedConn
          if (self.adminMode) {
            deletedConn = super_deleteConnection(configuration)
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
