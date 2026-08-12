import { ConfigurationSchema } from '../../configuration/index.ts'

/**
 * #config CytobandAdapter
 *
 * #example
 * Goes on an ASSEMBLY, under `cytobands` — not on a track. It draws the
 * ideogram banding in the linear genome view's overview bar:
 * ```js
 * {
 *   name: 'hg38',
 *   sequence: {
 *     type: 'ReferenceSequenceTrack',
 *     trackId: 'hg38-ReferenceSequenceTrack',
 *     adapter: {
 *       type: 'BgzipFastaAdapter',
 *       uri: 'https://example.com/hg38.fa.gz',
 *     },
 *   },
 *   cytobands: {
 *     adapter: {
 *       type: 'CytobandAdapter',
 *       uri: 'https://example.com/hg38.cytoBand.txt.gz',
 *     },
 *   },
 * }
 * ```
 */

const configSchema = ConfigurationSchema(
  'CytobandAdapter',
  {
    /**
     * #slot
     * location of a UCSC-style `cytoBand.txt` (`chrom start end name
     * gieStain`), which draws the ideogram banding in the view's overview bar.
     * May be gzipped. Configured on an assembly, not on a track.
     */
    cytobandLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/cytoband.txt.gz',
      },
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
     *   "type": "CytobandAdapter",
     *   "uri": "yourfile.bed"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      // populate from just snap.uri
      return snap.uri
        ? {
            ...snap,
            cytobandLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)

export default configSchema
