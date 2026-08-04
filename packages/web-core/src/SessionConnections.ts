import { types } from '@jbrowse/mobx-state-tree'
import {
  ConnectionManagementSessionMixin,
  asSession,
  isSessionWithConnections,
} from '@jbrowse/product-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfiguration,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'

export interface WebSessionWithConnections {
  sessionConnections: AnyConfigurationModel[]
  addSessionConnectionConf(conf: AnyConfiguration): AnyConfigurationModel
  // `silent` suppresses a connection's first-connect side effects (its own view
  // launch, its success snackbar) — for a caller that is launching the view
  // itself, or re-establishing a connection whose tracks are already restored
  makeConnection(
    conf: AnyConfigurationModel,
    initialSnapshot?: { silent?: boolean },
  ): void
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
      const self = asSession(s)
      const superDeleteConnection = self.deleteConnection
      const superAddConnectionConf = self.addConnectionConf
      // A plain closure rather than `this.addSessionConnectionConf`, so the two
      // actions below can share it without either one's inferred return type
      // depending on the other's.
      function addToSession(connectionConf: AnyConfiguration) {
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
      return {
        /**
         * #action
         * Add a connection config to *this session*: it lands in
         * `sessionConnections`, travels with the session when it is saved or
         * shared, and never reaches the config.json the server hands every
         * visitor. Idempotent on `connectionId`.
         *
         * This is the one to call when the connection belongs to the session
         * being built — a `&hubURL=` link, a session spec's
         * `sessionConnections` — no matter who is looking. `addConnectionConf`
         * below is the one whose destination depends on that.
         */
        addSessionConnectionConf(connectionConf: AnyConfiguration) {
          return addToSession(connectionConf)
        },

        /**
         * #action
         * Add a connection config wherever *this user's* edits belong: an
         * admin's into the shared config (`jbrowse.connections`, which the
         * admin server writes back into config.json for every visitor),
         * everyone else's into the session. Two destinations behind one name,
         * so call it only where that really is the intent — the "Open
         * connection..." dialog, where an admin adding a hub means to add it
         * for the whole site. Anything that means one destination should say
         * which: `addSessionConnectionConf` above for the session,
         * `jbrowse.addConnectionConf` for the config.
         */
        addConnectionConf(connectionConf: AnyConfiguration) {
          return self.adminMode
            ? superAddConnectionConf(connectionConf)
            : addToSession(connectionConf)
        },

        /**
         * #action
         */
        deleteConnection(configuration: AnyConfigurationModel) {
          // a session connection is removed from sessionConnections regardless
          // of adminMode (an admin may be viewing a shared/hub session that
          // carries them); only a config-level connection defers to jbrowse,
          // which only admins may edit. Both paths tear down the connection's
          // tracks first (super does it for the config path).
          const { connectionId } = configuration
          const idx = self.sessionConnections.findIndex(
            c => c.connectionId === connectionId,
          )
          if (idx !== -1) {
            self.teardownConnection(configuration)
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
