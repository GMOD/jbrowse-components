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
      type: 'color',
      description: 'the line color of each arc',
      defaultValue: 'rgba(255,133,0,0.32)',
      contextVariable: ['feature'],
    },
    /**
     * #slot
     */
    strokeColorSelected: {
      type: 'color',
      description: 'the line color of an arc that has been selected',
      defaultValue: 'black',
      contextVariable: ['feature'],
    },
    /**
     * #slot
     */
    strokeColorHover: {
      type: 'color',
      description:
        'the line color of an arc that is being hovered over with the mouse',
      defaultValue: '#555',
      contextVariable: ['feature'],
    },
  },
  { explicitlyTyped: true },
)

export default configSchema
