import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config ChromSizesAdapter
 * #trackType ReferenceSequenceTrack
 * loads only chromosome names and lengths from a UCSC-style `.chrom.sizes` file
 * (tab-separated `name<TAB>length`), with no actual sequence. Useful for
 * karyotype or whole-genome/synteny views where the base-level sequence isn't
 * needed.
 *
 * #example
 * ```js
 * {
 *   type: 'ChromSizesAdapter',
 *   uri: 'https://example.com/species.chrom.sizes',
 * }
 * ```
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        chromSizesLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

const ChromSizesAdapter = ConfigurationSchema(
  'ChromSizesAdapter',
  {
    /**
     * #slot
     */
    chromSizesLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/species.chrom.sizes',
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
     * ```json
     * {
     *   "type": "ChromSizesAdapter",
     *   "uri": "yourfile.chrom.sizes"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export default ChromSizesAdapter
