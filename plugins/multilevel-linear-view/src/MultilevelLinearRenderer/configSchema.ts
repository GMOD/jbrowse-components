import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'MultilevelLinearRenderer',
  {
    color: {
      type: 'color',
      description: 'the color of each feature in a multilevel',
      defaultValue: 'rgb(255,100,100,0.3)',
    },
  },
  { explicitlyTyped: true },
)
