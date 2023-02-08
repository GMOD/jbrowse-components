import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config BaseLinearDisplay
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
  },
  {
    /**
     * #identifier
     */
    explicitIdentifier: 'displayId',
  },
)

export default baseLinearDisplayConfigSchema
