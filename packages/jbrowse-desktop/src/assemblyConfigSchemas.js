import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export default function(pluginManager) {
  const BaseAssemblyConfigSchema = ConfigurationSchema('BaseAssembly', {
    name: {
      type: 'string',
      defaultValue: '',
      description: 'Name of the assembly',
    },
    aliases: {
      type: 'stringArray',
      defaultValue: [],
      description: 'Other possible names for the assembly',
    },
  })

  const SequenceAssemblyConfigSchema = ConfigurationSchema(
    'SequenceAssembly',
    {
      sequence:
        pluginManager.elementTypes.track.ReferenceSequenceTrack.configSchema,
    },
    { baseConfiguration: BaseAssemblyConfigSchema },
  )

  const RefNameAliasesAssemblyConfigSchema = ConfigurationSchema(
    'RefNameAliasesAssembly',
    {
      refNameAliases: ConfigurationSchema('RefNameAliases', {
        adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      }),
    },
    { baseConfiguration: BaseAssemblyConfigSchema },
  )

  const AssemblyConfigSchema = ConfigurationSchema(
    'Assembly',
    {
      sequence:
        pluginManager.elementTypes.track.ReferenceSequenceTrack.configSchema,
      refNameAliases: ConfigurationSchema('RefNameAliases', {
        adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      }),
    },
    { baseConfiguration: BaseAssemblyConfigSchema },
  )

  function dispatcher(snapshot) {
    if (!snapshot) return BaseAssemblyConfigSchema
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
