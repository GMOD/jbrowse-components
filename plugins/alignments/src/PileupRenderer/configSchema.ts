import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

export default ConfigurationSchema(
  'PileupRenderer',
  {
    color: {
      type: 'color',
      description: 'the color of each feature in a pileup alignment',
      defaultValue: `function(feature) {
  var s = feature.get('strand');
  return s === -1 ? '#8F8FD8': '#EC8B8B'
}`,
      functionSignature: ['feature'],
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
