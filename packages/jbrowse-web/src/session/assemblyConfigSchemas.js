import {
  ConfigurationSchema,
  readConfObject,
} from '@gmod/jbrowse-core/configuration'
import { getSession } from '@gmod/jbrowse-core/util'
import { types } from 'mobx-state-tree'

const actions = self => ({
  addTrackConf(typeName, data, connectionName) {
    const type = getSession(self).pluginManager.getTrackType(typeName)
    if (!type) throw new Error(`unknown track type ${typeName}`)
    const schemaType = type.configSchema
    const conf = schemaType.create(Object.assign({ type: typeName }, data))
    if (connectionName) {
      const connectionNames = self.connections.map(connection =>
        readConfObject(connection, 'connectionName'),
      )
      if (!connectionNames.includes(connectionName))
        throw new Error(
          `Cannot add track to non-existent connection: ${connectionName}`,
        )
      self.volatile.get(connectionName).tracks.push(conf)
    } else self.tracks.push(conf)
    return conf
  },
})

export default function(pluginManager) {
  const baseConfigSchema = {
    assemblyName: {
      type: 'string',
      defaultValue: '',
      description: 'Name of the assembly',
    },
    aliases: {
      type: 'stringArray',
      defaultValue: [],
      description: 'Other possible names for the assembly',
    },
    // track configuration is an array of track config schemas. multiple
    // instances of a track can exist that use the same configuration
    tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
  }

  const BaseAssemblyConfigSchema = ConfigurationSchema(
    'BaseAssembly',
    baseConfigSchema,
    { actions },
  )

  const SequenceAssemblyConfigSchema = ConfigurationSchema(
    'SequenceAssembly',
    {
      ...baseConfigSchema,
      sequence:
        pluginManager.elementTypes.track.ReferenceSequenceTrack.configSchema,
    },
    { actions },
  )

  const RefNameAliasesAssemblyConfigSchema = ConfigurationSchema(
    'RefNameAliasesAssembly',
    {
      ...baseConfigSchema,
      refNameAliases: ConfigurationSchema('RefNameAliases', {
        adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      }),
    },
    { actions },
  )

  const AssemblyConfigSchema = ConfigurationSchema(
    'Assembly',
    {
      ...baseConfigSchema,
      sequence:
        pluginManager.elementTypes.track.ReferenceSequenceTrack.configSchema,
      refNameAliases: ConfigurationSchema('RefNameAliases', {
        adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      }),
    },
    { actions },
  )

  function dispatcher(snapshot) {
    const { sequence, refNameAliases } = snapshot
    if (sequence && refNameAliases) return AssemblyConfigSchema
    if (sequence) return SequenceAssemblyConfigSchema
    if (refNameAliases) return RefNameAliasesAssemblyConfigSchema
    return BaseAssemblyConfigSchema
  }

  return {
    assemblyConfigSchemas: [
      AssemblyConfigSchema,
      SequenceAssemblyConfigSchema,
      RefNameAliasesAssemblyConfigSchema,
      BaseAssemblyConfigSchema,
    ],
    dispatcher,
  }
}
