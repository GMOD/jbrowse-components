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
    drawInterbaseFuzz: {
      type: 'boolean',
      description:
        'draw fuzzy "upper histogram" of the interbase events that are not normally captured by the lower histogram',
      defaultValue: true,
    },
    drawIndicators: {
      type: 'boolean',
      description:
        'draw a triangular indicator where an event has been detected',
      defaultValue: true,
    },
  },
  { explicitlyTyped: true },
)
