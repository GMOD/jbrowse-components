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
      defaultValue: `jexl:colorString(hsl(alpha(baseColor,min(1,count/(maxScore/20)))))`,
      contextVariable: ['count', 'maxScore', 'baseColor'],
    },

    maxHeight: {
      type: 'integer',
      description: 'the maximum height to be used in a hic rendering',
      defaultValue: 600,
    },
  },
  { explicitlyTyped: true },
)
