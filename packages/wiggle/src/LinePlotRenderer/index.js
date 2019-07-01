import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import ConfigSchema from '../DensityRenderer/configSchema'

export {
  default as ReactComponent,
} from '../DensityRenderer/components/WiggleRendering'
export { default } from './LinePlotRenderer'

export const configSchema = ConfigurationSchema(
  'LinePlotRenderer',
  {},
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)
