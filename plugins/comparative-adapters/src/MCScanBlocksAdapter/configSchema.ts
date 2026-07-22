import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config MCScanBlocksAdapter
 * #trackType SyntenyTrack
 * #fileFormat synteny | MCScan blocks | Multi-genome, reference-anchored; also needs one BED per assembly
 * Loads a multi-genome MCScan (jcvi) `.blocks` file: a reference-anchored,
 * tab-delimited table where column 0 is a reference gene and each further
 * column is that gene's ortholog in another genome (`.` = no ortholog),
 * produced by `jcvi.compara.synteny mcscan` + `jcvi.formats.base join`.
 *
 * A `.blocks` file describes N genomes at once, so one track backs every band of
 * a multi-way view: list all the genomes in `assemblyNames` and the synteny view
 * tells the adapter which pair each band draws, deriving that pair's gene links
 * from the two matching columns. When neither column is the reference the link
 * is transitive (both orthologous to the same reference gene) rather than a
 * direct alignment. Listing just two assemblies pins the track to that pair.
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
 *   assemblyNames: ['grape', 'peach', 'cacao'],
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
     * the assemblies this track can render; list all of blockAssemblies to let
     * one track back every band of a multi-way view (the view picks each band's
     * pair), or just two to pin it to a single pair. Every entry must appear in
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
