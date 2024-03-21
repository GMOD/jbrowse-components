import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config HicRenderer
 * #category renderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const HicRenderer = ConfigurationSchema(
  'HicRenderer',
  {
    /**
     * #slot
     */
    baseColor: {
      defaultValue: '#f00',
      description: 'base color to be used in the hic alignment',
      type: 'color',
    },
    /**
     * #slot
     */
    color: {
      contextVariable: ['count', 'maxScore', 'baseColor'],
      defaultValue: `jexl:colorString(hsl(alpha(baseColor,min(1,count/(maxScore/20)))))`,
      description: 'the color of each feature in a hic alignment',
      type: 'color',
    },

    /**
     * #slot
     */
    maxHeight: {
      defaultValue: 600,
      description: 'the maximum height to be used in a hic rendering',
      type: 'integer',
    },
  },
  { explicitlyTyped: true },
)

export default HicRenderer
