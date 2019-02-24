import { ConfigurationSchema } from '../../configuration'

export default ConfigurationSchema(
  'LollipopRenderer',
  {
    bodyColor: {
      type: 'color',
      description: 'the main color of each lollipop',
      defaultValue: 'green',
      functionSignature: ['feature'],
    },
    innerColor: {
      type: 'color',
      description: 'the inner color of each lollipop',
      defaultValue: 'red',
      functionSignature: ['feature'],
    },
    radius: {
      type: 'number',
      description: 'radius in pixels of each lollipop body',
      defaultValue: 15,
      functionSignature: ['feature'],
    },
  },
  { explicitlyTyped: true },
)
