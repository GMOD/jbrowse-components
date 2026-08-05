import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config MCScanAnchorsAdapter
 * #trackType SyntenyTrack
 * #fileFormat synteny | MCScan anchors | Gene-level synteny; also needs one BED per assembly
 * used to load MCScan (jcvi) `.anchors` files with their two BED files
 *
 * See the [MCScan anchors tutorial](/docs/tutorials/mcscan_synteny), which
 * also covers converting an MCScanX run into these files.
 *
 * #example
 * ```js
 * {
 *   type: 'MCScanAnchorsAdapter',
 *   uri: 'https://example.com/data.anchors',
 *   bed1: 'https://example.com/query.bed',
 *   bed2: 'https://example.com/target.bed',
 *   assemblyNames: ['hg19', 'hg38'],
 * }
 * ```
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri && snap.bed1 && snap.bed2
    ? {
        ...snap,
        mcscanAnchorsLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
        bed1Location: {
          uri: snap.bed1,
          baseUri: snap.baseUri,
        },
        bed2Location: {
          uri: snap.bed2,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

const MCScanAnchorsAdapter = ConfigurationSchema(
  'MCScanAnchorsAdapter',
  {
    /**
     * #slot
     * location of the `.anchors` file from `python -m jcvi.compara.catalog
     * ortholog`: one line per anchor pair, naming a gene in each genome. The
     * gene names are resolved to coordinates through the two BED files.
     */
    mcscanAnchorsLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/mcscan.anchors',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     * BED giving coordinates for the gene names in the anchors file's first
     * column, i.e. the query assembly's genes. Written by
     * `python -m jcvi.formats.gff bed`.
     */
    bed1Location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.bed',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     * BED giving coordinates for the gene names in the anchors file's second
     * column, i.e. the target assembly's genes.
     */
    bed2Location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.bed',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     * `[query, target]` — the assembly `bed1Location` describes, then the one
     * `bed2Location` describes. Getting the order backwards draws every link
     * against the wrong genome rather than erroring.
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config:
     * ```json
     * {
     *   "type": "MCScanAnchorsAdapter",
     *   "uri": "file.anchors",
     *   "bed1": "bed1.bed",
     *   "bed2": "bed2.bed",
     *   "assemblyNames": ["hg19", "hg38"],
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type MCScanAnchorsAdapterConfig = Instance<typeof MCScanAnchorsAdapter>

export default MCScanAnchorsAdapter
