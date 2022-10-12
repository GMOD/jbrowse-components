import { ConfigurationSchema } from '../configuration'
import PluginManager from '../PluginManager'

export default (pluginManager: PluginManager) => {
  return ConfigurationSchema(
    'BaseAssembly',
    {
      aliases: {
        type: 'stringArray',
        defaultValue: [],
        description: 'Other possible names for the assembly',
      },
      sequence: pluginManager.getTrackType('ReferenceSequenceTrack')
        .configSchema,
      refNameAliases: ConfigurationSchema(
        'RefNameAliases',
        {
          adapter: pluginManager.pluggableConfigSchemaType('adapter'),
        },
        {
          preProcessSnapshot: snap => {
            // allow refNameAliases to be unspecified
            // @ts-ignore
            if (!snap.adapter) {
              return { adapter: { type: 'RefNameAliasAdapter' } }
            }
            return snap
          },
        },
      ),
      cytobands: ConfigurationSchema(
        'Cytoband',
        {
          adapter: pluginManager.pluggableConfigSchemaType('adapter'),
        },
        {
          preProcessSnapshot: snap => {
            // allow cytoBand to be unspecified
            // @ts-ignore
            if (!snap.adapter) {
              return { adapter: { type: 'CytobandAdapter' } }
            }
            return snap
          },
        },
      ),
      displayName: {
        type: 'string',
        defaultValue: '',
        description:
          'A human readable display name for the assembly e.g. "Homo sapiens (hg38)" while the assembly name may just be "hg38"',
      },
    },
    {
      explicitIdentifier: 'name',
    },
  )
}
