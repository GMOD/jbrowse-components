import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'SNPCoverageRenderer',
  {
    clipColor: {
      type: 'color',
      description: 'the color of the clipping marker',
      defaultValue: 'red',
    },
  },
  { explicitlyTyped: true },
)
