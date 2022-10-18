import { ConfigurationSchema } from '../configuration'
import PluginManager from '../PluginManager'

/**
 * !config BaseAssembly
 */
const assemblyConfigSchema = (pluginManager: PluginManager) => {
  return ConfigurationSchema(
    'BaseAssembly',
    {
      /**
       * !slot
       */
      aliases: {
        type: 'stringArray',
        defaultValue: [],
        description: 'Other possible names for the assembly',
      },

      /**
       * !slot
       */
      sequence: pluginManager.getTrackType('ReferenceSequenceTrack')
        .configSchema,

      /**
       * !slot
       */
      refNameColors: {
        type: 'stringArray',
        defaultValue: [],
        description:
          'Define custom colors for each reference sequence. Will cycle through this list if there are not enough colors for every sequence.',
      },

      refNameAliases: ConfigurationSchema(
        'RefNameAliases',
        {
          /**
           * !slot refNameAliases.adapter
           */
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
          /**
           * !slot cytobands.adapter
           */
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

      /**
       * !slot
       */
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

export default assemblyConfigSchema
