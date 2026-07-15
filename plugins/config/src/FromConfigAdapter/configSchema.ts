import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config FromConfigAdapter
 * supplies features inline in the config instead of reading a file, useful for
 * small feature sets added via a URL or session spec
 *
 * #example
 * ```js
 * {
 *   type: 'FromConfigAdapter',
 *   features: [
 *     { uniqueId: 'f1', refName: 'ctgA', start: 100, end: 200, name: 'feature1' },
 *   ],
 * }
 * ```
 */

const configSchema = ConfigurationSchema(
  'FromConfigAdapter',
  {
    /**
     * #slot
     * stable identifier used as the adapter cache key; avoids hashing the
     * (potentially large) features array. optional — falls back to hash.
     */
    adapterId: {
      type: 'string',
      defaultValue: '',
    },
    /**
     * #slot
     */
    features: {
      type: 'frozen',
      defaultValue: [],
    },
  },
  { explicitlyTyped: true },
)

export default configSchema
