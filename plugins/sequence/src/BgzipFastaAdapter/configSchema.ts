import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { deriveFastaLocations } from '../chromSizesUtils.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        ...deriveFastaLocations(snap),
        gziLocation: {
          uri: `${snap.uri}.gzi`,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

/**
 * #config BgzipFastaAdapter
 * #trackType ReferenceSequenceTrack
 * #fileFormat sequence | Bgzipped FASTA (.fa.gz + .fai + .gzi)
 *
 * #example
 * The `uri` shorthand auto-resolves the `.fai` and `.gzi` indexes:
 * ```js
 * {
 *   type: 'BgzipFastaAdapter',
 *   uri: 'https://example.com/genome.fa.gz',
 * }
 * ```
 */
const BgzipFastaAdapter = ConfigurationSchema(
  'BgzipFastaAdapter',
  {
    /**
     * #slot
     * location of the bgzip-compressed FASTA. Must be bgzip rather than plain
     * gzip — `samtools faidx` cannot index the latter, and only bgzip supports
     * the per-block random access that keeps a base-level view to one range
     * request.
     */
    fastaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa.gz', locationType: 'UriLocation' },
    },
    /**
     * #slot
     * location of the `samtools faidx` index (`.fai`). It supplies the
     * reference names and lengths as well as the offsets into the uncompressed
     * sequence, so the assembly cannot load without it.
     */
    faiLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/seq.fa.gz.fai',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    metadataLocation: {
      description: 'Optional metadata file',
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/fa.metadata.yaml',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     * location of the bgzip block index (`.gzi`), written beside the `.fai` by
     * `samtools faidx` on a bgzipped FASTA. It maps uncompressed offsets to
     * compressed ones, which is what makes a range request possible at all.
     */
    gziLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/seq.fa.gz.gzi',
        locationType: 'UriLocation',
      },
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config, assumes yourfile.fa.fai and yourfile.fa.gzi:
     * ```json
     * {
     *   "type": "BgzipFastaAdapter",
     *   "uri": "yourfile.fa"
     * }
     * ```
     */

    preProcessSnapshot: normalizeSnapshot,
  },
)
export type BgzipFastaAdapterConfig = Instance<typeof BgzipFastaAdapter>
export default BgzipFastaAdapter
