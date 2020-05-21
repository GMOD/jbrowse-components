import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export default ConfigurationSchema(
  'LinearSyntenyRenderer',
  {
    color: {
      type: 'color',
      description: 'the color of each feature in a synteny',
      defaultValue: 'rgb(255,100,100,0.3)',
    },
  },
  { explicitlyTyped: true },
)
