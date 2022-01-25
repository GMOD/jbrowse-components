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
    posColor: {
      type: 'color',
      description: 'the color for forward alignments',
      defaultValue: 'darkblue',
    },
    negColor: {
      type: 'color',
      description: 'the color for reverse alignments',
      defaultValue: 'red',
    },
    lineWidth: {
      type: 'number',
      description: 'width of the lines to be drawn',
      defaultValue: 2,
    },
  },
  { explicitlyTyped: true },
)
