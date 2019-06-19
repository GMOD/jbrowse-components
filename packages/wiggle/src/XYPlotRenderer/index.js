import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import ConfigSchema from '../DensityRenderer/configSchema'

export {
  default as ReactComponent,
} from '../DensityRenderer/components/WiggleRendering'
export { default } from './XYPlotRenderer'

export const configSchema = ConfigurationSchema(
  'XYPlotRenderer',
  {},
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)
