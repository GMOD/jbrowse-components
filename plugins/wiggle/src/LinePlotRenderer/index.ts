import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import ConfigSchema from '../configSchema'

import ReactComponent from '../WiggleRendering'
import LinePlotRenderer from './LinePlotRenderer'

const configSchema = ConfigurationSchema(
  'LinePlotRenderer',
  {
    displayCrossHatches: {
      type: 'boolean',
      description: 'choose to draw cross hatches (sideways lines)',
      defaultValue: false,
    },
  },
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)

export default (pluginManager: PluginManager) => {
  pluginManager.addRendererType(
    () =>
      new LinePlotRenderer({
        name: 'LinePlotRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}
