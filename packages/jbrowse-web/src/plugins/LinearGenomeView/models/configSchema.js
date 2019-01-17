import { ConfigurationSchema } from '../../../configuration'

export default ConfigurationSchema(
  'LinearGenomeView',
  {
    backgroundColor: { type: 'color', defaultValue: '#eee' },
    trackSelectorType: {
      type: 'string',
      defaultValue: 'hierarchical',
    },
    // defaultDisplayRegions: {
    //   type: 'frozenArray',
    //   defaultValue: [],
    // },
  },
  { singleton: true },
)
