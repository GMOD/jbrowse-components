import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export default ConfigurationSchema(
  'PileupRenderer',
  {
    alignmentColor: {
      type: 'color',
      description: 'the color of each feature in a pileup alignment',
      defaultValue: `function(feature) {
  var s = feature.get('strand');
  return s === '-' || s === -1 ? '#8F8FD8': '#EC8B8B'
}`,
      functionSignature: ['feature'],
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
