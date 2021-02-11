import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'SNPCoverageRenderer',
  {
    clipColor: {
      type: 'color',
      description: 'the color of the clipping marker',
      defaultValue: 'red',
    },
    indicatorThreshold: {
      type: 'number',
      description:
        'the proportion of reads containing a insertion/clip indicator',
      defaultValue: 0.15,
    },
  },
  { explicitlyTyped: true },
)
