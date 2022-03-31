import PluginManager from '@jbrowse/core/PluginManager'

import ReactComponent from './components/MultilevelLinearRendering'
import configSchema from './configSchema'
import MultilevelLinearRenderer from './MultilevelLinearRenderer'

export default (pluginManager: PluginManager) => {
  pluginManager.addRendererType(
    () =>
      new MultilevelLinearRenderer({
        name: 'MultilevelLinearRenderer',
        configSchema,
        ReactComponent,
        pluginManager,
      }),
  )
}
