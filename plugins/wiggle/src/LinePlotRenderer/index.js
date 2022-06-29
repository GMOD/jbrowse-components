import { ConfigurationSchema } from '@jbrowse/core/configuration'
import ConfigSchema from '../configSchema'

export { default as ReactComponent } from '../WiggleRendering'
export { default } from './LinePlotRenderer'

export const configSchema = ConfigurationSchema(
  'LinePlotRenderer',
  {
    displayCrossHatches: {
      type: 'boolean',
      description: 'choose to draw cross hatches (sideways lines)',
      defaultValue: false,
    },
  },
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)
