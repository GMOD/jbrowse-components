import { ConfigurationSchema } from '@jbrowse/core/configuration'
import ConfigSchema from '../configSchema'

export { default as ReactComponent } from '../WiggleRendering'
export { default } from './XYPlotRenderer'

export const configSchema = ConfigurationSchema(
  'XYPlotRenderer',
  {},
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)
