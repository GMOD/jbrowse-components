import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
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
    },
  },
  { explicitlyTyped: true },
)
