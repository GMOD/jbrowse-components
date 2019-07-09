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
          getRoot(self).deleteConnection(readConfObject(connectionConf, 'name'))
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
            type: 'ReferenceSequenceTrack',
            adapter: {
              type: 'FromConfigAdapter',
              regions: [],
            },
          },
        ) {
          const assemblyModel = getType(self.assemblies).subType.type
          const assembly = assemblyModel.create({
            configId: assemblyName,
            aliases,
            refNameAliases,
            sequence,
          })
          self.assemblies.set(assemblyName, assembly)
          getRoot(self).updateAssemblies()
        },

        removeAssembly(assemblyName) {
          detach(self.assemblies.get(assemblyName))
          self.assemblies.delete(assemblyName)
          getRoot(self).updateAssemblies()
        },
      }),
    },
  )
}
