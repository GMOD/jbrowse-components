import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'LollipopRenderer',
  {
    strokeColor: {
      type: 'color',
      description: 'the outer color of each lollipop',
      defaultValue: 'green',
      contextVariable: ['feature'],
    },
    innerColor: {
      type: 'color',
      description: 'the inner color of each lollipop',
      defaultValue: '#7fc75f',
      contextVariable: ['feature'],
    },
    strokeWidth: {
      type: 'number',
      description: 'width of the stroked border',
      defaultValue: 4,
      contextVariable: ['feature'],
    },
    radius: {
      type: 'number',
      description: 'radius in pixels of each lollipop body',
      defaultValue: `jexl:sqrt(max(3, (get(feature,'score')*10)/3.14))`,
      contextVariable: ['feature'],
    },
    caption: {
      type: 'string',
      description:
        'the tooltip caption displayed when the mouse hovers over a lollipop',
      defaultValue: `jexl:get(feature,'name')`,
      contextVariable: ['feature'],
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
      contextVariable: ['feature'],
    },
    stickWidth: {
      type: 'number',
      description: 'width in pixels of the lollipop stick',
      defaultValue: 2,
      contextVariable: ['feature'],
    },
    score: {
      type: 'number',
      description:
        'the "score" of each lollipop, displayed as a number in the center of the circle',
      defaultValue: `jexl:get(feature,'score')`,
      contextVariable: ['feature'],
    },
  },
  { explicitlyTyped: true },
)
