import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import ConfigSchema from '../configSchema'

import ReactComponent from '../WiggleRendering'
import MultiDensityRenderer from './MultiDensityRenderer'

const configSchema = ConfigurationSchema(
  'MultiDensityRenderer',
  {},
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)

export default (pluginManager: PluginManager) => {
  pluginManager.addRendererType(
    () =>
      new MultiDensityRenderer({
        name: 'MultiDensityRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}
