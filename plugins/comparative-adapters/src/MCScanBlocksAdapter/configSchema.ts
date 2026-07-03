import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config MCScanBlocksAdapter
 * #trackType SyntenyTrack
 * Loads a multi-genome MCScan (jcvi) `.blocks` file: a reference-anchored,
 * tab-delimited table where column 0 is a reference gene and each further
 * column is that gene's ortholog in another genome (`.` = no ortholog),
 * produced by `jcvi.compara.synteny mcscan` + `jcvi.formats.base join`.
 *
 * A `.blocks` file describes N genomes at once, but a synteny track draws one
 * pair, so the same file backs the N-1 tracks of a multi-way view: each track
 * sets `assemblyNames` to the pair it renders and the adapter derives that
 * pair's gene links from the two matching columns. When neither column is the
 * reference the link is transitive (both orthologous to the same reference
 * gene) rather than a direct alignment.
 *
 * #example
 * ```js
 * {
 *   type: 'MCScanBlocksAdapter',
 *   mcscanBlocksLocation: { uri: 'grape.blocks' },
 *   blockAssemblies: ['grape', 'peach', 'cacao'],
 *   bedLocations: [
 *     { uri: 'grape.bed' },
 *     { uri: 'peach.bed' },
 *     { uri: 'cacao.bed' },
 *   ],
 *   assemblyNames: ['grape', 'peach'],
 * }
 * ```
 */
const MCScanBlocksAdapter = ConfigurationSchema(
  'MCScanBlocksAdapter',
  {
    /**
     * #slot
     */
    mcscanBlocksLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/mcscan.blocks',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     * one assembly name per column of the blocks file, in column order
     * (column 0 is the reference)
     */
    blockAssemblies: {
      type: 'stringArray',
      defaultValue: [],
    },
    /**
     * #slot
     * one BED fileLocation per column of the blocks file, parallel to
     * blockAssemblies, resolving that column's gene ids to coordinates
     */
    bedLocations: {
      type: 'frozen',
      defaultValue: [],
    },
    /**
     * #slot
     * the pair of assemblies this track renders; both must appear in
     * blockAssemblies
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
    },
  },
  { explicitlyTyped: true },
)

export type MCScanBlocksAdapterConfig = Instance<typeof MCScanBlocksAdapter>

export default MCScanBlocksAdapter
