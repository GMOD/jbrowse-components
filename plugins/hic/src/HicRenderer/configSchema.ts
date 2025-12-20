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
      type: 'color',
      description: 'base color to be used in the hic alignment',
      defaultValue: '#f00',
    },
    /**
     * #slot
     */
    color: {
      type: 'color',
      description: 'the color of each feature in a hic alignment',
      defaultValue: 'jexl:interpolate(count,scale)',
      contextVariable: ['count', 'maxScore', 'baseColor', 'scale'],
    },

    /**
     * #slot
     */
    maxHeight: {
      type: 'integer',
      description: 'the maximum height to be used in a hic rendering',
      defaultValue: 600,
    },
  },
  { explicitlyTyped: true },
)

export default HicRenderer
