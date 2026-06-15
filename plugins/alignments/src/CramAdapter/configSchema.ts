import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config CramAdapter
 * used to configure CRAM adapter
 *
 * Note: `sequenceAdapter` does **not** need to be specified manually — JBrowse
 * automatically supplies it from the enclosing assembly's sequence track.
 *
 * #example
 * The `uri` shorthand auto-resolves the `.crai` index:
 * ```js
 * {
 *   type: 'CramAdapter',
 *   uri: 'https://example.com/sample.cram',
 * }
 * ```
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        cramLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
        craiLocation: {
          uri: `${snap.uri}.crai`,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

const configSchema = ConfigurationSchema(
  'CramAdapter',
  {
    /**
     * #slot fetchSizeLimit
     */
    fetchSizeLimit: {
      type: 'number',
      description:
        'size in bytes over which to display a warning to the user that too much data will be fetched',
      defaultValue: 3_000_000,
      advanced: true,
    },

    /**
     * #slot cramLocation
     */
    cramLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.cram',
        locationType: 'UriLocation',
      },
    },

    /**
     * #slot craiLocation
     */
    craiLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.cram.crai',
        locationType: 'UriLocation',
      },
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     * preprocessor to allow minimal config, assumes yourfile.cram.crai:
     *
     * ```json
     * {
     *   "type": "CramAdapter",
     *   "uri": "yourfile.cram"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)
export type CramAdapterConfig = Instance<typeof configSchema>
export default configSchema
