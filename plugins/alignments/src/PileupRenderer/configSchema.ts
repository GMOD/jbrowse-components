import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

export default ConfigurationSchema(
  'PileupRenderer',
  {
    color: {
      type: 'color',
      description: 'the color of each feature in a pileup alignment',
      defaultValue: `#c8c8c8`,
      contextVariable: ['feature'],
    },

    orientationType: {
      type: 'stringEnum',
      model: types.enumeration('orientationType', ['fr', 'rf', 'ff']),
      defaultValue: 'fr',
      description:
        'read sequencer orienation. fr is normal "reads pointing at each other ---> <--- while some other sequencers can use other options',
    },
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
    minSubfeatureWidth: {
      type: 'number',
      description:
        'the minimum width in px for a pileup mismatch feature. use for increasing mismatch marker widths when zoomed out to e.g. 1px or 0.5px',
      defaultValue: 0,
    },
    maxHeight: {
      type: 'integer',
      description: 'the maximum height to be used in a pileup rendering',
      defaultValue: 1200,
    },
    maxClippingSize: {
      type: 'integer',
      description: 'the max clip size to be used in a pileup rendering',
      defaultValue: 10000,
    },
    height: {
      type: 'number',
      description: 'the height of each feature in a pileup alignment',
      defaultValue: 7,
      contextVariable: ['feature'],
    },
    noSpacing: {
      type: 'boolean',
      description: 'remove spacing between features',
      defaultValue: false,
    },
    largeInsertionIndicatorScale: {
      type: 'number',
      description:
        'scale at which to draw the large insertion indicators (bp/pixel)',
      defaultValue: 10,
    },
    mismatchAlpha: {
      type: 'boolean',
      defaultValue: false,
      description: 'Fade low quality mismatches',
    },
  },
  { explicitlyTyped: true },
)
