import { ConfigurationSchema } from '@jbrowse/core/configuration'
import ConfigSchema from '../configSchema'

const configSchema = ConfigurationSchema(
  'MultiDensityRenderer',
  {},
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)

export default configSchema
