import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

export default ConfigurationSchema(
  'DotplotRenderer',
  {
    drawMode: {
      type: 'stringEnum',
      description: 'drawing mode',
      model: types.enumeration('Rendering', ['normal']),
      defaultValue: 'normal',
    },
    color: {
      type: 'color',
      description: 'the color of each feature in a synteny',
      defaultValue: 'black',
      contextVariable: ['feature'],
    },
    lineWidth: {
      type: 'number',
      description: 'width of the lines to be drawn',
      defaultValue: 1.5,
    },
  },
  { explicitlyTyped: true },
)
