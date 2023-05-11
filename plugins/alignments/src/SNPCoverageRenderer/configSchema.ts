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
      type: 'color',
      description: 'the color of the clipping marker',
      defaultValue: 'red',
    },
    /**
     * #slot
     */
    indicatorThreshold: {
      type: 'number',
      description:
        'the proportion of reads containing a insertion/clip indicator',
      defaultValue: 0.4,
    },
    /**
     * #slot
     */
    drawArcs: {
      type: 'boolean',
      description: 'Draw sashimi-style arcs for intron features',
      defaultValue: true,
    },
    /**
     * #slot
     */
    drawInterbaseCounts: {
      type: 'boolean',
      description:
        'draw count "upsidedown histogram" of the interbase events that don\'t contribute to the coverage count so are not drawn in the normal histogram',
      defaultValue: true,
    },
    /**
     * #slot
     */
    drawIndicators: {
      type: 'boolean',
      description:
        'draw a triangular indicator where an event has been detected',
      defaultValue: true,
    },

    color: {
      type: 'color',
      description: 'Background color for the SNPCoverage renderer',
      defaultValue: '#d3d3d3',
    },
  },
  { explicitlyTyped: true },
)

export default SNPCoverageRenderer
