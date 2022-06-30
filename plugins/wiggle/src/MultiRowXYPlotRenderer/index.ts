import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import ConfigSchema from '../configSchema'

import ReactComponent from '../WiggleRendering'
import MultiRowXYPlotRenderer from './MultiRowXYPlotRenderer'

const configSchema = ConfigurationSchema(
  'MultiRowXYPlotRenderer',
  {},
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)

export default (pluginManager: PluginManager) => {
  pluginManager.addRendererType(
    () =>
      new MultiRowXYPlotRenderer({
        name: 'MultiRowXYPlotRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}
