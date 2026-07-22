import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config MCScanAnchorsAdapter
 * #trackType SyntenyTrack
 * #fileFormat synteny | MCScan anchors | Gene-level synteny; also needs one BED per assembly
 * used to load MCScan (jcvi) `.anchors` files with their two BED files
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
