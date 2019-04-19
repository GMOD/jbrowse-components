import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

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
