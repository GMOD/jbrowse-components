import PluginManager from '@jbrowse/core/PluginManager'

import ReactComponent from './ArcRendering'
import configSchema from './configSchema'
import ArcRenderer from './ArcRenderer'

export default (pluginManager: PluginManager) => {
  pluginManager.addRendererType(
    () =>
      new ArcRenderer({
        ReactComponent,
        configSchema,
        name: 'ArcRenderer',
        pluginManager,
      }),
  )
}
