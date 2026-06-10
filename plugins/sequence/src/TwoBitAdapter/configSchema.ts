import { ConfigurationSchema } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config TwoBitAdapter
 *
 * #example
 * A `.2bit` file is self-contained; add `chromSizes` to skip an initial
 * full-file scan on genomes with many contigs:
 * ```js
 * {
 *   type: 'TwoBitAdapter',
 *   uri: 'https://example.com/genome.2bit',
 * }
 * ```
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        twoBitLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
        ...(snap.chromSizes
          ? {
              chromSizesLocation: {
                uri: snap.chromSizes,
                baseUri: snap.baseUri,
              },
            }
          : {}),
      }
    : snap
}

const TwoBitAdapter = ConfigurationSchema(
  'TwoBitAdapter',
  {
    /**
     * #slot
     */
    twoBitLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.2bit',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    chromSizesLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/default.chrom.sizes',
        locationType: 'UriLocation',
      },
      description:
        'An optional chrom.sizes file can be supplied to speed up loading since parsing the twobit file can take time',
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config (note that adding chromSizes improves speed, otherwise has to read a lot of the twobit file to calculate chromosome names and sizes):
     *
     * ```json
     * {
     *   "type": "TwoBitAdapter",
     *   "uri": "yourfile.2bit"
     *   "chromSizes":"yourfile.chrom.sizes"
     * }
     *
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type TwoBitAdapterConfig = Instance<typeof TwoBitAdapter>
export default TwoBitAdapter
