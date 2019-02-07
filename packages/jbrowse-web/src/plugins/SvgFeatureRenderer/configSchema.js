import { ConfigurationSchema } from '../../configuration'

export default ConfigurationSchema(
  'SvgFeatureRenderer',
  {
    color1: {
      type: 'color',
      description: 'the main color of each feature',
      defaultValue: 'goldenrod',
      functionSignature: ['feature'],
    },
    color2: {
      type: 'color',
      description:
        'the secondary color of each feature, used for connecting lines, etc',
      defaultValue: 'black',
      functionSignature: ['feature'],
    },
    color3: {
      type: 'color',
      description:
        'the tertiary color of each feature, often used for contrasting fills, like on UTRs',
      defaultValue: '#357089',
      functionSignature: ['feature'],
    },
    height: {
      type: 'number',
      description: 'height in pixels of the main body of each feature',
      defaultValue: 10,
      functionSignature: ['feature'],
    },
  },
  { explicitlyTyped: true },
)
