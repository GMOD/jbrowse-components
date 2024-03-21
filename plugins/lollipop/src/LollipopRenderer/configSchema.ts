import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'LollipopRenderer',
  {
    caption: {
      contextVariable: ['feature'],
      defaultValue: `jexl:get(feature,'name')`,
      description:
        'the tooltip caption displayed when the mouse hovers over a lollipop',
      type: 'string',
    },
    innerColor: {
      contextVariable: ['feature'],
      defaultValue: '#7fc75f',
      description: 'the inner color of each lollipop',
      type: 'color',
    },
    minStickLength: {
      defaultValue: 5,
      description: 'minimum lollipop "stick" length, in pixels',
      type: 'number',
    },
    radius: {
      contextVariable: ['feature'],
      defaultValue: `jexl:sqrt(max(3, (get(feature,'score')*10)/3.14))`,
      description: 'radius in pixels of each lollipop body',
      type: 'number',
    },
    score: {
      contextVariable: ['feature'],
      defaultValue: `jexl:get(feature,'score')`,
      description:
        'the "score" of each lollipop, displayed as a number in the center of the circle',
      type: 'number',
    },
    stickColor: {
      contextVariable: ['feature'],
      defaultValue: 'black',
      description: 'color of the lollipop stick',
      type: 'color',
    },
    stickWidth: {
      contextVariable: ['feature'],
      defaultValue: 2,
      description: 'width in pixels of the lollipop stick',
      type: 'number',
    },
    strokeColor: {
      contextVariable: ['feature'],
      defaultValue: 'green',
      description: 'the outer color of each lollipop',
      type: 'color',
    },
    strokeWidth: {
      contextVariable: ['feature'],
      defaultValue: 4,
      description: 'width of the stroked border',
      type: 'number',
    },
  },
  { explicitlyTyped: true },
)
