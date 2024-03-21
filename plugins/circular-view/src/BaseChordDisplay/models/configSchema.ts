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
      contextVariable: ['feature', 'track', 'pluginManager'],
      defaultValue: false,
      description:
        'callback that should be run when a chord in the track is clicked',
      type: 'boolean',
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
