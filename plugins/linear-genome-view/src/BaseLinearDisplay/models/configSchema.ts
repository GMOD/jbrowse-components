import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config BaseLinearDisplay
 * #category display
 *
 * `BaseLinearDisplay` is a "base" config that is extended by other configs including
 * - `LinearBasicDisplay` (used for feature tracks, etc)
 * - `LinearBareDisplay` (more stripped down than even the basic display, not
 *   commonly used)
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const baseLinearDisplayConfigSchema = ConfigurationSchema(
  'BaseLinearDisplay',
  {
    /**
     * #slot
     */
    maxFeatureScreenDensity: {
      type: 'number',
      description:
        'maximum features per pixel that is displayed in the view, used if byte size estimates not available',
      defaultValue: 0.3,
    },
    /**
     * #slot
     */
    fetchSizeLimit: {
      type: 'number',
      defaultValue: 1_000_000,
      description:
        "maximum data to attempt to download for a given track, used if adapter doesn't specify one",
    },
    /**
     * #slot
     */
    height: {
      type: 'number',
      defaultValue: 100,
      description: 'default height for the track',
    },
    /**
     * #slot
     */
    mouseover: {
      type: 'string',
      description: 'text to display when the cursor hovers over a feature',
      defaultValue: `jexl:get(feature,'name')`,

      contextVariable: ['feature'],
    },
    /**
     * #slot
     * config jexlFilters are deferred evaluated so they are prepended with
     * jexl at runtime rather than being stored with jexl in the config
     */
    jexlFilters: {
      type: 'stringArray',
      description:
        'default set of jexl filters to apply to a track. note: these do not use the jexl prefix because they have a deferred evaluation system',
      defaultValue: [],
    },
  },
  {
    /**
     * #identifier
     */
    explicitIdentifier: 'displayId',
  },
)

export default baseLinearDisplayConfigSchema
