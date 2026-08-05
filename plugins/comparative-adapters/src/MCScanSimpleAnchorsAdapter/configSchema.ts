import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config MCScanSimpleAnchorsAdapter
 * #trackType SyntenyTrack
 * #fileFormat synteny | MCScan simple anchors | Gene-level synteny; also needs one BED per assembly
 * used to load MCScan (jcvi) `.anchors.simple` files with their two BED files
 *
 * See the [MCScan anchors tutorial](/docs/tutorials/mcscan_synteny), which
 * also covers converting an MCScanX run into these files.
 *
 * #example
 * ```js
 * {
 *   type: 'MCScanSimpleAnchorsAdapter',
 *   uri: 'https://example.com/data.anchors.simple',
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
        mcscanSimpleAnchorsLocation: {
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

const MCScanSimpleAnchorsAdapter = ConfigurationSchema(
  'MCScanSimpleAnchorsAdapter',
  {
    /**
     * #slot
     * location of the `.anchors.simple` file from
     * `python -m jcvi.compara.synteny screen --simple`: one line per synteny
     * block, giving only the first and last gene of the block in each genome.
     * That draws whole blocks rather than the per-gene links a full `.anchors`
     * file gives.
     */
    mcscanSimpleAnchorsLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/mcscan.anchors.simple',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     * BED giving coordinates for the query assembly's gene names — the first
     * two columns of each block line. Written by
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
     * BED giving coordinates for the target assembly's gene names — the third
     * and fourth columns of each block line.
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
     * `bed2Location` describes. Getting the order backwards draws every block
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
     *   "type": "MCScanSimpleAnchorsAdapter",
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
export type MCScanSimpleAnchorsAdapterConfig = Instance<
  typeof MCScanSimpleAnchorsAdapter
>

export default MCScanSimpleAnchorsAdapter
