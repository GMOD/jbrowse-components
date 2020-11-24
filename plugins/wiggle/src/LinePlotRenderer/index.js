import { ConfigurationSchema } from '@jbrowse/core/configuration'
import ConfigSchema from '../configSchema'

export { default as ReactComponent } from '../WiggleRendering'
export { default } from './LinePlotRenderer'

export const configSchema = ConfigurationSchema(
  'LinePlotRenderer',
  {},
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)
