import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

/**
 * #config PileupRenderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const PileupRenderer = ConfigurationSchema(
  'PileupRenderer',
  {
    /**
     * #slot
     * default magenta here is used to detect the user has not customized this
     */
    color: {
      contextVariable: ['feature'],
      defaultValue: '#f0f',
      description: 'the color of each feature in a pileup alignment',
      type: 'color',
    },

    /**
     * #slot
     */
    displayMode: {
      defaultValue: 'normal',
      description: 'Alternative display modes',
      model: types.enumeration('displayMode', [
        'normal',
        'compact',
        'collapse',
      ]),
      type: 'stringEnum',
    },

    /**
     * #slot
     */
    height: {
      contextVariable: ['feature'],
      defaultValue: 7,
      description: 'the height of each feature in a pileup alignment',
      type: 'number',
    },

    /**
     * #slot
     */
    largeInsertionIndicatorScale: {
      defaultValue: 10,
      description:
        'scale at which to draw the large insertion indicators (bp/pixel)',
      type: 'number',
    },

    /**
     * #slot
     */
    maxClippingSize: {
      defaultValue: 10000,
      description: 'the max clip size to be used in a pileup rendering',
      type: 'integer',
    },

    /**
     * #slot
     */
    maxHeight: {
      defaultValue: 1200,
      description: 'the maximum height to be used in a pileup rendering',
      type: 'integer',
    },

    /**
     * #slot
     */
    minSubfeatureWidth: {
      defaultValue: 1,
      description:
        'the minimum width in px for a pileup mismatch feature. use for increasing/decreasing mismatch marker widths when zoomed out, e.g. 0 or 1',
      type: 'number',
    },

    /**
     * #slot
     */
    mismatchAlpha: {
      defaultValue: false,
      description: 'Fade low quality mismatches',
      type: 'boolean',
    },

    /**
     * #slot
     */
    noSpacing: {
      defaultValue: false,
      description: 'remove spacing between features',
      type: 'boolean',
    },

    /**
     * #slot
     */
    orientationType: {
      defaultValue: 'fr',
      description:
        'read sequencer orientation. fr is normal "reads pointing at each other ---> <--- while some other sequencers can use other options',
      model: types.enumeration('orientationType', ['fr', 'rf', 'ff']),
      type: 'stringEnum',
    },
  },
  { explicitlyTyped: true },
)
export default PileupRenderer
