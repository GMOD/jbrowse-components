import { detach, getType, types, getRoot } from 'mobx-state-tree'
import {
  ConfigurationSchema,
  readConfObject,
} from '@gmod/jbrowse-core/configuration'
import RpcManager from '@gmod/jbrowse-core/rpc/RpcManager'
import AssemblyConfigsSchemasFactory from './assemblyConfigSchemas'

export default function(pluginManager) {
  const { assemblyConfigSchemas, dispatcher } = AssemblyConfigsSchemasFactory(
    pluginManager,
  )
  return ConfigurationSchema(
    'JBrowseWebRoot',
    {
      // A map of assembly name -> assembly details
      assemblies: types.array(
        types.union({ dispatcher }, ...assemblyConfigSchemas),
      ),

      // possibly consider this for global config editor
      highResolutionScaling: {
        type: 'number',
        defaultValue: 2,
      },

      connections: types.array(
        pluginManager.pluggableConfigSchemaType('connection'),
      ),

      rpc: RpcManager.configSchema,

      defaultSession: {
        type: 'frozen',
        defaultValue: null,
        description: 'Snapshot representing a default session',
      },
    },
    {
      actions: self => ({
        addConnection(connectionConf) {
          self.connections.push(connectionConf)
          getRoot(self).addConnection(connectionConf)
        },

        removeConnection(connectionConf) {
          self.connections.remove(connectionConf)
        },

        addAssembly(
          assemblyName,
          aliases = [],
          refNameAliases = {
            adapter: {
              type: 'FromConfigAdapter',
              refNameAliases: [],
            },
          },
          sequence = {
            type: 'ReferenceSequence',
            adapter: {
              type: 'FromConfigAdapter',
              regions: [],
            },
          },
          connectionName,
        ) {
          const assemblyModel = getType(self.assemblies).subType.type
          const assembly = assemblyModel.create({
            configId: assemblyName,
            aliases,
            refNameAliases,
            sequence,
          })
          if (connectionName) {
            const connectionNames = self.connections.map(connection =>
              readConfObject(connection, 'connectionName'),
            )
            if (!connectionNames.includes(connectionName))
              throw new Error(
                `Cannot add assembly to non-existent connection: ${connectionName}`,
              )
            self.volatile
              .get(connectionName)
              .assemblies.set(assemblyName, assembly)
          } else self.assemblies.set(assemblyName, assembly)
        },

        removeAssembly(assemblyName) {
          detach(self.assemblies.get(assemblyName))
          self.assemblies.delete(assemblyName)
        },
      }),
    },
  )
}
