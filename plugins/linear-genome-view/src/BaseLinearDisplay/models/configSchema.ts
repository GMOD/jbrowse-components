import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config BaseLinearDisplay
 * #category display
 * `BaseLinearDisplay` is a "base" config that is extended by classes like
 * `LinearBasicDisplay` (used for feature tracks, etc) and `LinearBareDisplay`
 * (more stripped down than even the basic display, not commonly used)
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const baseLinearDisplayConfigSchema = ConfigurationSchema(
  'BaseLinearDisplay',
  {
    /**
     * #slot
     */
    fetchSizeLimit: {
      defaultValue: 1_000_000,
      description:
        "maximum data to attempt to download for a given track, used if adapter doesn't specify one",
      type: 'number',
    },

    /**
     * #slot
     */
    height: {
      defaultValue: 100,
      description: 'default height for the track',
      type: 'number',
    },

    /**
     * #slot
     */
    maxFeatureScreenDensity: {
      defaultValue: 0.3,
      description:
        'maximum features per pixel that is displayed in the view, used if byte size estimates not available',
      type: 'number',
    },
    /**
     * #slot
     */
    mouseover: {
      contextVariable: ['feature'],
      defaultValue: `jexl:get(feature,'name')`,
      description: 'text to display when the cursor hovers over a feature',

      type: 'string',
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
