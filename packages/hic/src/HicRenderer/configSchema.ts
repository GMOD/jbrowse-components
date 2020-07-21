import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export default ConfigurationSchema(
  'HicRenderer',
  {
    color: {
      type: 'color',
      description: 'the color of each feature in a hic alignment',
      defaultValue: `function(feature) {
  var s = feature.get('strand');
  return s === -1 ? '#8F8FD8': '#EC8B8B'
}`,
      functionSignature: ['feature'],
    },

    maxHeight: {
      type: 'integer',
      description: 'the maximum height to be used in a hic rendering',
      defaultValue: 600,
    },
  },
  { explicitlyTyped: true },
)
