import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export default ConfigurationSchema(
  'SNPRenderer',
  {
    alignmentColor: {
      type: 'color',
      description: 'the color of each feature in a pileup alignment',
      defaultValue: `function(feature) {
  var s = feature.get('strand');
  return s === -1 ? '#8F8FD8': '#EC8B8B'
}`,
      functionSignature: ['feature'],
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
    alignmentHeight: {
      type: 'integer',
      description: 'the height of each feature in a pileup alignment',
      defaultValue: 7,
      functionSignature: ['feature'],
    },
  },
  { explicitlyTyped: true },
)
