import { ConfigurationSchema } from '@jbrowse/core/configuration'
import ConfigSchema from '../configSchema'

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
  },
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)
