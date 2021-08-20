import { SnapshotIn } from 'mobx-state-tree'
import { ConfigurationSchema } from '../configuration'
import PluginManager from '../PluginManager'

export default (pluginManager: PluginManager) => {
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
      refNameColors: {
        type: 'stringArray',
        defaultValue: [],
        description:
          'Define custom colors for each reference sequence. Will cycle through this list if there are not enough colors for every sequence.',
      },
      displayName: {
        type: 'string',
        defaultValue: '',
        description:
          'A human readable display name if e.g. "Homo sapiens (hg38)" while the name is more often like an ID e.g. hg38',
      },
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

  function dispatcher(
    snapshot:
      | SnapshotIn<typeof BaseAssemblyConfigSchema>
      | SnapshotIn<typeof AssemblyConfigSchema>,
  ) {
    if (!snapshot) {
      return BaseAssemblyConfigSchema
    }
    const { refNameAliases } = snapshot
    if (refNameAliases) {
      return AssemblyConfigSchema
    }
    return BaseAssemblyConfigSchema
  }

  return {
    assemblyConfigSchemas: [AssemblyConfigSchema, BaseAssemblyConfigSchema],
    dispatcher,
  }
}
