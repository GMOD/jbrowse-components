import { ConfigurationSchema } from '../../../configuration'

export default ConfigurationSchema('LinearGenomeView', {
  reversed: {
    type: 'boolean',
    defaultValue: false,
    description: 'horizontally flip the view',
  },
  trackSelectorType: {
    type: 'string',
    defaultValue: 'hierarchical',
  },
})
