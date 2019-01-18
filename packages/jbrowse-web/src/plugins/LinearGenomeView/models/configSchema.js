import { ConfigurationSchema } from '../../../configuration'

export default ConfigurationSchema(
  'LinearGenomeView',
  {
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
