import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'HicRenderer',
  {
    baseColor: {
      type: 'color',
      description: 'base color to be used in the hic alignment',
      defaultValue: '#f00',
    },
    color: {
      type: 'color',
      description: 'the color of each feature in a hic alignment',
      defaultValue: `function(counts, maxScore, baseColor) {
      return baseColor.alpha(Math.min(1,counts/(maxScore/20))).hsl().string()
}`,
      functionSignature: ['count', 'maxScore', 'baseColor'],
    },

    maxHeight: {
      type: 'integer',
      description: 'the maximum height to be used in a hic rendering',
      defaultValue: 600,
    },
  },
  { explicitlyTyped: true },
)
