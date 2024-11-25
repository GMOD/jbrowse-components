import { ConfigurationSchema } from '../configuration'
import type PluginManager from '../PluginManager'

/**
 * #config BaseAssembly
 * #category assemblyManagement
 * This corresponds to the assemblies section of the config
 */
function assemblyConfigSchema(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'BaseAssembly',
    {
      /**
       * #slot
       * aliases are "reference name aliases" e.g. aliases for hg38 might be
       * "GRCh38"
       */
      aliases: {
        type: 'stringArray',
        defaultValue: [],
        description: 'Other possible names for the assembly',
      },

      /**
       * #slot
       * sequence refers to a reference sequence track that has an adapter
       * containing, importantly, a sequence adapter such as
       * IndexedFastaAdapter
       */
      sequence: pluginManager.getTrackType('ReferenceSequenceTrack')!
        .configSchema,

      /**
       * #slot
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
           * #slot refNameAliases.adapter
           * refNameAliases help resolve e.g. chr1 and 1 as the same entity the
           * data for refNameAliases are fetched from an adapter, that is
           * commonly a tsv like chromAliases.txt from UCSC or similar
           */
          adapter: pluginManager.pluggableConfigSchemaType('adapter'),
        },
        {
          preProcessSnapshot: snap => {
            // allow refNameAliases to be unspecified
            return !snap.adapter
              ? {
                  adapter: {
                    type: 'RefNameAliasAdapter',
                  },
                }
              : snap
          },
        },
      ),
      cytobands: ConfigurationSchema(
        'Cytoband',
        {
          /**
           * #slot cytobands.adapter
           * cytoband data is fetched from an adapter, and can be displayed by
           * a view type as ideograms
           */
          adapter: pluginManager.pluggableConfigSchemaType('adapter'),
        },
        {
          preProcessSnapshot: snap => {
            // allow cytoBand to be unspecified
            return !snap.adapter
              ? {
                  adapter: {
                    type: 'CytobandAdapter',
                  },
                }
              : snap
          },
        },
      ),

      /**
       * #slot
       */
      displayName: {
        type: 'string',
        defaultValue: '',
        description:
          'A human readable display name for the assembly e.g. "Homo sapiens (hg38)" while the assembly name may just be "hg38"',
      },
    },
    {
      /**
       * #identifier name
       * the name acts as a unique identifier in the config, so it cannot be
       * duplicated. it usually a short human readable "id" like hg38, but you
       * can also optionally customize the assembly "displayName" config slot
       */
      explicitIdentifier: 'name',
    },
  )
}

export default assemblyConfigSchema
export type BaseAssemblyConfigSchema = ReturnType<typeof assemblyConfigSchema>
