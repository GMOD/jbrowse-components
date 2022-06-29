import { ConfigurationSchema } from '@jbrowse/core/configuration'
import ConfigSchema from '../configSchema'
import { types } from 'mobx-state-tree'
export { default as ReactComponent } from '../WiggleRendering'
export { default } from './XYPlotRenderer'

export const configSchema = ConfigurationSchema(
  'XYPlotRenderer',
  {
    filled: {
      type: 'boolean',
      defaultValue: true,
    },
    displayCrossHatches: {
      type: 'boolean',
      description: 'choose to draw cross hatches (sideways lines)',
      defaultValue: false,
    },
    summaryScoreMode: {
      type: 'stringEnum',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      defaultValue: 'whiskers',
    },
  },
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)
