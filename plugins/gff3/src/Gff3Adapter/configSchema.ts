import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        gffLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

/**
 * #config Gff3Adapter
 * #category adapter
 * #trackType FeatureTrack
 * #fileFormat feature | GFF3 (plain) | Loaded entirely into memory; for small files
 * used to load plain-text GFF3 files. Loads the whole file into memory, so
 * prefer the Gff3TabixAdapter for large files.
 *
 * #example
 * ```js
 * {
 *   type: 'Gff3Adapter',
 *   uri: 'https://example.com/genes.gff3',
 * }
 * ```
 */
const Gff3Adapter = ConfigurationSchema(
  'Gff3Adapter',
  {
    /**
     * #slot
     * location of the GFF3 file. May be gzipped; it is decompressed and parsed
     * in full on first use, so the file has to fit in memory.
     */
    gffLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.gff',
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
     * preprocessor to allow minimal config:
     *
     * ```json
     * {
     *   "type": "Gff3Adapter",
     *   "uri": "yourfile.gff3",
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type Gff3AdapterConfig = Instance<typeof Gff3Adapter>

export default Gff3Adapter
