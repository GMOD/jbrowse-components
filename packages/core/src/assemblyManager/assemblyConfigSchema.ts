import { ConfigurationSchema } from '../configuration/index.ts'

import type PluginManager from '../PluginManager.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config BaseAssembly
 * #category assemblyManagement
 * This corresponds to the assemblies section of the config
 *
 * #example
 * A hand-authored assembly. `sequence` is a `ReferenceSequenceTrack` whose
 * adapter points at an indexed FASTA — the `uri` shorthand auto-resolves the
 * companion `.fai`/`.gzi` index files:
 * ```js
 * {
 *   name: 'hg38',
 *   aliases: ['GRCh38'],
 *   sequence: {
 *     type: 'ReferenceSequenceTrack',
 *     trackId: 'hg38-ref',
 *     adapter: {
 *       type: 'BgzipFastaAdapter',
 *       uri: 'https://example.com/hg38.fa.gz',
 *     },
 *   },
 * }
 * ```
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
      sequence: pluginManager.getTrackType('ReferenceSequenceTrack')
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

      /**
       * #slot
       * Maps a reference sequence name to an NCBI genetic-code (translation
       * table) id for sequences that don't use the standard code, e.g.
       * `{ "chrM": 2 }` for the vertebrate mitochondrial code or
       * `{ "chrPltd": 11 }` for a plastid. Drives the reference sequence track's
       * translation rows; unlisted refNames use the standard code (1). CDS-level
       * translation reads the GFF `transl_table` attribute directly and ignores
       * this.
       */
      geneticCodes: {
        type: 'frozen',
        defaultValue: {},
        description:
          'Map of reference sequence name to NCBI genetic-code (translation table) id for sequences not using the standard code, e.g. { "chrM": 2 }',
      },

      /**
       * #slot
       * Optional file (tab-separated `refName<TAB>geneticCodeId`, `#` comments
       * allowed) to load the same refName-to-genetic-code mapping from, instead
       * of inlining it — useful when a config generator emits a sidecar rather
       * than inlining per assembly. Entries in the inline `geneticCodes` slot
       * take precedence over the file.
       */
      geneticCodesLocation: {
        type: 'fileLocation',
        defaultValue: { uri: '', locationType: 'UriLocation' },
        description:
          'Optional TSV file of refName<TAB>geneticCodeId, an alternative to inlining the geneticCodes map',
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
       * there is no separate "id" field on an assembly: the "name" is the id,
       * usually a short machine-readable string like hg38. For a longer
       * human-readable label, set the "displayName" config slot instead
       */
      explicitIdentifier: 'name',
    },
  )
}

export default assemblyConfigSchema

/** the assembly config schema IType (use with `getConf`, `ConfigurationReference`, etc.) */
export type BaseAssemblyConfigSchema = ReturnType<typeof assemblyConfigSchema>

/** a resolved assembly config instance, i.e. `Instance<BaseAssemblyConfigSchema>` */
export type BaseAssemblyConfigModel = Instance<BaseAssemblyConfigSchema>
