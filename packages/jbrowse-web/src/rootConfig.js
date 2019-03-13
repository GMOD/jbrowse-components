import { detach, getRoot, getType, types } from 'mobx-state-tree'
import { ConfigurationSchema } from './configuration'
import RpcManager from './rpc/RpcManager'

export function assemblyFactory(pluginManager) {
  return ConfigurationSchema('Assembly', {
    sequence: pluginManager.pluggableConfigSchemaType('track'),
    aliases: {
      type: 'stringArray',
      defaultValue: [],
      description: 'Other possible names for this assembly',
    },
    refNameAliases: ConfigurationSchema('RefNameAliases', {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
    }),
  })
}

export default function(pluginManager) {
  return ConfigurationSchema(
    'JBrowseWebRoot',
    {
      // track configuration is an array of track config schemas. multiple instances of
      // a track can exist that use the same configuration
      tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),

      // A map of assembly name -> assembly details
      assemblies: types.map(assemblyFactory(pluginManager)),

      rpc: RpcManager.configSchema,

      defaultSession: {
        type: 'frozen',
        defaultValue: null,
        description: 'Snapshot representing a default session',
      },
    },
    {
      actions: self => ({
        addTrackConf(typeName, data) {
          const type = getRoot(self).pluginManager.getTrackType(typeName)
          if (!type) throw new Error(`unknown track type ${typeName}`)
          const schemaType = type.configSchema
          const conf = schemaType.create(
            Object.assign({ type: typeName }, data),
          )
          self.tracks.push(conf)
          return conf
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
            configId: 'iTo6LoXUeJ',
            type: 'ReferenceSequence',
            adapter: {
              configId: 'Zd0NLmtxPZ3',
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
        },
        removeAssembly(assemblyName) {
          detach(self.assemblies.get(assemblyName))
          self.assemblies.delete(assemblyName)
        },
      }),
    },
  )
}
