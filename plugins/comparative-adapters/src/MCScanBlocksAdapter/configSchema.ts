import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

// `uri` is the shorthand for the anchor `.blocks` file only; the per-column
// `bedLocations` array has no default naming convention, so it stays explicit.
export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        mcscanBlocksLocation: { uri: snap.uri, baseUri: snap.baseUri },
      }
    : snap
}

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
 * Somewhere that names no pair, such as the track shown in a plain linear
 * genome view or the "Linear synteny view" launcher asking what a
 * locus aligns to, gets every pair the track declares at once, one set of links
 * per other genome. Group the display by mate assembly to read them as a lane
 * apiece.
 *
 * See the [ortholog tables tutorial](/docs/tutorials/multiway_synteny_grape_peach_cacao), which
 * covers building the table from jcvi, OrthoFinder, reciprocal best hits or
 * MCScanX, and stacking the genomes in one view.
 *
 * #gotcha `blockAssemblies` and `bedLocations` are positional against the
 * table's own columns, which is not necessarily the order `assemblyNames`
 * lists or the order the genomes were given to whatever wrote the table. Get
 * it wrong and every gene is looked up in another genome's BED; the track
 * fails with the column order named, rather than drawing empty. The table
 * carries no coordinates: a gene is placed by matching its id against column 4
 * of its column's BED, byte for byte. One column whose BED places none of its
 * ids fails the track naming that column, since the rest still resolve and
 * only the bands touching that genome would have been empty. BED column 1 has
 * to match the assembly's reference sequence names, which is the one mismatch
 * that still draws nothing rather than erroring.
 *
 * #example
 * `uri` is the shorthand for the anchor `.blocks` file:
 * ```js
 * {
 *   type: 'MCScanBlocksAdapter',
 *   uri: 'grape.blocks',
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
     * location of the `.blocks` table: column 0 is a reference gene and each
     * further column is that gene's ortholog in another genome, `.` where there
     * is none. `blockAssemblies` names the columns and `bedLocations` resolves
     * each column's gene names to coordinates.
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
     * (column 0 is the reference). A genome may hold several columns, which is
     * what `jcvi mcscan` writes above `--iter=1` (a column per chain of synteny
     * blocks, so a duplicated region is a further column of the same genome)
     * and what a self-comparison is; every column of a genome is drawn, so a
     * gene with two copies in its mate draws a link to each
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
     * blockAssemblies. A genome spanning several columns is named once here,
     * not once per column
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
    },
    /**
     * #slot
     * names for the numeric columns that follow the gene columns, in order, so
     * an ortholog table can carry per-link measurements the format itself has
     * no place for: `["identity", "dn", "ds", "goc_score"]` reads column N as
     * `identity` where N is `blockAssemblies.length`. Each becomes a feature
     * attribute, so it shows in the detail panel, and `dn`/`ds` are what the
     * synteny view's `Color by → dN/dS` reads. A cell of `.`, `NA`, `NULL`,
     * empty or anything non-numeric is a missing value rather than a zero.
     *
     * These describe the ROW. On a two-genome table a row is one link, which is
     * what makes a per-link measurement meaningful; on an N-genome table a row
     * is an orthogroup spanning several pairs, so only a value that describes
     * the whole group belongs there
     */
    attributeColumns: {
      type: 'stringArray',
      defaultValue: [],
    },
  },
  { explicitlyTyped: true, preProcessSnapshot: normalizeSnapshot },
)

export type MCScanBlocksAdapterConfig = Instance<typeof MCScanBlocksAdapter>

export default MCScanBlocksAdapter
