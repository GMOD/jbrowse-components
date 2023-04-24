import { types } from 'mobx-state-tree'

import { Session } from '@jbrowse/product-core'
import PluginManager from '@jbrowse/core/PluginManager'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

export default function Connections(pluginManager: PluginManager) {
  return types
    .compose(
      'SessionConnectionsManagement',
      Session.Connections(pluginManager),
      types.model({
        /**
         * #property
         */
        sessionConnections: types.array(
          pluginManager.pluggableConfigSchemaType('connection'),
        ),
      }),
    )
    .actions(self => {
      const superDeleteConnection = self.deleteConnection
      const superAddConnectionConf = self.addConnectionConf
      return {
        addConnectionConf(connectionConf: any) {
          if (self.adminMode) {
            return superAddConnectionConf(connectionConf)
          }
          const { connectionId, type } = connectionConf as {
            type: string
            connectionId: string
          }
          if (!type) {
            throw new Error(`unknown connection type ${type}`)
          }
          const connection = self.sessionTracks.find(
            (c: any) => c.connectionId === connectionId,
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
