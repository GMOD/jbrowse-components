import { ConfigurationSchema } from '@jbrowse/core/configuration'

const baseChordDisplayConfig = ConfigurationSchema(
  'BaseChordDisplay',
  {
    onChordClick: {
      type: 'boolean',
      description:
        'callback that should be run when a chord in the track is clicked',
      defaultValue: false,
      contextVariable: ['feature', 'track', 'pluginManager'],
    },
  },
  { explicitIdentifier: 'displayId' },
)

export { baseChordDisplayConfig }
