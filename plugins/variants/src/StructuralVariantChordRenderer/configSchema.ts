import { ConfigurationSchema } from '@jbrowse/core/configuration'
/**
 * #config StructuralVariantChordRenderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'StructuralVariantChordRenderer',
  {
    /**
     * #slot
     */
    strokeColor: {
      contextVariable: ['feature'],
      defaultValue: 'rgba(255,133,0,0.32)',
      description: 'the line color of each arc',
      type: 'color',
    },

    /**
     * #slot
     */
    strokeColorHover: {
      contextVariable: ['feature'],
      defaultValue: '#555',
      description:
        'the line color of an arc that is being hovered over with the mouse',
      type: 'color',
    },

    /**
     * #slot
     */
    strokeColorSelected: {
      contextVariable: ['feature'],
      defaultValue: 'black',
      description: 'the line color of an arc that has been selected',
      type: 'color',
    },
  },
  { explicitlyTyped: true },
)

export default configSchema
