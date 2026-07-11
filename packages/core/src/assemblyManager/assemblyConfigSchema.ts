import { expandAssemblySequenceAdapter } from './expandAssemblyConfigShorthand.ts'
import { ConfigurationSchema } from '../configuration/index.ts'

import type PluginManager from '../PluginManager.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

export { expandAssemblySequenceAdapter } from './expandAssemblyConfigShorthand.ts'

/**
 * #config BaseAssembly
 * #category assemblyManagement
 * This corresponds to the assemblies section of the config
 *
 * #example minimal
 * A hand-authored human assembly. `sequence` is a `ReferenceSequenceTrack` whose
 * adapter points at a bgzipped+indexed FASTA — the `uri` shorthand auto-resolves
 * the companion `.fai`/`.gzi` index files. `geneticCodes` translates the
 * mitochondrial contig with the vertebrate mitochondrial code (NCBI table 2):
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
 *   geneticCodes: { chrM: 2 },
 * }
 * ```
 *
 * #example shorthand-flat
 * The flattest form: an assembly is just a `name` and a sequence-file `uri`.
 * jbrowse-core picks the adapter (`Bgzip`/`Indexed`/`TwoBit`) from the
 * extension, derives the `.fai`/`.gzi` siblings, and fills in the
 * `ReferenceSequenceTrack`. `refNameAliases`/`cytobands` take the same bare
 * `{ uri }` shorthand. (Keep the `uri` *key* rather than a bare string so
 * relative URIs still resolve against the config's location.)
 * ```js
 * {
 *   name: 'hg38',
 *   uri: 'https://example.com/hg38.fa.gz',
 *   refNameAliases: { uri: 'https://example.com/hg38.aliases.txt' },
 *   cytobands: { uri: 'https://example.com/hg38.cytoBand.txt' },
 * }
 * ```
 *
 * #example shorthand-sequence
 * `sequence.type`/`sequence.trackId` are boilerplate that can be omitted —
 * they're always `'ReferenceSequenceTrack'` and a name derived from the
 * assembly `name` — leaving just the adapter (whose own `uri` shorthand still
 * infers the adapter type and index siblings):
 * ```js
 * {
 *   name: 'hg38',
 *   sequence: { adapter: { uri: 'https://example.com/hg38.fa.gz' } },
 * }
 * ```
 *
 * #example with-refname-aliases-and-cytobands
 * Adds `refNameAliases` (so `chr1` and `1` resolve to the same sequence) and
 * `cytobands` (ideogram banding), each fetched from its own adapter:
 * ```js
 * {
 *   name: 'hg38',
 *   sequence: {
 *     type: 'ReferenceSequenceTrack',
 *     trackId: 'hg38-ref',
 *     adapter: { type: 'BgzipFastaAdapter', uri: 'https://example.com/hg38.fa.gz' },
 *   },
 *   refNameAliases: {
 *     adapter: {
 *       type: 'RefNameAliasAdapter',
 *       location: { uri: 'https://example.com/hg38.aliases.txt' },
 *     },
 *   },
 *   cytobands: {
 *     adapter: {
 *       type: 'CytobandAdapter',
 *       cytobandLocation: { uri: 'https://example.com/hg38.cytoBand.txt' },
 *     },
 *   },
 * }
 * ```
 *
 * #example custom-display-name-and-genetic-codes-sidecar
 * Sets a `displayName` for the assembly selector and loads the per-refName
 * genetic codes from a sidecar TSV (`geneticCodesLocation`) instead of inlining
 * them — handy when a config generator emits the mapping separately:
 * ```js
 * {
 *   name: 'hg38',
 *   displayName: 'Homo sapiens (hg38)',
 *   sequence: {
 *     type: 'ReferenceSequenceTrack',
 *     trackId: 'hg38-ref',
 *     adapter: { type: 'BgzipFastaAdapter', uri: 'https://example.com/hg38.fa.gz' },
 *   },
 *   geneticCodesLocation: { uri: 'https://example.com/hg38.genetic_codes.tsv' },
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
       *
       * #example
       * Mitochondrial contig translated with the vertebrate mitochondrial code
       * (NCBI table 2), a plastid contig with table 11; keys are matched through
       * refName aliasing:
       * ```js
       * { chrM: 2, chrPltd: 11 }
       * ```
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
       *
       * #example
       * The TSV is `refName<TAB>geneticCodeId` with optional `#` comment lines:
       * ```js
       * { uri: 'https://example.com/hg38.genetic_codes.tsv' }
       * ```
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
          // the alias file is always a RefNameAliasAdapter, so both its type
          // and the `adapter` nesting are boilerplate: allow a bare
          // `refNameAliases: { uri: 'aliases.txt' }` (baseUri, stamped next to
          // the uri key by addRelativeUris, rides along). An explicit `adapter`
          // passes through untouched; absent, the empty default is filled in.
          preProcessSnapshot: snap =>
            snap.adapter
              ? snap
              : {
                  adapter: {
                    type: 'RefNameAliasAdapter',
                    ...(snap.uri
                      ? {
                          uri: snap.uri,
                          ...(snap.baseUri ? { baseUri: snap.baseUri } : {}),
                        }
                      : {}),
                  },
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
          // same shorthand as refNameAliases: `cytobands: { uri: 'cytoBand.txt' }`
          // fills in the CytobandAdapter; an explicit `adapter` passes through,
          // absent it defaults to the empty adapter.
          preProcessSnapshot: snap =>
            snap.adapter
              ? snap
              : {
                  adapter: {
                    type: 'CytobandAdapter',
                    ...(snap.uri
                      ? {
                          uri: snap.uri,
                          ...(snap.baseUri ? { baseUri: snap.baseUri } : {}),
                        }
                      : {}),
                  },
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
      preProcessSnapshot: snap => {
        const { name, uri, baseUri, ...rest } = snap
        // flattest shorthand: `{ name, uri: 'genome.fa.gz' }` describes an
        // assembly by its sequence file alone. baseUri, stamped next to the
        // `uri` key by addRelativeUris (hub/relative configs), rides down onto
        // the adapter so the sequence resolves against the config's location.
        const rawSequence =
          rest.sequence ??
          (typeof uri === 'string'
            ? { adapter: { uri, ...(baseUri ? { baseUri } : {}) } }
            : undefined)
        // infer sequence.adapter.type from its uri when omitted, so a config can
        // give just `sequence: { adapter: { uri: 'genome.fa.gz' } }` and core
        // picks the adapter (Bgzip/Indexed/TwoBit) — no adapter table in hosts
        const seq = expandAssemblySequenceAdapter(rawSequence, pluginManager)
        // then allow sequence.type/trackId to be omitted, since they are always
        // 'ReferenceSequenceTrack' and a name derived from the assembly name
        const sequence =
          seq && typeof seq === 'object' && !('type' in seq)
            ? {
                type: 'ReferenceSequenceTrack',
                trackId: `${name}-ReferenceSequenceTrack`,
                ...seq,
              }
            : seq
        // preserve the identity-unchanged case so nothing rebuilds needlessly
        return sequence === snap.sequence ? snap : { ...rest, name, sequence }
      },
    },
  )
}

export default assemblyConfigSchema

/** the assembly config schema IType (use with `getConf`, `ConfigurationReference`, etc.) */
export type BaseAssemblyConfigSchema = ReturnType<typeof assemblyConfigSchema>

/** a resolved assembly config instance, i.e. `Instance<BaseAssemblyConfigSchema>` */
export type BaseAssemblyConfigModel = Instance<BaseAssemblyConfigSchema>
