import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config BaseChordDisplay
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const baseChordDisplayConfig = ConfigurationSchema(
  'BaseChordDisplay',
  {
    /**
     * #slot
     */
    onChordClick: {
      type: 'boolean',
      description:
        'callback that should be run when a chord in the track is clicked',
      defaultValue: false,
      contextVariable: ['feature', 'track', 'pluginManager'],
    },
  },
  {
    /**
     * #identifier
     */
    explicitIdentifier: 'displayId',
  },
)

export { baseChordDisplayConfig }
