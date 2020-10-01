import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { types } from 'mobx-state-tree'

export default ConfigurationSchema(
  'PileupRenderer',
  {
    color: {
      type: 'color',
      description: 'the color of each feature in a pileup alignment',
      defaultValue: `function(feature) {
  return '#c8c8c8'
}`,
      functionSignature: ['feature'],
    },
    maxInsertSize: {
      type: 'number',
      defaultValue: 5000,
      description: 'size to expand for insert size',
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
      defaultValue: 600,
    },
    maxClippingSize: {
      type: 'integer',
      description: 'the max clip size to be used in a pileup rendering',
      defaultValue: 10000,
    },
    height: {
      type: 'integer',
      description: 'the height of each feature in a pileup alignment',
      defaultValue: 7,
      functionSignature: ['feature'],
    },
  },
  { explicitlyTyped: true },
)
