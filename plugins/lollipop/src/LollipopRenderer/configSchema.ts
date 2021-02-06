import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'LollipopRenderer',
  {
    strokeColor: {
      type: 'color',
      description: 'the outer color of each lollipop',
      defaultValue: 'green',
      functionSignature: ['feature'],
    },
    innerColor: {
      type: 'color',
      description: 'the inner color of each lollipop',
      defaultValue: '#7fc75f',
      functionSignature: ['feature'],
    },
    strokeWidth: {
      type: 'number',
      description: 'width of the stroked border',
      defaultValue: 4,
      functionSignature: ['feature'],
    },
    radius: {
      type: 'number',
      description: 'radius in pixels of each lollipop body',
      defaultValue: `jexl:Math.max(3, Math.sqrt((getFeatureData(feature, 'score')*10)/3.14))`,
      functionSignature: ['feature'],
    },
    caption: {
      type: 'string',
      description:
        'the tooltip caption displayed when the mouse hovers over a lollipop',
      defaultValue: `jexl:getFeatureData(feature, 'name')`,
      functionSignature: ['feature'],
    },
    minStickLength: {
      type: 'number',
      description: 'minimum lollipop "stick" length, in pixels',
      defaultValue: 5,
    },
    stickColor: {
      type: 'color',
      description: 'color of the lollipop stick',
      defaultValue: 'black',
      functionSignature: ['feature'],
    },
    stickWidth: {
      type: 'number',
      description: 'width in pixels of the lollipop stick',
      defaultValue: 2,
      functionSignature: ['feature'],
    },
    score: {
      type: 'number',
      description:
        'the "score" of each lollipop, displayed as a number in the center of the circle',
      defaultValue: `jexl:getFeatureData(feature, 'score')`,
      functionSignature: ['feature'],
    },
  },
  { explicitlyTyped: true },
)
