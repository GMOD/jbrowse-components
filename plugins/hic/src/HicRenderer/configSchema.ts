import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'HicRenderer',
  {
    baseColor: {
      type: 'color',
      description: 'base color to be used in the hic alignment',
      defaultValue: 'red',
    },
    color: {
      type: 'color',
      description: 'the color of each feature in a hic alignment',
      defaultValue: `function(count, maxScore, baseColor, lighten) {
      return lighten(baseColor, counts/(maxScore/20))
}`,
      functionSignature: ['count, maxScore, baseColor, lighten'],
    },

    maxHeight: {
      type: 'integer',
      description: 'the maximum height to be used in a hic rendering',
      defaultValue: 600,
    },
  },
  { explicitlyTyped: true },
)
