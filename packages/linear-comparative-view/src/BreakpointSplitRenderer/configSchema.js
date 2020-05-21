import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { types } from 'mobx-state-tree'

export default ConfigurationSchema(
  'BreakpointSplitRenderer',
  {
    drawMode: {
      type: 'stringEnum',
      description: 'drawing mode',
      model: types.enumeration('Rendering', ['spline', 'bracket']),
      defaultValue: 'spline',
    },
    color: {
      type: 'color',
      description: 'the color of each feature in a synteny',
      defaultValue: 'black',
    },
  },
  { explicitlyTyped: true },
)
