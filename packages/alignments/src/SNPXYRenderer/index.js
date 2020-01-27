import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import ConfigSchema from '../configSchema'

export { default as ReactComponent } from '@gmod/jbrowse-plugin-wiggle/src/WiggleRendering'
export { default } from './SNPXYRenderer'

export const configSchema = ConfigurationSchema(
  'SNPXYPlotRenderer',
  {},
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)
