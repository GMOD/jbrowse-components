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
      type: 'color',
      description: 'the color of each feature in a pileup alignment',
      defaultValue: '#f0f',
      contextVariable: ['feature'],
    },

    /**
     * #slot
     */
    orientationType: {
      type: 'stringEnum',
      model: types.enumeration('orientationType', ['fr', 'rf', 'ff']),
      defaultValue: 'fr',
      description:
        'read sequencer orientation. fr is normal "reads pointing at each other ---> <--- while some other sequencers can use other options',
    },
    /**
     * #slot
     */
    displayMode: {
      type: 'stringEnum',
      model: types.enumeration('displayMode', [
        'normal',
        'compact',
        'collapse',
      ]),
      description: 'Alternative display modes',
      defaultValue: 'normal',
    },
    /**
     * #slot
     */
    minSubfeatureWidth: {
      type: 'number',
      description:
        'the minimum width in px for a pileup mismatch feature. use for increasing/decreasing mismatch marker widths when zoomed out, e.g. 0 or 1',
      defaultValue: 1,
    },
    /**
     * #slot
     */
    maxHeight: {
      type: 'integer',
      description: 'the maximum height to be used in a pileup rendering',
      defaultValue: 1200,
    },
    /**
     * #slot
     */
    maxClippingSize: {
      type: 'integer',
      description: 'the max clip size to be used in a pileup rendering',
      defaultValue: 10000,
    },
    /**
     * #slot
     */
    height: {
      type: 'number',
      description: 'the height of each feature in a pileup alignment',
      defaultValue: 7,
      contextVariable: ['feature'],
    },
    /**
     * #slot
     */
    noSpacing: {
      type: 'boolean',
      description: 'remove spacing between features',
      defaultValue: false,
    },
    /**
     * #slot
     */
    largeInsertionIndicatorScale: {
      type: 'number',
      description:
        'scale at which to draw the large insertion indicators (bp/pixel)',
      defaultValue: 10,
    },
    /**
     * #slot
     */
    mismatchAlpha: {
      type: 'boolean',
      defaultValue: false,
      description: 'Fade low quality mismatches',
    },
  },
  { explicitlyTyped: true },
)
export default PileupRenderer
