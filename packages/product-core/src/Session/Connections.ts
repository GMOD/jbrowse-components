/** MST props, views, actions, etc related to managing connections */

import PluginManager from '@jbrowse/core/PluginManager'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { Instance, getParent, types } from 'mobx-state-tree'
import ReferenceManagement from './ReferenceManagement'
import { RootModel } from '../RootModel'
import {
  BaseConnectionModelFactory,
  baseConnectionConfig,
} from '@jbrowse/core/pluggableElementTypes'

export default function Connections(pluginManager: PluginManager) {
  // connections: AnyConfigurationModel[]
  // deleteConnection?: Function
  // sessionConnections?: AnyConfigurationModel[]
  // connectionInstances?: {
  //   name: string
  //   connectionId: string
  //   tracks: AnyConfigurationModel[]
  //   configuration: AnyConfigurationModel
  // }[]
  // makeConnection?: Function

  return types
    .compose(
      'ConnectionsManagementSessionMixin',
      ReferenceManagement(pluginManager),
      types.model({
        /**
         * #property
         */
        connectionInstances: types.array(
          pluginManager.pluggableMstType(
            'connection',
            'stateModel',
          ) as ReturnType<typeof BaseConnectionModelFactory>,
        ),

        /**
         * #property
         */
        sessionConnections: types.array(
          pluginManager.pluggableConfigSchemaType('connection'),
        ),
      }),
    )
    .views(self => ({
      /**
       * #getter
       */
      get connections(): Instance<typeof baseConnectionConfig>[] {
        const jbConf = getParent<RootModel>(self).jbrowse
        return [...self.sessionConnections, ...jbConf.connections]
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
        const callbacksToDereferenceTrack: Function[] = []
        const dereferenceTypeCount: Record<string, number> = {}
        const name = readConfObject(configuration, 'name')
        const connection = self.connectionInstances.find(c => c.name === name)
        if (connection) {
          connection.tracks.forEach(track => {
            const referring = self.getReferring(track)
            self.removeReferring(
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
        return getParent<RootModel>(self).jbrowse.deleteConnectionConf(
          configuration,
        )
      },

      /**
       * #action
       */
      addConnectionConf(connectionConf: typeof baseConnectionConfig) {
        return getParent<RootModel>(self).jbrowse.addConnectionConf(
          connectionConf,
        )
      },

      /**
       * #action
       */
      clearConnections() {
        self.connectionInstances.length = 0
      },
    }))
}
