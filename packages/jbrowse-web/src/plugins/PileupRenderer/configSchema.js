import { ConfigurationSchema } from '../../configuration'

export default ConfigurationSchema('PileupRenderer', {
  alignmentColor: {
    type: 'color',
    description: 'the color of each feature in a pileup alignment',
    defaultValue: `function(feature) {
  var s = feature.get('strand');
  return s === '-' || s === -1 ? 'blue': 'red'
}`,
    functionSignature: ['feature'],
  },
  alignmentHeight: {
    type: 'integer',
    description: 'the height of each feature in a pileup alignment',
    defaultValue: 5,
    functionSignature: ['feature'],
  },
})
