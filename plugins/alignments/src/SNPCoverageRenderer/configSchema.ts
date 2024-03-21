import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config SNPCoverageRenderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const SNPCoverageRenderer = ConfigurationSchema(
  'SNPCoverageRenderer',
  {
    /**
     * #slot
     */
    clipColor: {
      defaultValue: 'red',
      description: 'the color of the clipping marker',
      type: 'color',
    },

    color: {
      defaultValue: '#d3d3d3',
      description: 'Background color for the SNPCoverage renderer',
      type: 'color',
    },

    /**
     * #slot
     */
    drawArcs: {
      defaultValue: true,
      description: 'Draw sashimi-style arcs for intron features',
      type: 'boolean',
    },

    /**
     * #slot
     */
    drawIndicators: {
      defaultValue: true,
      description:
        'draw a triangular indicator where an event has been detected',
      type: 'boolean',
    },

    /**
     * #slot
     */
    drawInterbaseCounts: {
      defaultValue: true,
      description:
        'draw count "upsidedown histogram" of the interbase events that don\'t contribute to the coverage count so are not drawn in the normal histogram',
      type: 'boolean',
    },

    /**
     * #slot
     */
    indicatorThreshold: {
      defaultValue: 0.4,
      description:
        'the proportion of reads containing a insertion/clip indicator',
      type: 'number',
    },
  },
  { explicitlyTyped: true },
)

export default SNPCoverageRenderer
