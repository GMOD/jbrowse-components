import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import ConfigSchema from './configSchema'

export { default as ReactComponent } from './components/WiggleRendering'
export { default } from './DensityRenderer'

export const configSchema = ConfigurationSchema(
  'DensityRenderer',
  {},
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)
