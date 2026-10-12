import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config FromConfigAdapter
 * #trackType FeatureTrack
 * #fileFormat inline | Inline features | Features written straight into config.json
 * Supplies features written inline in the config, for a small feature set
 * added through a URL or session spec.
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
     * the features themselves, as an array of plain objects. Each needs a
     * `uniqueId`, `refName`, `start` and `end` (0-based half-open); anything
     * else — `name`, `type`, `score`, `strand`, nested `subfeatures` — is
     * carried through onto the feature as-is.
     */
    features: {
      type: 'frozen',
      defaultValue: [],
    },
  },
  // v1 named the feature class the adapter built
  {
    explicitlyTyped: true,
    closed: true,
    retired: { featureClass: () => ({}) },
  },
)

export default configSchema
