import { types } from '@jbrowse/mobx-state-tree'
import {
  ConnectionManagementSessionMixin,
  isSessionWithConnections,
} from '@jbrowse/product-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseConnectionConfigModel } from '@jbrowse/core/pluggableElementTypes/models/baseConnectionConfig'
import type {
  BaseSession,
  SessionWithSessionTracks,
} from '@jbrowse/product-core'

export interface WebSessionWithConnections {
  sessionConnections: AnyConfigurationModel[]
  makeConnection(conf: AnyConfigurationModel): void
}

export function isWebSessionWithConnections(
  session: unknown,
): session is WebSessionWithConnections {
  return isSessionWithConnections(session) && 'sessionConnections' in session
}

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
        sessionConnections: types.stripDefault(
          types.array(pluginManager.pluggableConfigSchemaType('connection')),
          [],
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
              throw new Error('connection type not specified')
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
          // a session connection is removed from sessionConnections regardless
          // of adminMode (an admin may be viewing a shared/hub session that
          // carries them); only a config-level connection defers to jbrowse,
          // which only admins may edit
          const { connectionId } = configuration
          const idx = self.sessionConnections.findIndex(
            c => c.connectionId === connectionId,
          )
          if (idx !== -1) {
            return self.sessionConnections.splice(idx, 1)
          } else if (self.adminMode) {
            return superDeleteConnection(configuration)
          } else {
            return undefined
          }
        },
      }
    })
}
