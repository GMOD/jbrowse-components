import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export default function (pluginManager) {
  const BaseAssemblyConfigSchema = ConfigurationSchema(
    'BaseAssembly',
    {
      aliases: {
        type: 'stringArray',
        defaultValue: [],
        description: 'Other possible names for the assembly',
      },
      sequence: pluginManager.getTrackType('ReferenceSequenceTrack')
        .configSchema,
    },
    { explicitIdentifier: 'name' },
  )

  const AssemblyConfigSchema = ConfigurationSchema(
    'Assembly',
    {
      refNameAliases: ConfigurationSchema('RefNameAliases', {
        adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      }),
    },
    { baseConfiguration: BaseAssemblyConfigSchema },
  )

  function dispatcher(snapshot) {
    if (!snapshot) return BaseAssemblyConfigSchema
    const { refNameAliases } = snapshot
    if (refNameAliases) return AssemblyConfigSchema
    return BaseAssemblyConfigSchema
  }

  return {
    assemblyConfigSchemas: [AssemblyConfigSchema, BaseAssemblyConfigSchema],
    dispatcher,
  }
}
