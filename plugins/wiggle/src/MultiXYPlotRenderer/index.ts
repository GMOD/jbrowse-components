import { ConfigurationSchema } from '@jbrowse/core/configuration'
import ConfigSchema from '../configSchema'

export { default as ReactComponent } from '../WiggleRendering'
export { default } from './MultiXYPlotRenderer'

export const configSchema = ConfigurationSchema(
  'MultiXYPlotRenderer',
  {},
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)
