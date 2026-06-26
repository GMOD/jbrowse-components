import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config Gff3Adapter
 * #category adapter
 * #trackType FeatureTrack
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

const Gff3Adapter = ConfigurationSchema(
  'Gff3Adapter',
  {
    /**
     * #slot
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

export default Gff3Adapter
